import busboy from 'busboy'

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024 // Vercel rejects request bodies above 4.5 MB

export const isJpeg = (buffer) => buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff

// Reads { fields, photo } from a multipart request without touching req.body, so Vercel's
// lazy body parser leaves the raw stream alone.
export function parseMultipart(req, { maxPhotoBytes = MAX_PHOTO_BYTES } = {}) {
  return new Promise((resolve, reject) => {
    let parser
    try {
      parser = busboy({
        headers: req.headers,
        limits: { fileSize: maxPhotoBytes, files: 1, fields: 4, fieldSize: 64 * 1024 },
      })
    } catch {
      reject(new HttpError(400, 'Expected multipart/form-data'))
      return
    }

    const fields = {}
    let photo = null
    let photoTooLarge = false

    parser.on('field', (name, value, info) => {
      if (info.valueTruncated) reject(new HttpError(413, `Field ${name} is too large`))
      else fields[name] = value
    })
    parser.on('file', (name, stream) => {
      if (name !== 'photo') {
        stream.resume()
        return
      }
      const chunks = []
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('limit', () => { photoTooLarge = true })
      stream.on('end', () => { photo = Buffer.concat(chunks) })
    })
    parser.on('filesLimit', () => reject(new HttpError(400, 'Only one photo is allowed')))
    parser.on('error', (err) => reject(new HttpError(400, `Malformed multipart body: ${err.message}`)))
    parser.on('close', () => {
      if (photoTooLarge) reject(new HttpError(413, `Photo exceeds ${maxPhotoBytes} bytes`))
      else resolve({ fields, photo })
    })

    req.pipe(parser)
  })
}
