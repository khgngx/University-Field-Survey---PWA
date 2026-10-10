// Dev-only sample data. Surveys go through the same draft -> save -> submit path the wizard uses,
// so they are validated and queued for sync exactly like hand-entered ones.
import { db } from '../db/database'
import { createDraft, saveDraft, submitDraft } from '../db/surveys'
import { CATEGORIES, STATUS } from '../utils/constants'
import { DEFECT_MAX_RATING } from '../utils/stats'

const BUILDINGS = ['A', 'B', 'C', 'D', 'E']
const FLOORS_PER_BUILDING = 5
const ROOMS_PER_FLOOR = 8
export const MAX_SAMPLE_SURVEYS = BUILDINGS.length * FLOORS_PER_BUILDING * ROOMS_PER_FLOOR
const SPREAD_MS = 7 * 24 * 60 * 60 * 1000
// Percent share of each star rating: mostly 4–5 (average ≈ 4.2), with a few defects left in so the
// "defects by building" chart still has data.
const RATING_SHARES = [
  [5, 50],
  [4, 35],
  [3, 7],
  [2, 5],
  [1, 3],
]
const DEFECT_NOTES = [
  'Thiết bị không lên nguồn',
  'Hình ảnh bị mờ, cần vệ sinh ống kính',
  'Điều hoà chảy nước',
  'Ổ cắm lỏng, chập chờn',
  'Bàn ghế gãy chân',
  'Dây cáp hỏng đầu nối',
]

// Seeded PRNG (mulberry32) so the same seed always produces the same data set.
function createRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Every sample is a different room, so seeding never produces same-room duplicates.
export function buildSampleSurveys(count, { now = Date.now(), seed = 1 } = {}) {
  if (!Number.isInteger(count) || count < 1 || count > MAX_SAMPLE_SURVEYS) {
    throw new RangeError(`count must be an integer from 1 to ${MAX_SAMPLE_SURVEYS}, got ${count}`)
  }
  const random = createRandom(seed)
  const pick = (list) => list[Math.floor(random() * list.length)]
  const pickRating = () => {
    let roll = random() * 100
    for (const [rating, share] of RATING_SHARES) {
      roll -= share
      if (roll < 0) return rating
    }
    return RATING_SHARES[0][0]
  }

  return Array.from({ length: count }, (_, index) => {
    const building = BUILDINGS[index % BUILDINGS.length]
    const floor = (Math.floor(index / BUILDINGS.length) % FLOORS_PER_BUILDING) + 1
    const roomNumber = Math.floor(index / (BUILDINGS.length * FLOORS_PER_BUILDING)) + 1
    const rating = pickRating()
    return {
      building,
      floor: String(floor),
      room: `${building}${floor}${String(roomNumber).padStart(2, '0')}`,
      category: pick(CATEGORIES),
      rating,
      defectNotes: rating <= DEFECT_MAX_RATING ? pick(DEFECT_NOTES) : '',
      createdAt: now - Math.floor(random() * SPREAD_MS),
    }
  })
}

// Queues `count` sample surveys in IndexedDB and resolves to how many were added.
export async function seedSurveys(count = 100, options) {
  const samples = buildSampleSurveys(count, options)
  for (const { createdAt, ...fields } of samples) {
    const draft = await createDraft(createdAt)
    await saveDraft(draft.id, fields, createdAt)
    await submitDraft(draft.id, createdAt)
  }
  return samples.length
}

// Deletes every local survey (drafts included) and the sync log. Nothing on the server is touched.
export async function clearSurveys() {
  await db.transaction('rw', db.surveys, db.syncLog, async () => {
    await db.surveys.clear()
    await db.syncLog.clear()
  })
}

// Puts every synced survey back in the queue, e.g. after switching the API from the in-memory
// stand-in to the real database. Safe to repeat: the server upserts by survey id.
export function requeueSynced(now = Date.now()) {
  return db.surveys
    .where('status')
    .equals(STATUS.SYNCED)
    .modify({ status: STATUS.PENDING_SYNC, retryCount: 0, nextRetryAt: null, lastError: null, updatedAt: now })
}
