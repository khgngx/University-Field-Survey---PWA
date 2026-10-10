# University-Field-Survey-PWA-Capacitor

VKU Field Survey — an offline-first PWA for collecting facility surveys (classrooms, projectors, AC,
electrical…) in basements and remote buildings with no Wi-Fi/4G, packaged as an Android APK with
Capacitor. Mini-Project 1.1, Cross-platform Programming.

**Stack:** React + Vite · Tailwind CSS · Dexie (IndexedDB) · Workbox (`injectManifest`) · Capacitor 8
(Camera, Network, Geolocation, Local Notifications, Barcode Scanner) · Vercel Serverless + Supabase.

## How it works

- **IndexedDB is the source of truth.** The UI only reads/writes locally; the server is just a sync target.
- **Drafts autosave** (500 ms debounce) and survive refreshes. Submitting queues the survey as
  `PENDING_SYNC` with a UUID and timestamp.
- **Sync engine** (`src/sync/queue.js`) sends surveys strictly one at a time, oldest first, with
  exponential backoff (`min(2^n × 5 s, 5 min)`, max 5 retries). Triggers: Capacitor `Network` listener,
  `window.online`, Service Worker Background Sync (Chromium only), a 30 s poll, and manual buttons.
  A Web Lock keeps the main thread and the Service Worker from syncing at the same time.
- **Idempotent server:** `POST /api/surveys` upserts by UUID, so retries and duplicate sends are safe.
- **Extras:** room QR codes (`building|floor|room`, e.g. `A|3|A305`) — scan with the camera, upload a saved
  QR image, or create new ones on the **Tạo QR** page; 24 h duplicate detection with survey versions,
  offline dashboard (Chart.js), local "synced N surveys" notification, GPS stamp.

## Room QR codes

A QR is plain text: `building|floor|room` (three non-empty parts, each up to 50 characters, no `|` inside;
spaces around the separator are ignored). Using the same printed code everywhere keeps room names identical,
which matters because duplicate detection compares the three values exactly (`A305` ≠ `a305`).

- **Create:** open **Tạo QR**, enter building / floor / room, then download the PNG (it includes a readable
  caption for printing) or use **Chia sẻ** where the browser supports sharing files.
- **Use:** in survey step 1, press **Quét QR phòng** (camera) or **Tải ảnh QR lên** (a saved image or screenshot).
  Both work offline, and a code that is not a room QR is rejected with a message.
- On the Android APK the web download link may not save files (WebView limitation, not yet handled);
  show the QR on screen, take a screenshot, or use Chia sẻ if available.

## Requirements

| Tool | Version | Needed for |
|---|---|---|
| Node.js | 22+ (developed on 24) | everything |
| JDK | **21** (not 25 — Gradle 8.14 / AGP 8.13 reject it) | Android build |
| Android SDK | platform 36, build-tools 36.0.0, platform-tools | Android build |

`scripts/build-apk.sh` picks JDK 21 automatically (`brew install openjdk@21`) and reads the SDK from
`$ANDROID_HOME` (default `~/Library/Android/sdk`).

## Getting started

```bash
npm install
cp .env.example .env   # see comments inside
npm run dev            # dev server (service worker registered; use `preview` to test offline reloads)
```

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build — use this to test offline |
| `npm test` | Unit tests (Vitest + fake-indexeddb) for the client and the API |
| `npm run lint` | Lint (oxlint) |
| `npm run build:apk` | Web build → `cap sync` → `gradlew assembleDebug` → `android/app/build/outputs/apk/debug/app-debug.apk` |

### Local demo (no Supabase needed)

Run the app and a local stand-in API in two terminals:

```bash
npm run dev:api   # http://localhost:3001 — real handler, in-memory storage
npm run dev       # http://localhost:5173 — /api is proxied to the stand-in
```

