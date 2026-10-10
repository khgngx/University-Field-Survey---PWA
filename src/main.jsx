import { defineCustomElements } from '@ionic/pwa-elements/loader'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'

// Web UI for Camera.getPhoto() in the browser; the native APK ignores it.
defineCustomElements(window)
registerSW({ immediate: true })

// Dev console helpers, stripped from production builds: `await seedSurveys(100)` queues sample
// surveys; `await resetSurveys()` wipes local surveys and reloads so the wizard gets a fresh draft;
// `await requeueSurveys()` sends already-synced surveys again (after pointing the API elsewhere).
if (import.meta.env.DEV) {
  window.seedSurveys = async (...args) => (await import('./dev/seedSurveys.js')).seedSurveys(...args)
  window.requeueSurveys = async () => {
    const requeued = await (await import('./dev/seedSurveys.js')).requeueSynced()
    await (await import('./services/sync.service')).requestSync()
    return requeued
  }
  window.resetSurveys = async () => {
    await (await import('./dev/seedSurveys.js')).clearSurveys()
    window.location.reload()
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
