// Local stand-in for POST /api/surveys so the full offline -> sync flow can be demoed with no
// Supabase account. It runs the REAL handler (same validation, multipart parsing, idempotent
// upsert-by-id). Without credentials the storage backend is an in-memory fake and data is lost on
// restart; with SUPABASE_URL and SUPABASE_SERVICE_KEY in .env it writes to the real database.
import http from 'node:http'

const PORT = Number(process.env.DEV_API_PORT ?? 3001)
process.env.ALLOWED_ORIGINS ??= 'http://localhost:5173,http://localhost:4173'

const { createSurveysHandler } = await import('../api/_lib/surveysHandler.js')

const rows = new Map()
const photos = new Map()
const fakeSupabase = {
  storage: {
    from: () => ({
      upload: async (path, buffer) => {
        photos.set(path, buffer.length)
        return { error: null }
      },
    }),
  },
  from: () => ({
    upsert: async (row) => {
      rows.set(row.id, row)
      return { error: null }
    },
  }),
}
const useSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)
const handler = createSurveysHandler(useSupabase ? {} : { getSupabase: () => fakeSupabase })

// Vercel decorates Node's response with status()/json(); do the same here.
function decorate(res) {
  res.status = (code) => {
    res.statusCode = code
    return res
  }
  res.json = (payload) => {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(payload))
    return res
  }
  return res
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost')
  if (req.method === 'GET' && pathname === '/__dev/surveys') {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ count: rows.size, photos: photos.size, surveys: [...rows.values()] }, null, 2))
    return
  }
  if (pathname !== '/api/surveys') {
    res.statusCode = 404
    res.end('Not found')
    return
  }
  const before = rows.size
  await handler(req, decorate(res))
  if (req.method === 'POST') {
    const verb = rows.size > before ? 'stored' : 'updated/rejected'
    const detail = useSupabase ? 'Supabase' : `${verb}; total ${rows.size}`
    console.log(`[dev-api] POST /api/surveys -> ${res.statusCode} (${detail})`)
  }
})

server.listen(PORT, () => {
  const storage = useSupabase ? 'storage: Supabase (real database)' : 'storage: in-memory, inspect: /__dev/surveys'
  console.log(`[dev-api] listening on http://localhost:${PORT}  (${storage})`)
})
