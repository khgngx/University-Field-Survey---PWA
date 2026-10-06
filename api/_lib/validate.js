import { CATEGORIES } from '../../src/utils/categories.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_LOCATION_LENGTH = 50
const MAX_NOTES_LENGTH = 2000

const isText = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max
const inRange = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max

// Never trust the client: re-validate everything. Returns { ok, value } with normalised
// values, or { ok: false, errors }.
export function validatePayload(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['metadata must be a JSON object'] }
  }
  const errors = []

  if (typeof raw.id !== 'string' || !UUID_RE.test(raw.id)) errors.push('id must be a UUID')
  for (const field of ['building', 'floor', 'room']) {
    if (!isText(raw[field], MAX_LOCATION_LENGTH)) errors.push(`${field} must be 1-${MAX_LOCATION_LENGTH} characters`)
  }
  if (!CATEGORIES.includes(raw.category)) errors.push(`category must be one of ${CATEGORIES.join(', ')}`)
  if (!Number.isInteger(raw.rating) || raw.rating < 1 || raw.rating > 5) errors.push('rating must be an integer 1-5')
  if (raw.defectNotes !== undefined && (typeof raw.defectNotes !== 'string' || raw.defectNotes.length > MAX_NOTES_LENGTH)) {
    errors.push(`defectNotes must be a string up to ${MAX_NOTES_LENGTH} characters`)
  }
  const version = raw.version ?? 1
  if (!Number.isInteger(version) || version < 1 || version > 1000) errors.push('version must be an integer 1-1000')
  if (!inRange(raw.createdAt, 1, 8.64e15)) errors.push('createdAt must be a millisecond timestamp')

  const gps = raw.gps
  if (gps != null) {
    const valid = typeof gps === 'object' && inRange(gps.lat, -90, 90) && inRange(gps.lng, -180, 180)
      && (gps.accuracy === undefined || inRange(gps.accuracy, 0, Number.MAX_VALUE))
    if (!valid) errors.push('gps must be { lat, lng, accuracy? } within valid ranges')
  }

  if (errors.length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: {
      id: raw.id.toLowerCase(),
      building: raw.building.trim(),
      floor: raw.floor.trim(),
      room: raw.room.trim(),
      category: raw.category,
      rating: raw.rating,
      defectNotes: raw.defectNotes ?? '',
      gps: gps ? { lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy ?? null } : null,
      version,
      createdAt: raw.createdAt,
    },
  }
}
