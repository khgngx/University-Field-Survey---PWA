import { Geolocation } from '@capacitor/geolocation'

const TIMEOUT_MS = 5_000

// Resolves to { lat, lng, accuracy } or null. Never rejects and never blocks longer than the
// timeout: a missing GPS fix must not stop a survey from being submitted. The hard race below
// covers the browser permission prompt, which the native `timeout` option does not count.
export async function getCurrentPosition({ timeout = TIMEOUT_MS } = {}) {
  const position = Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout })
  const deadline = new Promise((resolve) => setTimeout(resolve, timeout + 1_000, null))
  try {
    const fix = await Promise.race([position, deadline])
    if (!fix) {
      console.warn('GPS timed out, submitting without location')
      return null
    }
    return { lat: fix.coords.latitude, lng: fix.coords.longitude, accuracy: fix.coords.accuracy }
  } catch (err) {
    console.warn('GPS unavailable, submitting without location:', err.message)
    return null
  }
}
