import { Readable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import { createSurveysHandler } from './surveysHandler.js'

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])
const survey = {
  id: '3f2b8c1e-5a47-4d0e-9a3b-0c1d2e3f4a5b',
  building: 'A',
  floor: '3',
  room: 'A305',
  category: 'AC',
  rating: 4,
  createdAt: 1_700_000_000_000,
}

// Build a real multipart request body with the platform FormData encoder.
async function multipartRequest({ metadata = survey, omitMetadata = false, photo, method = 'POST', origin } = {}) {
  const form = new FormData()
  if (!omitMetadata) form.append('metadata', typeof metadata === 'string' ? metadata : JSON.stringify(metadata))
  if (photo) form.append('photo', new Blob([photo], { type: 'image/jpeg' }), 'p.jpg')
  const encoded = new Response(form)
  const body = Buffer.from(await encoded.arrayBuffer())
  const req = Readable.from([body])
  req.method = method
  req.headers = { 'content-type': encoded.headers.get('content-type'), ...(origin && { origin }) }
  return req
}

function fakeRes() {
  const res = { headers: {}, statusCode: null, body: null }
  res.setHeader = (k, v) => { res.headers[k] = v }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (payload) => { res.body = payload; return res }
  res.end = () => res
  return res
}

function fakeSupabase({ uploadError = null, upsertError = null } = {}) {
  const upload = vi.fn(async () => ({ error: uploadError }))
  const upsert = vi.fn(async () => ({ error: upsertError }))
  const client = { storage: { from: vi.fn(() => ({ upload })) }, from: vi.fn(() => ({ upsert })) }
  return { client, upload, upsert }
}

const run = async (request, supabase = fakeSupabase()) => {
  const handler = createSurveysHandler({ getSupabase: () => supabase.client, now: () => new Date('2026-01-01T00:00:00Z') })
  const res = fakeRes()
  await handler(request, res)
  return res
}

describe('POST /api/surveys', () => {
  it('stores the photo then upserts the row, returning id and syncedAt', async () => {
    const supabase = fakeSupabase()
    const res = await run(await multipartRequest({ photo: JPEG }), supabase)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ id: survey.id, syncedAt: '2026-01-01T00:00:00.000Z' })
    expect(supabase.upload).toHaveBeenCalledWith(`surveys/${survey.id}.jpg`, expect.any(Buffer), { contentType: 'image/jpeg', upsert: true })
    expect(supabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: survey.id, photo_path: `surveys/${survey.id}.jpg`, rating: 4, created_at: '2023-11-14T22:13:20.000Z' }),
      { onConflict: 'id' },
    )
    expect(supabase.upload.mock.invocationCallOrder[0]).toBeLessThan(supabase.upsert.mock.invocationCallOrder[0])
  })

  it('works without a photo and stores a null photo_path', async () => {
    const supabase = fakeSupabase()
    const res = await run(await multipartRequest(), supabase)
    expect(res.statusCode).toBe(200)
    expect(supabase.upload).not.toHaveBeenCalled()
    expect(supabase.upsert.mock.calls[0][0].photo_path).toBeNull()
  })

  it('is idempotent: sending the same survey twice upserts by id both times', async () => {
    const supabase = fakeSupabase()
    await run(await multipartRequest({ photo: JPEG }), supabase)
    await run(await multipartRequest({ photo: JPEG }), supabase)
    expect(supabase.upsert.mock.calls.map(([row]) => row.id)).toEqual([survey.id, survey.id])
    expect(supabase.upsert.mock.calls.every(([, opts]) => opts.onConflict === 'id')).toBe(true)
  })

  it('rejects invalid metadata with 400 and writes nothing', async () => {
    const supabase = fakeSupabase()
    const res = await run(await multipartRequest({ metadata: { ...survey, rating: 9 } }), supabase)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/rating/)
    expect(supabase.upsert).not.toHaveBeenCalled()
  })

  it('rejects non-JSON metadata and a missing metadata part', async () => {
    expect((await run(await multipartRequest({ metadata: '{oops' }))).statusCode).toBe(400)
    expect((await run(await multipartRequest({ omitMetadata: true }))).statusCode).toBe(400)
  })

  it('rejects a photo that is not a JPEG', async () => {
    const res = await run(await multipartRequest({ photo: Buffer.from('<html>not an image</html>') }))
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/JPEG/)
  })

  it('rejects an oversized photo with 413', async () => {
    const big = Buffer.concat([JPEG, Buffer.alloc(4 * 1024 * 1024 + 1)])
    expect((await run(await multipartRequest({ photo: big }))).statusCode).toBe(413)
  })

  it('rejects a non-multipart body', async () => {
    const req = Readable.from(['{}'])
    req.method = 'POST'
    req.headers = { 'content-type': 'application/json' }
    expect((await run(req)).statusCode).toBe(400)
  })

  it('returns 500 without leaking internals when storage or the database fails', async () => {
    const storage = await run(await multipartRequest({ photo: JPEG }), fakeSupabase({ uploadError: { message: 'secret bucket detail' } }))
    const db = await run(await multipartRequest(), fakeSupabase({ upsertError: { message: 'secret table detail' } }))
    for (const res of [storage, db]) {
      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({ error: 'Internal server error' })
    }
  })

  it('returns 500 when the server is not configured', async () => {
    const handler = createSurveysHandler({ getSupabase: () => { throw new Error('Server misconfigured') } })
    const res = fakeRes()
    await handler(await multipartRequest(), res)
    expect(res.statusCode).toBe(500)
  })

  it('rejects other methods with 405 and answers OPTIONS preflight', async () => {
    const get = await run(await multipartRequest({ method: 'GET' }))
    expect(get.statusCode).toBe(405)
    expect(get.headers.Allow).toBe('POST, OPTIONS')
    expect((await run(await multipartRequest({ method: 'OPTIONS' }))).statusCode).toBe(204)
  })
})

describe('CORS', () => {
  it('allows the Capacitor WebView origin', async () => {
    const res = await run(await multipartRequest({ origin: 'https://localhost' }))
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://localhost')
  })

  it('does not grant access to unknown origins', async () => {
    const res = await run(await multipartRequest({ origin: 'https://evil.example' }))
    expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined()
  })
})
