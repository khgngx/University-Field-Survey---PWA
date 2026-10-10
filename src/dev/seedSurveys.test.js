import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/database'
import { validateForSubmit } from '../db/surveys'
import { STATUS } from '../utils/constants'
import { summarize } from '../utils/stats'
import { MAX_SAMPLE_SURVEYS, buildSampleSurveys, clearSurveys, requeueSynced, seedSurveys } from './seedSurveys'

const NOW = Date.UTC(2026, 0, 15)
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

beforeEach(async () => {
  await db.surveys.clear()
})

describe('buildSampleSurveys', () => {
  it('builds 100 valid surveys, each for a different room', () => {
    const samples = buildSampleSurveys(100, { now: NOW })
    expect(samples).toHaveLength(100)
    for (const sample of samples) expect(validateForSubmit(sample)).toEqual([])
    expect(new Set(samples.map((s) => `${s.building}|${s.floor}|${s.room}`)).size).toBe(100)
  })

  it('is deterministic for a seed and differs between seeds', () => {
    expect(buildSampleSurveys(100, { now: NOW, seed: 7 })).toEqual(buildSampleSurveys(100, { now: NOW, seed: 7 }))
    expect(buildSampleSurveys(100, { now: NOW, seed: 7 })).not.toEqual(buildSampleSurveys(100, { now: NOW, seed: 8 }))
  })

  it('rates most rooms 4–5 stars while keeping a few defects', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const ratings = buildSampleSurveys(100, { now: NOW, seed }).map((s) => s.rating)
      const average = ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      expect(average).toBeGreaterThanOrEqual(4)
      expect(ratings.filter((r) => r >= 4).length).toBeGreaterThanOrEqual(75)
      expect(ratings.some((r) => r <= 2)).toBe(true)
    }
  })

  it('spreads creation times over the past week and notes only defects', () => {
    for (const sample of buildSampleSurveys(100, { now: NOW })) {
      expect(sample.createdAt).toBeLessThanOrEqual(NOW)
      expect(sample.createdAt).toBeGreaterThan(NOW - WEEK_MS)
      expect(sample.defectNotes !== '').toBe(sample.rating <= 2)
    }
  })

  it('rejects counts outside 1..max', () => {
    for (const count of [0, -1, 1.5, MAX_SAMPLE_SURVEYS + 1]) {
      expect(() => buildSampleSurveys(count)).toThrow(RangeError)
    }
    expect(buildSampleSurveys(MAX_SAMPLE_SURVEYS, { now: NOW })).toHaveLength(MAX_SAMPLE_SURVEYS)
  })
})

describe('seedSurveys', () => {
  it('queues 100 surveys for sync through the draft and submit path', async () => {
    expect(await seedSurveys(100, { now: NOW })).toBe(100)

    const stored = await db.surveys.toArray()
    expect(stored).toHaveLength(100)
    for (const survey of stored) {
      expect(survey.status).toBe(STATUS.PENDING_SYNC)
      expect(survey.version).toBe(1)
      expect(survey.submittedAt).toBe(survey.createdAt)
    }
  })

  it('stores data the dashboard can summarise', async () => {
    await seedSurveys(100, { now: NOW })

    const stats = summarize(await db.surveys.toArray())
    expect(stats.total).toBe(100)
    expect(stats.averageRating).toBeGreaterThanOrEqual(4)
    expect(stats.averageRating).toBeLessThanOrEqual(5)
    expect(Object.values(stats.countByCategory).reduce((sum, n) => sum + n, 0)).toBe(100)
    expect(Object.keys(stats.defectsByBuilding).length).toBeGreaterThan(0)
  })

  it('adds to existing data instead of replacing it', async () => {
    await seedSurveys(10, { now: NOW, seed: 1 })
    await seedSurveys(10, { now: NOW, seed: 2 })
    expect(await db.surveys.count()).toBe(20)
  })
})

describe('clearSurveys', () => {
  it('removes every survey and sync log entry', async () => {
    await seedSurveys(10, { now: NOW })
    await db.syncLog.add({ surveyId: 'x', action: 'SYNC', timestamp: NOW, result: 'OK' })

    await clearSurveys()

    expect(await db.surveys.count()).toBe(0)
    expect(await db.syncLog.count()).toBe(0)
  })
})

describe('requeueSynced', () => {
  it('queues synced surveys again and leaves other statuses alone', async () => {
    await seedSurveys(3, { now: NOW })
    const [synced, failed, pending] = await db.surveys.toArray()
    await db.surveys.update(synced.id, { status: STATUS.SYNCED, syncedAt: NOW })
    await db.surveys.update(failed.id, { status: STATUS.FAILED, lastError: 'boom' })

    expect(await requeueSynced(NOW + 1)).toBe(1)

    expect((await db.surveys.get(synced.id)).status).toBe(STATUS.PENDING_SYNC)
    expect((await db.surveys.get(failed.id)).status).toBe(STATUS.FAILED)
    expect((await db.surveys.get(pending.id)).status).toBe(STATUS.PENDING_SYNC)
  })
})
