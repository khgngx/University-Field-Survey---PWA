import { clientsClaim } from 'workbox-core'
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { runSyncQueue } from './sync/queue'

self.skipWaiting()
clientsClaim()

// App Shell (HTML/CSS/JS/fonts/icons): precached, served Cache-First.
const manifest = self.__WB_MANIFEST
precacheAndRoute(manifest)

// HashRouter keeps every route on index.html, so one fallback covers all navigations.
// The dev server injects an empty manifest; binding to a URL that is not precached would throw
// and kill the whole worker, so only register the fallback when index.html is really there.
const hasAppShell = manifest.some((entry) => (typeof entry === 'string' ? entry : entry.url) === 'index.html')
if (hasAppShell) registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// Background Sync (Chromium only): flush the queue even when the app tab is closed. The Web
// Lock inside runSyncQueue keeps this from racing the main-thread sync; a rejection makes
// the browser retry the sync event later.
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-surveys') event.waitUntil(runSyncQueue())
})
