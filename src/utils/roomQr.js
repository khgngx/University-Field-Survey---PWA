import { MAX_LOCATION_LENGTH } from './limits'

// Room QR payload: "building|floor|room", e.g. "A|3|A305".
const SEPARATOR = '|'
const LABELS = ['Toà nhà', 'Tầng', 'Phòng']

export function parseRoomQr(text) {
  const parts = String(text ?? '').split(SEPARATOR).map((part) => part.trim())
  if (parts.length !== 3 || parts.some((part) => part === '' || part.length > MAX_LOCATION_LENGTH)) {
    throw new Error(`QR không đúng định dạng "toà|tầng|phòng": ${String(text).slice(0, 60)}`)
  }
  const [building, floor, room] = parts
  return { building, floor, room }
}

// Inverse of parseRoomQr, with messages meant for the person filling the QR generator form.
export function formatRoomQr({ building, floor, room }) {
  const parts = [building, floor, room].map((value) => String(value ?? '').trim())
  parts.forEach((part, i) => {
    if (part === '') throw new Error(`Chưa nhập ${LABELS[i]}`)
    if (part.length > MAX_LOCATION_LENGTH) throw new Error(`${LABELS[i]} tối đa ${MAX_LOCATION_LENGTH} ký tự`)
    if (part.includes(SEPARATOR)) throw new Error(`${LABELS[i]} không được chứa dấu "${SEPARATOR}"`)
  })
  return parts.join(SEPARATOR)
}
