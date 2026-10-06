import { describe, expect, it } from 'vitest'
import { computeNextRetryAt, getBackoffDelayMs } from './backoff'

describe('getBackoffDelayMs', () => {
  it('doubles from 5s per retry', () => {
    expect([0, 1, 2, 3].map(getBackoffDelayMs)).toEqual([5_000, 10_000, 20_000, 40_000])
  })

  it('caps at 5 minutes', () => {
    expect(getBackoffDelayMs(6)).toBe(300_000)
    expect(getBackoffDelayMs(50)).toBe(300_000)
  })

  it('rejects negative or non-integer retry counts', () => {
    expect(() => getBackoffDelayMs(-1)).toThrow(RangeError)
    expect(() => getBackoffDelayMs(1.5)).toThrow(RangeError)
    expect(() => getBackoffDelayMs(Number.NaN)).toThrow(RangeError)
  })
})

describe('computeNextRetryAt', () => {
  it('adds the backoff delay to the given clock', () => {
    expect(computeNextRetryAt(2, 1_000)).toBe(21_000)
  })
})
