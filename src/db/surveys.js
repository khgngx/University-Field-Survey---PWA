import { CATEGORIES, STATUS } from '../utils/constants'
import { MAX_LOCATION_LENGTH, MAX_NOTES_LENGTH } from '../utils/limits'
import { db } from './database'

// Fields the wizard may write while a survey is still a draft.
export const DRAFT_FIELDS = ['building', 'floor', 'room', 'category', 'rating', 'defectNotes', 'photoBlob', 'gps', 'version']

export const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000

export class SurveyValidationError extends Error {
  constructor(missing) {
    super(`Survey is incomplete or invalid: ${missing.join(', ')}`)
    this.name = 'SurveyValidationError'
    this.missing = missing
  }
}

const isFilled = (value) => typeof value === 'string' && value.trim() !== '' && value.trim().length <= MAX_LOCATION_LENGTH

// Returns the names of required fields that are absent or invalid (empty array = valid).
export function validateForSubmit(survey) {
  const missing = []
  for (const field of ['building', 'floor', 'room']) {
    if (!isFilled(survey[field])) missing.push(field)
  }
  if (!CATEGORIES.includes(survey.category)) missing.push('category')
  if (!Number.isInteger(survey.rating) || survey.rating < 1 || survey.rating > 5) missing.push('rating')
  if (survey.defectNotes != null && (typeof survey.defectNotes !== 'string' || survey.defectNotes.length > MAX_NOTES_LENGTH)) {
    missing.push('defectNotes')
  }
  if (survey.version != null && (!Number.isInteger(survey.version) || survey.version < 1)) missing.push('version')
  return missing
}

// Keeps only whitelisted draft fields whose value differs from `current`.
export function diffPatch(current, patch) {
  const changes = {}
  for (const field of DRAFT_FIELDS) {
    if (field in patch && patch[field] !== current[field]) changes[field] = patch[field]
  }
  return changes
}

function newDraft(now) {
  return {
    id: crypto.randomUUID(),
    status: STATUS.DRAFT,
    version: 1,
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  }
}

export async function createDraft(now = Date.now()) {
  const draft = newDraft(now)
  await db.surveys.add(draft)
  return draft
}

// One transaction so concurrent callers (React StrictMode double-mount) cannot both create a draft.
export async function getOrCreateDraft() {
  return db.transaction('rw', db.surveys, async () => {
    const drafts = await db.surveys.where('status').equals(STATUS.DRAFT).toArray()
    if (drafts.length === 0) return createDraft()
    return drafts.reduce((latest, d) => (d.updatedAt > latest.updatedAt ? d : latest))
  })
}

// Resolves to false when the record is no longer a draft (e.g. submitted from another tab),
// so a late autosave can never overwrite a queued survey.
export async function saveDraft(id, patch, now = Date.now()) {
  return db.transaction('rw', db.surveys, async () => {
    const current = await db.surveys.get(id)
    if (!current || current.status !== STATUS.DRAFT) return false
    const changes = diffPatch(current, patch)
    if (Object.keys(changes).length === 0) return true
    await db.surveys.update(id, { ...changes, updatedAt: now })
    return true
  })
}

// Validates, normalises and moves a draft into the sync queue. Returns the queued record.
export async function submitDraft(id, now = Date.now()) {
  return db.transaction('rw', db.surveys, async () => {
    const current = await db.surveys.get(id)
    if (!current) throw new Error(`Survey ${id} not found`)
    if (current.status !== STATUS.DRAFT) throw new Error(`Survey ${id} is already ${current.status}`)
    const missing = validateForSubmit(current)
    if (missing.length > 0) throw new SurveyValidationError(missing)
    const queued = {
      ...current,
      building: current.building.trim(),
      floor: current.floor.trim(),
      room: current.room.trim(),
      status: STATUS.PENDING_SYNC,
      submittedAt: now,
      updatedAt: now,
    }
    await db.surveys.put(queued)
    return queued
  })
}

// Latest survey of the same room submitted within the last 24 h (drafts and `excludeId` ignored),
// or null. Runs entirely against IndexedDB so it works offline.
export async function findRecentSurvey({ building, floor, room }, now = Date.now(), excludeId = null) {
  if (![building, floor, room].every(isFilled)) return null
  const hits = await db.surveys
    .where('[building+floor+room]')
    .equals([building.trim(), floor.trim(), room.trim()])
    .toArray()
  const recent = hits.filter(
    (s) => s.status !== STATUS.DRAFT && s.id !== excludeId && now - (s.submittedAt ?? s.createdAt) <= DUPLICATE_WINDOW_MS,
  )
  if (recent.length === 0) return null
  return recent.reduce((latest, s) => ((s.submittedAt ?? s.createdAt) > (latest.submittedAt ?? latest.createdAt) ? s : latest))
}
