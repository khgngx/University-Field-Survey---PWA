import { Suspense, lazy, useEffect } from 'react'
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import Icon from './components/Icon.jsx'
import NetworkBanner from './components/NetworkBanner.jsx'
import QueuePage from './pages/QueuePage.jsx'
import SurveyWizard from './pages/SurveyWizard'
import { startSyncTriggers } from './services/sync.service'

// Chart.js and the QR encoder are only needed on these pages; the Service Worker still precaches
// their chunks, so both work offline.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const QrGenerator = lazy(() => import('./pages/QrGenerator.jsx'))

const NAV_ITEMS = [
  { to: '/', end: true, label: 'Khảo sát', icon: 'survey' },
  { to: '/queue', label: 'Hàng đợi', icon: 'queue' },
  { to: '/dashboard', label: 'Thống kê', icon: 'stats' },
  { to: '/qr', label: 'Tạo QR', icon: 'qr' },
]

const navClass = ({ isActive }) =>
  `flex flex-1 flex-col items-center gap-1 py-1 text-xs font-medium ${isActive ? 'text-ink' : 'text-muted'}`

export default function App() {
  useEffect(() => startSyncTriggers(), [])

  return (
    <HashRouter>
      <div className="min-h-screen bg-canvas pt-[env(safe-area-inset-top)] text-ink">
        <NetworkBanner />
        <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
          <Suspense fallback={<p className="text-muted">Đang tải…</p>}>
            <Routes>
              <Route path="/" element={<SurveyWizard />} />
              <Route path="/queue" element={<QueuePage />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/qr" element={<QrGenerator />} />
            </Routes>
          </Suspense>
        </main>
        <footer className="fixed inset-x-0 bottom-0 z-10 rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
          <nav className="mx-auto flex max-w-2xl px-2 py-2">
            {NAV_ITEMS.map(({ to, end, label, icon }) => (
              <NavLink key={to} to={to} end={end} className={navClass}>
                {({ isActive }) => (
                  <>
                    <span className={`flex h-9 w-14 items-center justify-center rounded-full ${isActive ? 'bg-brand-500' : ''}`}>
                      <Icon name={icon} />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </footer>
      </div>
    </HashRouter>
  )
}
