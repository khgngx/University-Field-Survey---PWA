const BASE_DELAY_MS = 5_000
const MAX_DELAY_MS = 5 * 60_000

// delay = min(2^retryCount × 5s, 5 min)
export function getBackoffDelayMs(retryCount) {
  if (!Number.isInteger(retryCount) || retryCount < 0) {
    throw new RangeError(`retryCount must be a non-negative integer, got ${retryCount}`)
  }
  return Math.min(2 ** retryCount * BASE_DELAY_MS, MAX_DELAY_MS)
}

export function computeNextRetryAt(retryCount, now = Date.now()) {
  return now + getBackoffDelayMs(retryCount)
}
