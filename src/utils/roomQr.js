// Room QR payload: "building|floor|room", e.g. "A|3|A305".
export function parseRoomQr(text) {
  const parts = String(text ?? '').split('|').map((part) => part.trim())
  if (parts.length !== 3 || parts.some((part) => part === '')) {
    throw new Error(`QR không đúng định dạng "toà|tầng|phòng": ${String(text).slice(0, 60)}`)
  }
  const [building, floor, room] = parts
  return { building, floor, room }
}
