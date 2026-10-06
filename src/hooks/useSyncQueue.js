import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { db } from '../db/database'
import { STATUS } from '../utils/constants'

export function countByStatus(surveys) {
  const counts = Object.fromEntries(Object.values(STATUS).map((status) => [status, 0]))
  for (const survey of surveys) counts[survey.status] += 1
  return counts
}

// Live view of every queued/synced survey (drafts excluded), newest first, plus per-status counts.
// Photo blobs are dropped so list renders stay light.
export function useSyncQueue() {
  const [state, setState] = useState({ ready: false, surveys: [], counts: countByStatus([]), error: null })

  useEffect(() => {
    const subscription = liveQuery(async () => {
      const all = await db.surveys.orderBy('createdAt').reverse().toArray()
      return all
        .filter((s) => s.status !== STATUS.DRAFT)
        .map(({ photoBlob, ...rest }) => ({ ...rest, hasPhoto: Boolean(photoBlob) }))
    }).subscribe({
      next: (surveys) => setState({ ready: true, surveys, counts: countByStatus(surveys), error: null }),
      error: (error) => setState((prev) => ({ ...prev, ready: true, error })),
    })
    return () => subscription.unsubscribe()
  }, [])

  return state
}
