import { useState } from 'react'
import StatusBadge from '../components/StatusBadge.jsx'
import { useSyncQueue } from '../hooks/useSyncQueue'
import { requestSync } from '../services/sync.service'
import { retryAllFailed, retrySurvey } from '../sync/queue'
import { STATUS } from '../utils/constants'

const formatTime = (ms) => new Date(ms).toLocaleString('vi-VN')

export default function QueuePage() {
  const { ready, surveys, counts, error } = useSyncQueue()
  const [actionError, setActionError] = useState(null)

  async function run(action) {
    setActionError(null)
    try {
      await action()
    } catch (err) {
      setActionError(err.message)
    }
  }

  const retryOne = (id) => run(async () => {
    await retrySurvey(id)
    await requestSync()
  })
  const retryAll = () => run(async () => {
    await retryAllFailed()
    await requestSync()
  })
  const syncNow = () => run(requestSync)

  if (error) return <p role="alert" className="text-red-600">Không đọc được hàng đợi: {error.message}</p>
  if (!ready) return <p className="text-slate-500">Đang tải…</p>

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Hàng đợi đồng bộ</h1>
        <button type="button" onClick={syncNow} className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white">
          Đồng bộ ngay
        </button>
      </header>

      <p className="text-sm text-slate-600">
        Chờ: {counts[STATUS.PENDING_SYNC] + counts[STATUS.SYNCING]} · Đã đồng bộ: {counts[STATUS.SYNCED]} · Lỗi: {counts[STATUS.FAILED]}
      </p>
      {counts[STATUS.FAILED] > 0 && (
        <button type="button" onClick={retryAll} className="rounded-lg border px-3 py-1 text-sm">
          Thử lại tất cả ({counts[STATUS.FAILED]})
        </button>
      )}
      {actionError && <p role="alert" className="text-sm text-red-600">{actionError}</p>}

      {surveys.length === 0 ? (
        <p className="text-slate-500">Chưa có khảo sát nào.</p>
      ) : (
        <ul className="space-y-2">
          {surveys.map((s) => (
            <li key={s.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{s.building}-{s.floor}-{s.room} · {s.category}</span>
                <StatusBadge status={s.status} />
              </div>
              <p className="text-xs text-slate-500">
                {formatTime(s.createdAt)} · {s.rating}★{s.version > 1 ? ` · v${s.version}` : ''}
              </p>
              {s.status === STATUS.FAILED && (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-red-700">{s.lastError}</p>
                  <button type="button" onClick={() => retryOne(s.id)} className="shrink-0 rounded border px-2 py-1 text-xs">
                    Thử lại
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
