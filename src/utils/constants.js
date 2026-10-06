export { CATEGORIES } from './categories'

export const STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING_SYNC: 'PENDING_SYNC',
  SYNCING: 'SYNCING',
  SYNCED: 'SYNCED',
  FAILED: 'FAILED',
})

export const MAX_RETRY = 5

// Relative on Vercel (same origin). The GitHub Pages build and the Capacitor APK
// must set VITE_API_URL to an absolute URL — see .env.example.
export const API_URL = import.meta.env.VITE_API_URL || '/api'
