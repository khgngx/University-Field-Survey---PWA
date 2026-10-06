import { Network } from '@capacitor/network'

export function getNetworkStatus() {
  return Network.getStatus()
}

// Resolves to an unsubscribe function.
export async function onNetworkChange(callback) {
  const handle = await Network.addListener('networkStatusChange', callback)
  return () => handle.remove()
}
