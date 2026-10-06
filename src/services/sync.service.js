import { recoverStuckSyncing, runSyncQueue } from '../sync/queue'
import { getNetworkStatus, onNetworkChange } from './network.service'
import { notifySynced } from './notify.service'

const POLL_INTERVAL_MS = 30_000
const BACKGROUND_SYNC_TAG = 'sync-surveys'

// Background Sync only exists in Chromium PWAs (not Safari, not the Android WebView), so it is
// an enhancement on top of the main-thread triggers below, never the only path.
async function registerBackgroundSync() {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.ready
  if ('sync' in registration) await registration.sync.register(BACKGROUND_SYNC_TAG)
}

// Flush the queue now if online; otherwise ask the browser to do it once connectivity returns.
export async function requestSync() {
  registerBackgroundSync().catch((err) => console.warn('Background Sync unavailable:', err.message))
  const { connected } = await getNetworkStatus()
  if (!connected) return { ran: false, synced: 0, failed: 0 }
  const summary = await runSyncQueue()
  if (summary.synced > 0) {
    notifySynced(summary.synced).catch((err) => console.warn('Could not show sync notification:', err.message))
  }
  return summary
}

// Starts every main-thread trigger: Network plugin (PWA + APK), window 'online', a 30 s poll
// as a graceful-degradation fallback, and one pass at startup. Returns a stop function.
export function startSyncTriggers() {
  let stopped = false
  let stopNetworkListener = () => {}

  const trigger = () => {
    requestSync().catch((err) => console.error('Sync run failed:', err))
  }

  recoverStuckSyncing()
    .then(trigger)
    .catch((err) => console.error('Could not recover interrupted syncs:', err))

  window.addEventListener('online', trigger)
  const interval = setInterval(trigger, POLL_INTERVAL_MS)
  onNetworkChange((status) => status.connected && trigger()).then((off) => {
    if (stopped) off()
    else stopNetworkListener = off
  })

  return () => {
    stopped = true
    window.removeEventListener('online', trigger)
    clearInterval(interval)
    stopNetworkListener()
  }
}
