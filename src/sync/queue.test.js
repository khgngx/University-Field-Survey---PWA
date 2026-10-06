import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/database'
import { MAX_RETRY, STATUS } from '../utils/constants'
import {
  SyncHttpError,
  isRetryable,
  recoverStuckSyncing,
  retryAllFailed,
  retrySurvey,
  runSyncQueue,
  selectDue,
  sendSurvey,
} from './queue'

const NOW = 1_000_000
const clock = () => NOW

async function seed(id, overrides = {}) {
  const survey = {
    id,
    building: 'A',
    floor: '3',
    room: 'A305',
    category: 'AC',
    rating: 4,
    version: 1,
    status: STATUS.PENDING_SYNC,
    retryCount: 0,
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  }
  await db.surveys.put(survey)
  return survey
}

const get = (id) => db.surveys.get(id)

beforeEach(async () => {
  await db.surveys.clear()
  await db.syncLog.clear()
})

describe('selectDue', () => {
  it('returns PENDING_SYNC and due FAILED records oldest first, skipping the rest', async () => {
    await seed('new', { createdAt: 300 })
    await seed('old', { createdAt: 100 })
    await seed('due', { status: STATUS.FAILED, nextRetryAt: NOW - 1, createdAt: 200 })
    await seed('waiting', { status: STATUS.FAILED, nextRetryAt: NOW + 5_000 })
    await seed('exhausted', { status: STATUS.FAILED, nextRetryAt: null })
    await seed('draft', { status: STATUS.DRAFT })
    await seed('done', { status: STATUS.SYNCED })
    expect((await selectDue(NOW)).map((s) => s.id)).toEqual(['old', 'due', 'new'])
  })
})

describe('runSyncQueue', () => {
  it('syncs records strictly one at a time, oldest first', async () => {
    await seed('b', { createdAt: 200 })
    await seed('a', { createdAt: 100 })
    await seed('c', { createdAt: 300 })
    const order = []
    let inFlight = 0
    let maxInFlight = 0
    const send = async (s) => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      order.push(s.id)
      inFlight -= 1
    }

    const summary = await runSyncQueue({ send, now: clock })

    expect(summary).toEqual({ ran: true, synced: 3, failed: 0 })
    expect(order).toEqual(['a', 'b', 'c'])
    expect(maxInFlight).toBe(1)
    expect(await get('a')).toMatchObject({ status: STATUS.SYNCED, syncedAt: NOW, lastError: null })
    expect(await db.syncLog.count()).toBe(3)
  })

  it('records a retryable failure with exponential backoff', async () => {
    await seed('x')
    await runSyncQueue({ send: async () => { throw new SyncHttpError(500) }, now: clock })
    expect(await get('x')).toMatchObject({
      status: STATUS.FAILED,
      retryCount: 1,
      nextRetryAt: NOW + 10_000,
      lastError: 'Server responded 500',
    })
    expect(await selectDue(NOW + 9_999)).toHaveLength(0)
    expect(await selectDue(NOW + 10_000)).toHaveLength(1)
  })

  it('retries a due FAILED record and clears the error on success', async () => {
    await seed('x', { status: STATUS.FAILED, retryCount: 2, nextRetryAt: NOW - 1, lastError: 'boom' })
    await runSyncQueue({ send: async () => ({}), now: clock })
    expect(await get('x')).toMatchObject({ status: STATUS.SYNCED, lastError: null, nextRetryAt: null })
  })

  it('stops retrying after MAX_RETRY and waits for the user', async () => {
    await seed('x', { retryCount: MAX_RETRY - 1 })
    await runSyncQueue({ send: async () => { throw new SyncHttpError(503) }, now: clock })
    const record = await get('x')
    expect(record).toMatchObject({ status: STATUS.FAILED, retryCount: MAX_RETRY, nextRetryAt: null })
    expect(await selectDue(NOW * 1000)).toHaveLength(0)
  })

  it('treats a 4xx rejection as permanent and keeps syncing the records behind it', async () => {
    await seed('bad', { createdAt: 100 })
    await seed('good', { createdAt: 200 })
    const send = async (s) => {
      if (s.id === 'bad') throw new SyncHttpError(400, 'invalid rating')
    }
    const summary = await runSyncQueue({ send, now: clock })
    expect(summary).toEqual({ ran: true, synced: 1, failed: 1 })
    expect(await get('bad')).toMatchObject({ status: STATUS.FAILED, nextRetryAt: null, lastError: expect.stringContaining('400') })
    expect((await get('good')).status).toBe(STATUS.SYNCED)
  })

  it('aborts the run on a network failure instead of hammering a dead connection', async () => {
    await seed('a', { createdAt: 100 })
    await seed('b', { createdAt: 200 })
    const send = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    const summary = await runSyncQueue({ send, now: clock })
    expect(send).toHaveBeenCalledTimes(1)
    expect(summary).toEqual({ ran: true, synced: 0, failed: 1 })
    expect(await get('a')).toMatchObject({ status: STATUS.FAILED, retryCount: 1 })
    expect((await get('b')).status).toBe(STATUS.PENDING_SYNC)
  })

  it('does not run twice concurrently', async () => {
    await seed('a')
    let release
    const gate = new Promise((r) => { release = r })
    const send = vi.fn(() => gate)
    const first = runSyncQueue({ send, now: clock })
    await vi.waitFor(() => expect(send).toHaveBeenCalled())
    expect(await runSyncQueue({ send, now: clock })).toEqual({ ran: false, synced: 0, failed: 0 })
    release()
    expect((await first).synced).toBe(1)
    expect(send).toHaveBeenCalledTimes(1)
  })
})

