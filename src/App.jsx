import { Suspense, lazy, useEffect } from 'react'
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import NetworkBanner from './components/NetworkBanner.jsx'
import QueuePage from './pages/QueuePage.jsx'
import SurveyWizard from './pages/SurveyWizard'
import { startSyncTriggers } from './services/sync.service'

// Chart.js is only needed on this page; it is still precached by the Service Worker for offline use.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))

const navClass = ({ isActive }) =>
  `px-3 py-2 text-sm font-medium ${isActive ? 'text-white underline' : 'text-sky-100'}`

export default function App() {
  useEffect(() => startSyncTriggers(), [])

  return (
    <HashRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="bg-sky-600 pt-[env(safe-area-inset-top)]">
          <nav className="mx-auto flex max-w-2xl items-center gap-1 px-2">
            <NavLink to="/" end className={navClass}>Khảo sát</NavLink>
            <NavLink to="/queue" className={navClass}>Hàng đợi</NavLink>
            <NavLink to="/dashboard" className={navClass}>Thống kê</NavLink>
          </nav>
        </header>
        <NetworkBanner />
        <main className="mx-auto max-w-2xl p-4">
          <Suspense fallback={<p className="text-slate-500">Đang tải…</p>}>
            <Routes>
              <Route path="/" element={<SurveyWizard />} />
              <Route path="/queue" element={<QueuePage />} />
              <Route path="/dashboard" element={<Dashboard />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </HashRouter>
  )
}
