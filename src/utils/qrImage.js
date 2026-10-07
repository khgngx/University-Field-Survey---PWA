import QRCode from 'qrcode'

const QUIET_ZONE_MODULES = 4 // the spec's minimum white border; scanners need it

// Renders `text` as an opaque RGBA bitmap (black modules on white). Pure — no DOM — so it can be
// unit-tested in Node; the page wraps the result in ImageData to draw it on a canvas.
export function qrToPixels(text, { scale = 8, margin = QUIET_ZONE_MODULES, errorCorrectionLevel = 'M' } = {}) {
  const { size, data: modules } = QRCode.create(text, { errorCorrectionLevel }).modules
  const side = (size + margin * 2) * scale
  const data = new Uint8ClampedArray(side * side * 4).fill(255)
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!modules[row * size + col]) continue
      for (let y = 0; y < scale; y += 1) {
        const start = ((margin + row) * scale + y) * side + (margin + col) * scale
        for (let x = 0; x < scale; x += 1) {
          const i = (start + x) * 4
          data[i] = 0
          data[i + 1] = 0
          data[i + 2] = 0
        }
      }
    }
  }
  return { data, width: side, height: side }
}

const toAscii = (value) =>
  String(value).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')

// e.g. { building: 'A', floor: '3', room: 'A305' } -> "qr-A-3-A305.png"; safe on every file system.
export function qrFileName({ building, floor, room }) {
  const clean = (value) => toAscii(value).replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'x'
  return `qr-${[building, floor, room].map((v) => clean(v.trim())).join('-')}.png`
}
