import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { STATUS } from '../utils/constants'
import { db } from './database'

const survey = (overrides) => ({
  id: crypto.randomUUID(),
  building: 'A',
  floor: '3',
  room: 'A305',
  status: STATUS.DRAFT,
  createdAt: Date.now(),
  ...overrides,
})

beforeEach(async () => {
  await db.surveys.clear()
  await db.syncLog.clear()
})

describe('surveys table', () => {
  it('queries by status index', async () => {
    await db.surveys.bulkAdd([
      survey({ status: STATUS.PENDING_SYNC }),
      survey({ status: STATUS.PENDING_SYNC }),
      survey({ status: STATUS.SYNCED }),
    ])
    expect(await db.surveys.where('status').equals(STATUS.PENDING_SYNC).count()).toBe(2)
  })

  it('finds a room via the compound [building+floor+room] index', async () => {
    await db.surveys.bulkAdd([survey(), survey({ room: 'A306' })])
    const hits = await db.surveys.where('[building+floor+room]').equals(['A', '3', 'A305']).toArray()
    expect(hits).toHaveLength(1)
  })

  it('keeps one record per id (put is an upsert)', async () => {
    const s = survey()
    await db.surveys.put(s)
    await db.surveys.put({ ...s, status: STATUS.PENDING_SYNC })
    expect(await db.surveys.count()).toBe(1)
    expect((await db.surveys.get(s.id)).status).toBe(STATUS.PENDING_SYNC)
  })
})
