import { describe, expect, it } from 'vitest'
import { parseRoomQr } from './roomQr'

describe('parseRoomQr', () => {
  it('splits building|floor|room and trims whitespace', () => {
    expect(parseRoomQr('A|3|A305')).toEqual({ building: 'A', floor: '3', room: 'A305' })
    expect(parseRoomQr(' B | 1 | B101 ')).toEqual({ building: 'B', floor: '1', room: 'B101' })
  })

  it.each(['', 'A|3', 'A|3|A305|extra', 'A||A305', '|3|A305', 'https://example.com', null, undefined])(
    'rejects malformed payload %j',
    (input) => {
      expect(() => parseRoomQr(input)).toThrow(/QR không đúng định dạng/)
    },
  )
})
