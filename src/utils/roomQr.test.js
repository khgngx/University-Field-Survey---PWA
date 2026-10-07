import { describe, expect, it } from 'vitest'
import { formatRoomQr, parseRoomQr } from './roomQr'

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

describe('parseRoomQr limits', () => {
  it('rejects a part longer than the server accepts', () => {
    expect(() => parseRoomQr(`A|3|${'x'.repeat(51)}`)).toThrow(/QR không đúng định dạng/)
    expect(parseRoomQr(`A|3|${'x'.repeat(50)}`).room).toHaveLength(50)
  })
})

describe('formatRoomQr', () => {
  it('joins trimmed parts with the separator', () => {
    expect(formatRoomQr({ building: ' A ', floor: '3', room: 'A305' })).toBe('A|3|A305')
  })

  it('round-trips through parseRoomQr, including Vietnamese and negative floors', () => {
    for (const location of [
      { building: 'A', floor: '3', room: 'A305' },
      { building: 'Hầm', floor: '-1', room: 'H01' },
      { building: 'Toà nhà Đa năng', floor: '12', room: 'P.1203 (Lab)' },
    ]) {
      expect(parseRoomQr(formatRoomQr(location))).toEqual(location)
    }
  })

  it('names the field that is missing, too long, or contains the separator', () => {
    expect(() => formatRoomQr({ building: '', floor: '3', room: 'A305' })).toThrow('Chưa nhập Toà nhà')
    expect(() => formatRoomQr({ building: 'A', floor: '  ', room: 'A305' })).toThrow('Chưa nhập Tầng')
    expect(() => formatRoomQr({ building: 'A', floor: '3' })).toThrow('Chưa nhập Phòng')
    expect(() => formatRoomQr({ building: 'A', floor: '3', room: 'x'.repeat(51) })).toThrow(/Phòng tối đa 50/)
    expect(() => formatRoomQr({ building: 'A|B', floor: '3', room: 'A305' })).toThrow(/Toà nhà không được chứa/)
  })
})
