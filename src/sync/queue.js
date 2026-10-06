// Sync engine core. Deliberately free of Capacitor/DOM imports so it also runs inside the
// Service Worker ('sync' event) as well as on the main thread.
import { db } from '../db/database'
import { computeNextRetryAt } from '../utils/backoff'
import { API_URL, MAX_RETRY, STATUS } from '../utils/constants'

export const SYNC_LOCK_NAME = 'sync-surveys'
const REQUEST_TIMEOUT_MS = 30_000
// Only these fields leave the device; sync bookkeeping (status, retries) stays local.
const UPLOAD_FIELDS = ['id', 'building', 'floor', 'room', 'category', 'rating', 'defectNotes', 'gps', 'version', 'createdAt']

export class SyncHttpError extends Error {
  constructor(status, detail) {
    super(`Server responded ${status}${detail ? `: ${detail}` : ''}`)
    this.name = 'SyncHttpError'
    this.status = status
  }
}

// Network failures and timeouts (no HTTP status), 5xx, 408 and 429 are worth retrying.
// Other 4xx mean the server rejected the payload itself — retrying cannot help.
export function isRetryable(err) {
  if (!(err instanceof SyncHttpError)) return true
  return err.status >= 500 || err.status === 408 || err.status === 429
}

export async function sendSurvey(survey, { fetchImpl = fetch, apiUrl = API_URL, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const metadata = Object.fromEntries(UPLOAD_FIELDS.filter((f) => survey[f] !== undefined).map((f) => [f, survey[f]]))
  const form = new FormData()
  form.append('metadata', JSON.stringify(metadata))
  if (survey.photoBlob) form.append('photo', survey.photoBlob, `${survey.id}.jpg`)

  const response = await fetchImpl(`${apiUrl}/surveys`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 200)
    throw new SyncHttpError(response.status, detail)
  }
  return response.json()
}

// PENDING_SYNC always; FAILED only once its backoff has elapsed. FAILED records without a
// nextRetryAt are exhausted/permanent and wait for the user's "Thử lại".
export async function selectDue(now) {
  const [pending, failed] = await Promise.all([
    db.surveys.where('status').equals(STATUS.PENDING_SYNC).toArray(),
    db.surveys.where('status').equals(STATUS.FAILED).toArray(),
  ])
  const retryable = failed.filter((s) => s.nextRetryAt != null && s.nextRetryAt <= now)
  return [...pending, ...retryable].sort((a, b) => a.createdAt - b.createdAt)
}

const logAttempt = (surveyId, result, timestamp) =>
  db.syncLog.add({ surveyId, action: 'SYNC', timestamp, result })

async function syncOne(survey, send, now) {
  await db.surveys.update(survey.id, { status: STATUS.SYNCING, updatedAt: now() })
  try {
    await send(survey)
    const syncedAt = now()
    await db.surveys.update(survey.id, {
      status: STATUS.SYNCED,
      syncedAt,
      updatedAt: syncedAt,
      lastError: null,
      nextRetryAt: null,
    })
    await logAttempt(survey.id, 'OK', syncedAt)
    return { ok: true }
  } catch (error) {
    const failedAt = now()
    const retryCount = (survey.retryCount ?? 0) + 1
    const exhausted = !isRetryable(error) || retryCount >= MAX_RETRY
    await db.surveys.update(survey.id, {
      status: STATUS.FAILED,
      retryCount,
      lastError: error.message,
      nextRetryAt: exhausted ? null : computeNextRetryAt(retryCount, failedAt),
      updatedAt: failedAt,
    })
    await logAttempt(survey.id, `FAILED: ${error.message}`, failedAt)
    return { ok: false, error }
  }
}

const NOT_RUN = Object.freeze({ ran: false, synced: 0, failed: 0 })
let inProcessLock = false

// Web Locks makes the main thread and the Service Worker mutually exclusive. Without it
// (old WebViews) fall back to a per-context flag; server-side upsert-by-UUID covers the rest.
async function withSyncLock(task) {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(SYNC_LOCK_NAME, { ifAvailable: true }, (lock) => (lock ? task() : NOT_RUN))
  }
  if (inProcessLock) return NOT_RUN
  inProcessLock = true
  try {
    return await task()
  } finally {
    inProcessLock = false
  }
}

// Sends due surveys strictly one at a time, oldest first. A rejected survey (HTTP error)
// does not block the ones behind it; a network-level failure ends the run since the
// rest would fail the same way.
export function runSyncQueue({ send = sendSurvey, now = Date.now } = {}) {
  return withSyncLock(async () => {
    const summary = { ran: true, synced: 0, failed: 0 }
    for (const survey of await selectDue(now())) {
      const outcome = await syncOne(survey, send, now)
      if (outcome.ok) {
        summary.synced += 1
        continue
      }
      summary.failed += 1
      if (!(outcome.error instanceof SyncHttpError)) break
    }
    return summary
  })
}

// Manual "Thử lại": give an exhausted/permanent FAILED survey a fresh set of retries.
export async function retrySurvey(id, now = Date.now()) {
  const updated = await db.surveys
    .where('id')
    .equals(id)
    .and((s) => s.status === STATUS.FAILED)
    .modify({ status: STATUS.PENDING_SYNC, retryCount: 0, nextRetryAt: null, lastError: null, updatedAt: now })
  return updated > 0
}

export function retryAllFailed(now = Date.now()) {
  return db.surveys
    .where('status')
    .equals(STATUS.FAILED)
    .modify({ status: STATUS.PENDING_SYNC, retryCount: 0, nextRetryAt: null, lastError: null, updatedAt: now })
}

// At startup: a SYNCING record means the app died mid-request, so queue it again.
export function recoverStuckSyncing(now = Date.now()) {
  return db.surveys.where('status').equals(STATUS.SYNCING).modify({ status: STATUS.PENDING_SYNC, updatedAt: now })
}