Open http://localhost:5173, fill a survey, then check what the "server" received at
http://localhost:3001/__dev/surveys. To see the offline queue, go offline, submit a few surveys (they
stay `PENDING_SYNC` on the *Hàng đợi* page), then go back online and watch them sync one by one.

> **Going offline for real:** use Airplane Mode, or DevTools → **Application → Service Workers → Offline**.
> DevTools → Network → Offline only blocks the *page*; the Service Worker's Background Sync (Chromium)
> can still upload, so the queue would drain even though the page looks offline.

`npm run build && npm run preview` (http://localhost:4173) is proxied the same way and is the place to test
the installed-PWA behaviour: the dev server does not precache the app shell, so reloading while offline only
works on the build. Stopping `dev:api` simulates a server failure (`FAILED` + backoff, retried automatically).
The stand-in loses its data on restart; to talk to the real API instead, set `VITE_API_URL` and add your dev
origin to `ALLOWED_ORIGINS` on the server. Alternatively put `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in
`.env`: `dev:api` then writes to the real database instead of memory.

In dev the browser console has `await seedSurveys(100)` (queue sample surveys), `await requeueSurveys()`
(send already-synced surveys again, e.g. after switching to the real database) and `await resetSurveys()`
(wipe local surveys).

## Deploy

### Vercel (primary: frontend + `/api`)

1. Import the GitHub repo; framework Vite, build `npm run build`, output `dist` (auto-detected).
2. Environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, optional `ALLOWED_ORIGINS`
   (e.g. `https://khgngx.github.io`) and `SUPABASE_BUCKET`. **Never** prefix these with `VITE_`.
3. Create the schema once: run `supabase/schema.sql` in the Supabase SQL editor (table, RLS, private bucket).

### GitHub Pages (secondary: frontend only)

1. Repo **Settings → Pages → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables**: add `VITE_API_URL` =
   `https://<your-app>.vercel.app/api`.
3. Add `https://khgngx.github.io` to `ALLOWED_ORIGINS` on Vercel (the Pages site calls the Vercel API cross-origin).
4. Push to `main`; `.github/workflows/deploy-gh-pages.yml` lints, tests, builds with
   `GITHUB_PAGES=true` (served under `/University-Field-Survey-PWA-Capacitor/`) and publishes. Without step 2's
   `VITE_API_URL` variable the workflow still runs as CI but skips the deploy job.

### Android APK

```bash
VITE_API_URL=https://<your-app>.vercel.app/api npm run build:apk
```

`VITE_API_URL` must be an absolute URL for the APK: inside the WebView a relative `/api` would resolve to
`https://localhost/api`. The API already allows the `https://localhost` origin. Open the project in
Android Studio with `npx cap open android` if you prefer a GUI.

## Differences from the original plan

- **Exhausted retries stay `FAILED`** (with no `nextRetryAt`) instead of returning to `PENDING_SYNC`,
  because `PENDING_SYNC` is auto-picked by the queue and would loop forever. "Thử lại" resets them.
- **HTTP 4xx (except 408/429) is permanent:** retrying an invalid payload cannot succeed, so the survey is
  `FAILED` immediately with the server's message; network errors, 5xx, 408 and 429 are retried.
- A network-level failure ends a sync run (the rest would fail the same way); an HTTP error does not
  block the surveys behind it. Surveys are sent one at a time, oldest first *among those that are due*: one
  waiting out its backoff does not hold up newer ones, so receive order is not strictly FIFO after a failure
  (the server upserts by UUID, so this is safe).
- The API has no user authentication (the assignment defines none). Input is fully validated and size-limited,
  but anyone who knows the URL can post surveys — add Supabase Auth or a per-user token before real use.

## Project layout

See `src/` — `db/` (Dexie + repository), `sync/` (engine, shared with the Service Worker), `services/`
(the only code that calls Capacitor), `hooks/`, `pages/`, `components/`, `utils/`; `api/` (Vercel function,
logic in `api/_lib/`); `supabase/schema.sql`; `android/` (generated by Capacitor).
