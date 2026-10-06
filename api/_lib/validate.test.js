import { describe, expect, it } from 'vitest'
import { validatePayload } from './validate.js'

const valid = {
  id: '3f2b8c1e-5a47-4d0e-9a3b-0c1d2e3f4a5b',
  building: ' A ',
  floor: '3',
  room: 'A305',
  category: 'AC',
  rating: 4,
  createdAt: 1_700_000_000_000,
}

describe('validatePayload', () => {
  it('accepts a minimal valid payload and applies defaults', () => {
    const result = validatePayload(valid)
    expect(result.ok).toBe(true)
    expect(result.value).toMatchObject({ building: 'A', defectNotes: '', gps: null, version: 1 })
  })

  it('lower-cases the id so upserts match regardless of client casing', () => {
    expect(validatePayload({ ...valid, id: valid.id.toUpperCase() }).value.id).toBe(valid.id)
  })

  it('accepts gps with and without accuracy', () => {
    expect(validatePayload({ ...valid, gps: { lat: 16.07, lng: 108.15 } }).value.gps).toEqual({ lat: 16.07, lng: 108.15, accuracy: null })
    expect(validatePayload({ ...valid, gps: { lat: 16.07, lng: 108.15, accuracy: 12 } }).value.gps.accuracy).toBe(12)
  })

  it.each([
    ['non-object', 'x'],
    ['array', []],
    ['null', null],
  ])('rejects %s', (_label, input) => {
    expect(validatePayload(input).ok).toBe(false)
  })

  it.each([
    ['id', { id: 'not-a-uuid' }],
    ['empty building', { building: '  ' }],
    ['long room', { room: 'x'.repeat(51) }],
    ['category', { category: 'Plumbing' }],
    ['rating 0', { rating: 0 }],
    ['rating 6', { rating: 6 }],
    ['rating fraction', { rating: 3.5 }],
    ['rating string', { rating: '4' }],
    ['notes too long', { defectNotes: 'x'.repeat(2001) }],
    ['notes not string', { defectNotes: 5 }],
    ['version 0', { version: 0 }],
    ['createdAt string', { createdAt: '2024-01-01' }],
    ['createdAt zero', { createdAt: 0 }],
    ['gps lat range', { gps: { lat: 91, lng: 0 } }],
    ['gps lng range', { gps: { lat: 0, lng: 181 } }],
    ['gps NaN', { gps: { lat: Number.NaN, lng: 0 } }],
    ['gps negative accuracy', { gps: { lat: 0, lng: 0, accuracy: -1 } }],
  ])('rejects invalid %s', (_label, override) => {
    const result = validatePayload({ ...valid, ...override })
    expect(result.ok).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('reports every problem at once', () => {
    expect(validatePayload({}).errors.length).toBeGreaterThanOrEqual(5)
  })
})
