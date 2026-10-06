import { useEffect, useState } from 'react'
import { getNetworkStatus, onNetworkChange } from '../services/network.service'

export function useNetworkStatus() {
  const [connected, setConnected] = useState(true)

  useEffect(() => {
    let cancelled = false
    let unsubscribe = () => {}

    getNetworkStatus().then((status) => {
      if (!cancelled) setConnected(status.connected)
    })
    onNetworkChange((status) => setConnected(status.connected)).then((off) => {
      if (cancelled) off()
      else unsubscribe = off
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return connected
}
