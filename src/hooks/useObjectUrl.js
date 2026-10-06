import { useEffect, useMemo } from 'react'

// Blob URL for previewing a Blob, revoked when the Blob changes or the component unmounts.
export function useObjectUrl(blob) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(() => () => url && URL.revokeObjectURL(url), [url])
  return url
}