describe('retry and recovery', () => {
  it('retrySurvey resets only FAILED records', async () => {
    await seed('f', { status: STATUS.FAILED, retryCount: 5, nextRetryAt: null, lastError: 'x' })
    await seed('s', { status: STATUS.SYNCED })
    expect(await retrySurvey('f', 5)).toBe(true)
    expect(await retrySurvey('s', 5)).toBe(false)
    expect(await get('f')).toMatchObject({ status: STATUS.PENDING_SYNC, retryCount: 0, nextRetryAt: null, lastError: null })
    expect((await get('s')).status).toBe(STATUS.SYNCED)
  })

  it('retryAllFailed requeues every FAILED record', async () => {
    await seed('f1', { status: STATUS.FAILED })
    await seed('f2', { status: STATUS.FAILED })
    await retryAllFailed()
    expect(await db.surveys.where('status').equals(STATUS.PENDING_SYNC).count()).toBe(2)
  })

  it('recoverStuckSyncing requeues records interrupted mid-request', async () => {
    await seed('stuck', { status: STATUS.SYNCING })
    await recoverStuckSyncing()
    expect((await get('stuck')).status).toBe(STATUS.PENDING_SYNC)
  })
})

describe('isRetryable', () => {
  it('classifies errors', () => {
    expect(isRetryable(new TypeError('Failed to fetch'))).toBe(true)
    expect(isRetryable(new SyncHttpError(500))).toBe(true)
    expect(isRetryable(new SyncHttpError(429))).toBe(true)
    expect(isRetryable(new SyncHttpError(408))).toBe(true)
    expect(isRetryable(new SyncHttpError(400))).toBe(false)
    expect(isRetryable(new SyncHttpError(404))).toBe(false)
  })
})

describe('sendSurvey', () => {
  const ok = () => Promise.resolve(new Response(JSON.stringify({ id: 'x', syncedAt: 1 }), { status: 200 }))

  it('posts metadata and photo as multipart without leaking local sync fields', async () => {
    const fetchImpl = vi.fn(ok)
    const survey = {
      id: 'x', building: 'A', floor: '3', room: 'A305', category: 'AC', rating: 4, version: 1,
      createdAt: 5, status: STATUS.PENDING_SYNC, retryCount: 2, lastError: 'old',
      photoBlob: new Blob(['jpg'], { type: 'image/jpeg' }),
    }
    await expect(sendSurvey(survey, { fetchImpl, apiUrl: 'https://api.test' })).resolves.toEqual({ id: 'x', syncedAt: 1 })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.test/surveys')
    expect(init.method).toBe('POST')
    const metadata = JSON.parse(init.body.get('metadata'))
    expect(metadata).toEqual({ id: 'x', building: 'A', floor: '3', room: 'A305', category: 'AC', rating: 4, version: 1, createdAt: 5 })
    expect(init.body.get('photo').name).toBe('x.jpg')
  })

  it('omits the photo part when there is no photo', async () => {
    const fetchImpl = vi.fn(ok)
    await sendSurvey({ id: 'x' }, { fetchImpl, apiUrl: 'https://api.test' })
    expect(fetchImpl.mock.calls[0][1].body.has('photo')).toBe(false)
  })

  it('throws SyncHttpError with the status on non-2xx', async () => {
    const fetchImpl = async () => new Response('nope', { status: 422 })
    await expect(sendSurvey({ id: 'x' }, { fetchImpl, apiUrl: 'https://api.test' })).rejects.toMatchObject({
      name: 'SyncHttpError',
      status: 422,
    })
  })
})
