import jsQR from 'jsqr'
import { fitWithin } from './image'

// Longest image side to try, largest first: a QR that is small inside a big photo needs the
// resolution, while a smaller copy is faster and tolerates noise better.
const ATTEMPT_SIDES = [2000, 1000]

// Returns the decoded text, or null when the bitmap holds no readable QR code.
export function decodeQrPixels({ data, width, height }) {
  return jsQR(data, width, height, { inversionAttempts: 'attemptBoth' })?.data ?? null
}

export async function decodeQrFromImageFile(file) {
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('Không đọc được file này. Hãy chọn một ảnh (PNG, JPG…).')
  }
  try {
    const tried = new Set()
    for (const maxSide of ATTEMPT_SIDES) {
      const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide)
      if (tried.has(width)) continue
      tried.add(width)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('Canvas 2D context is unavailable; cannot read the image')
      // Transparent pixels read as black, which would swallow a QR saved as a transparent PNG.
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(bitmap, 0, 0, width, height)
      const text = decodeQrPixels(ctx.getImageData(0, 0, width, height))
      if (text) return text
    }
    throw new Error('Không tìm thấy mã QR trong ảnh. Hãy dùng ảnh rõ nét, chụp thẳng vào mã.')
  } finally {
    bitmap.close()
  }
}
