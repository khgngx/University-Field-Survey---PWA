import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { STATUS } from '../utils/constants'
import { db } from './database'
import {
  SurveyValidationError,
  createDraft,
  diffPatch,
  findRecentSurvey,
  getOrCreateDraft,
  saveDraft,
  submitDraft,
  validateForSubmit,
} from './surveys'

const complete = { building: 'A', floor: '3', room: 'A305', category: 'AC', rating: 4 }

beforeEach(async () => {
  await db.surveys.clear()
})

describe('validateForSubmit', () => {
  it('accepts a complete survey', () => {
    expect(validateForSubmit(complete)).toEqual([])
  })

  it('reports every missing or invalid field', () => {
    expect(validateForSubmit({})).toEqual(['building', 'floor', 'room', 'category', 'rating'])
  })

  it('treats whitespace-only text as missing', () => {
    expect(validateForSubmit({ ...complete, room: '   ' })).toEqual(['room'])
  })

  it('rejects text longer than the server accepts', () => {
    expect(validateForSubmit({ ...complete, room: 'x'.repeat(51) })).toEqual(['room'])
    expect(validateForSubmit({ ...complete, defectNotes: 'x'.repeat(2001) })).toEqual(['defectNotes'])
    expect(validateForSubmit({ ...complete, defectNotes: 'x'.repeat(2000) })).toEqual([])
  })

  it('rejects an invalid version but allows it to be absent', () => {
    expect(validateForSubmit({ ...complete, version: 0 })).toEqual(['version'])
    expect(validateForSubmit({ ...complete, version: 2 })).toEqual([])
  })

  it('rejects out-of-range, fractional and string ratings and unknown categories', () => {
    for (const rating of [0, 6, 2.5, '3']) {
      expect(validateForSubmit({ ...complete, rating })).toEqual(['rating'])
    }
    expect(validateForSubmit({ ...complete, category: 'Plumbing' })).toEqual(['category'])
  })
})

describe('diffPatch', () => {
  it('keeps only changed, whitelisted fields', () => {
    const current = { building: 'A', status: STATUS.DRAFT }
    expect(diffPatch(current, { building: 'A', floor: '2', status: STATUS.SYNCED })).toEqual({ floor: '2' })
  })
})

describe('drafts', () => {
  it('creates a DRAFT with a UUID and timestamps', async () => {
    const draft = await createDraft(1_000)
    expect(draft).toMatchObject({ status: STATUS.DRAFT, version: 1, retryCount: 0, createdAt: 1_000, updatedAt: 1_000 })
    expect(draft.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('getOrCreateDraft resumes the most recently updated draft instead of creating another', async () => {
    const older = await createDraft(1_000)
    const newer = await createDraft(2_000)
    await saveDraft(older.id, { building: 'B' }, 3_000)
    expect((await getOrCreateDraft()).id).toBe(older.id)
    expect(await db.surveys.count()).toBe(2)
    expect(newer.id).not.toBe(older.id)
  })

  it('getOrCreateDraft called concurrently still yields a single draft', async () => {
    const [a, b] = await Promise.all([getOrCreateDraft(), getOrCreateDraft()])
    expect(a.id).toBe(b.id)
    expect(await db.surveys.count()).toBe(1)
  })

  it('getOrCreateDraft creates one when none exist', async () => {
    const draft = await getOrCreateDraft()
    expect(await db.surveys.count()).toBe(1)
    expect(draft.status).toBe(STATUS.DRAFT)
  })

  it('saveDraft persists changes and bumps updatedAt only when something changed', async () => {
    const draft = await createDraft(1_000)
    await saveDraft(draft.id, { building: 'A' }, 2_000)
    expect(await db.surveys.get(draft.id)).toMatchObject({ building: 'A', updatedAt: 2_000 })
    await saveDraft(draft.id, { building: 'A' }, 3_000)
    expect((await db.surveys.get(draft.id)).updatedAt).toBe(2_000)
  })

  it('saveDraft ignores non-draft fields', async () => {
    const draft = await createDraft()
    await saveDraft(draft.id, { status: STATUS.SYNCED, id: 'x' })
    expect(await db.surveys.get(draft.id)).toMatchObject({ id: draft.id, status: STATUS.DRAFT })
  })

  it('saveDraft never touches a survey that already left DRAFT', async () => {
    const draft = await createDraft()
    await saveDraft(draft.id, complete)
    await submitDraft(draft.id)
    expect(await saveDraft(draft.id, { room: 'ZZZ' })).toBe(false)
    expect((await db.surveys.get(draft.id)).room).toBe('A305')
  })
})

describe('submitDraft', () => {
  it('moves a valid draft to PENDING_SYNC and trims location fields', async () => {
    const draft = await createDraft()
    await saveDraft(draft.id, { ...complete, building: ' A ' })
    const queued = await submitDraft(draft.id, 9_000)
    expect(queued).toMatchObject({ status: STATUS.PENDING_SYNC, building: 'A', updatedAt: 9_000, submittedAt: 9_000 })
    expect((await db.surveys.get(draft.id)).status).toBe(STATUS.PENDING_SYNC)
  })

  it('rejects an incomplete draft and leaves it as DRAFT', async () => {
    const draft = await createDraft()
    await saveDraft(draft.id, { building: 'A' })
    await expect(submitDraft(draft.id)).rejects.toBeInstanceOf(SurveyValidationError)
    expect((await db.surveys.get(draft.id)).status).toBe(STATUS.DRAFT)
  })

  it('rejects unknown ids and double submits', async () => {
    await expect(submitDraft('missing')).rejects.toThrow(/not found/)
    const draft = await createDraft()
    await saveDraft(draft.id, complete)
    await submitDraft(draft.id)
    await expect(submitDraft(draft.id)).rejects.toThrow(/already PENDING_SYNC/)
  })
})

describe('findRecentSurvey', () => {
  const HOUR = 60 * 60 * 1000
  const room = { building: 'A', floor: '3', room: 'A305' }
  const seed = (overrides) =>
    db.surveys.add({ id: crypto.randomUUID(), ...room, status: STATUS.SYNCED, version: 1, createdAt: 0, submittedAt: 0, ...overrides })

  it('finds a survey of the same room within 24 h', async () => {
    await seed({ submittedAt: 10 * HOUR })
    expect(await findRecentSurvey(room, 20 * HOUR)).toMatchObject({ room: 'A305' })
  })

  it('ignores surveys older than 24 h, other rooms, drafts and the excluded id', async () => {
    await seed({ submittedAt: 0 })
    await seed({ room: 'A306', submittedAt: 29 * HOUR })
    await seed({ status: STATUS.DRAFT, submittedAt: 29 * HOUR })
    const own = await seed({ submittedAt: 29 * HOUR })
    expect(await findRecentSurvey(room, 30 * HOUR, own)).toBeNull()
  })

  it('returns the most recent match and counts PENDING_SYNC as surveyed', async () => {
    await seed({ submittedAt: 5 * HOUR, version: 1 })
    await seed({ submittedAt: 8 * HOUR, version: 2, status: STATUS.PENDING_SYNC })
    expect(await findRecentSurvey(room, 10 * HOUR)).toMatchObject({ version: 2 })
  })

  it('trims input and returns null for incomplete locations', async () => {
    await seed({ submittedAt: 10 * HOUR })
    expect(await findRecentSurvey({ building: ' A ', floor: '3', room: 'A305 ' }, 11 * HOUR)).not.toBeNull()
    expect(await findRecentSurvey({ building: 'A', floor: '', room: 'A305' }, 11 * HOUR)).toBeNull()
  })
})
