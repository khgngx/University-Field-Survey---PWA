export function fitWithin(width, height, maxSize) {
  const longest = Math.max(width, height)
  if (longest <= maxSize) return { width, height }
  const scale = maxSize / longest
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

// Downscale and re-encode as JPEG to keep IndexedDB small and uploads fast.
export async function compressImage(blob, { maxSize = 1280, quality = 0.7 } = {}) {
  const bitmap = await createImageBitmap(blob)
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSize)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context is unavailable; cannot compress image')
    ctx.drawImage(bitmap, 0, 0, width, height)
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (out) => (out ? resolve(out) : reject(new Error('Image compression failed: canvas.toBlob returned null'))),
        'image/jpeg',
        quality,
      )
    })
  } finally {
    bitmap.close()
  }
}
