import { createClient } from '@supabase/supabase-js'
import { HttpError, isJpeg, parseMultipart } from './multipart.js'
import { validatePayload } from './validate.js'

const BUCKET = process.env.SUPABASE_BUCKET || 'survey-photos'
// https://localhost is the Capacitor Android WebView origin; add the PWA/GitHub Pages origins via env.
const ALLOWED_ORIGINS = new Set([
  'https://localhost',
  ...(process.env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean),
])

function defaultGetSupabase() {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Server misconfigured: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set')
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
}

function applyCors(req, res) {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Max-Age', '86400')
  }
  res.setHeader('Vary', 'Origin')
}

// POST /api/surveys — idempotent: the photo and the row are both upserted by survey id, so a
// retry (or the Service Worker and main thread both sending) never creates duplicates.
export function createSurveysHandler({ getSupabase = defaultGetSupabase, now = () => new Date() } = {}) {
  return async function handler(req, res) {
    applyCors(req, res)
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS')
      return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
      const { fields, photo } = await parseMultipart(req)

      let raw
      try {
        raw = JSON.parse(fields.metadata ?? '')
      } catch {
        throw new HttpError(400, 'metadata must be valid JSON')
      }
      const parsed = validatePayload(raw)
      if (!parsed.ok) throw new HttpError(400, parsed.errors.join('; '))
      const survey = parsed.value
      if (photo && !isJpeg(photo)) throw new HttpError(400, 'photo must be a JPEG image')

      const supabase = getSupabase()
      const photoPath = photo ? `surveys/${survey.id}.jpg` : null
      // Photo first, so a stored row never points at a missing file.
      if (photo) {
        const { error } = await supabase.storage.from(BUCKET).upload(photoPath, photo, { contentType: 'image/jpeg', upsert: true })
        if (error) throw new Error(`Photo upload failed: ${error.message}`)
      }

      const syncedAt = now().toISOString()
      const { error } = await supabase.from('surveys').upsert(
        {
          id: survey.id,
          building: survey.building,
          floor: survey.floor,
          room: survey.room,
          category: survey.category,
          rating: survey.rating,
          defect_notes: survey.defectNotes,
          gps_lat: survey.gps?.lat ?? null,
          gps_lng: survey.gps?.lng ?? null,
          gps_accuracy: survey.gps?.accuracy ?? null,
          version: survey.version,
          photo_path: photoPath,
          created_at: new Date(survey.createdAt).toISOString(),
          synced_at: syncedAt,
        },
        { onConflict: 'id' },
      )
      if (error) throw new Error(`Database upsert failed: ${error.message}`)

      return res.status(200).json({ id: survey.id, syncedAt })
    } catch (err) {
      if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
      console.error('POST /api/surveys failed:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
}

export default createSurveysHandler()
