import { useCallback, useEffect, useRef, useState } from 'react'
import { createDraft, getOrCreateDraft, saveDraft, submitDraft } from '../db/surveys'

const AUTOSAVE_DELAY_MS = 500

// Edits go to React state immediately and to IndexedDB after a 500 ms pause, so a refresh
// keeps the draft. Pending edits are also flushed when the tab is hidden or the page unloads.
export function useDraft() {
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState(null)
  const idRef = useRef(null)
  const pendingRef = useRef({})
  const timerRef = useRef(null)

  const flush = useCallback(async () => {
    clearTimeout(timerRef.current)
    timerRef.current = null
    const id = idRef.current
    const patch = pendingRef.current
    if (!id || Object.keys(patch).length === 0) return
    pendingRef.current = {}
    try {
      await saveDraft(id, patch)
    } catch (err) {
      // Put the edits back so the next flush retries them; newer edits win.
      pendingRef.current = { ...patch, ...pendingRef.current }
      setError(err)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    getOrCreateDraft()
      .then((loaded) => {
        if (cancelled) return
        idRef.current = loaded.id
        setDraft(loaded)
      })
      .catch((err) => !cancelled && setError(err))

    const onHidden = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', flush)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [flush])

  const update = useCallback(
    (patch) => {
      setDraft((current) => current && { ...current, ...patch })
      pendingRef.current = { ...pendingRef.current, ...patch }
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(flush, AUTOSAVE_DELAY_MS)
    },
    [flush],
  )

  // Queues the draft for sync, then swaps in a fresh blank draft. Rejects with
  // SurveyValidationError when required fields are missing.
  const submit = useCallback(async () => {
    await flush()
    const queued = await submitDraft(idRef.current)
    const next = await createDraft()
    idRef.current = next.id
    setDraft(next)
    return queued
  }, [flush])

  return { draft, update, submit, error }
}
