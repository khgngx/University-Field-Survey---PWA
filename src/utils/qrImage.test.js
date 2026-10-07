import { describe, expect, it } from 'vitest'
import { decodeQrPixels } from './qrDecode'
import { qrFileName, qrToPixels } from './qrImage'
import { formatRoomQr, parseRoomQr } from './roomQr'

describe('qrToPixels', () => {
  it('returns a square opaque RGBA bitmap with a white quiet zone', () => {
    const { data, width, height } = qrToPixels('A|3|A305', { scale: 4 })
    expect(width).toBe(height)
    expect(data).toHaveLength(width * height * 4)
    expect([data[0], data[1], data[2], data[3]]).toEqual([255, 255, 255, 255]) // top-left corner = margin
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) throw new Error('found a non-opaque pixel')
  })

  it('uses only black and white', () => {
    const { data } = qrToPixels('A|3|A305', { scale: 2 })
    for (let i = 0; i < data.length; i += 4) {
      const v = data[i]
      if ((v !== 0 && v !== 255) || data[i + 1] !== v || data[i + 2] !== v) throw new Error(`unexpected colour at ${i}`)
    }
  })
})

describe('generate -> decode round trip (qrcode + jsqr)', () => {
  const locations = [
    { building: 'A', floor: '3', room: 'A305' },
    { building: 'Hầm', floor: '-1', room: 'H01' },
    { building: 'Toà nhà Đa năng', floor: '12', room: 'P.1203 (Lab)' },
    { building: 'B'.repeat(50), floor: '9'.repeat(50), room: 'R'.repeat(50) }, // longest payload the app allows
  ]

  it.each(locations)('reads back %j exactly', (location) => {
    const text = formatRoomQr(location)
    const decoded = decodeQrPixels(qrToPixels(text))
    expect(decoded).toBe(text)
    expect(parseRoomQr(decoded)).toEqual(location)
  })

  it('still decodes at a small print scale', () => {
    expect(decodeQrPixels(qrToPixels('A|3|A305', { scale: 3 }))).toBe('A|3|A305')
  })

  it('decodes a colour-inverted code (white on black)', () => {
    const pixels = qrToPixels('A|3|A305', { scale: 6 })
    for (let i = 0; i < pixels.data.length; i += 4) {
      const flipped = 255 - pixels.data[i]
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = flipped
    }
    expect(decodeQrPixels(pixels)).toBe('A|3|A305')
  })

  it('returns null for an image with no QR code', () => {
    const blank = { data: new Uint8ClampedArray(200 * 200 * 4).fill(255), width: 200, height: 200 }
    expect(decodeQrPixels(blank)).toBeNull()
  })

  it('decodes foreign content too, leaving format checks to parseRoomQr', () => {
    const text = 'https://example.com'
    const decoded = decodeQrPixels(qrToPixels(text))
    expect(decoded).toBe(text)
    expect(() => parseRoomQr(decoded)).toThrow(/QR không đúng định dạng/)
  })
})

describe('qrFileName', () => {
  it('builds a file-system-safe ASCII name', () => {
    expect(qrFileName({ building: 'A', floor: '3', room: 'A305' })).toBe('qr-A-3-A305.png')
    expect(qrFileName({ building: 'Hầm', floor: '-1', room: 'H 01/B' })).toBe('qr-Ham--1-H_01_B.png')
    expect(qrFileName({ building: 'Đa năng', floor: '2', room: 'P.2' })).toBe('qr-Da_nang-2-P_2.png')
  })

  it('never produces an empty segment', () => {
    expect(qrFileName({ building: '???', floor: '1', room: '2' })).toBe('qr-x-1-2.png')
  })
})
