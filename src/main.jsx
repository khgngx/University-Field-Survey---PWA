import { defineCustomElements } from '@ionic/pwa-elements/loader'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'

// Web UI for Camera.getPhoto() in the browser; the native APK ignores it.
defineCustomElements(window)
registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
