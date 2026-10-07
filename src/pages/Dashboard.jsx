import { useMemo } from 'react'
import ChartCanvas from '../components/ChartCanvas.jsx'
import { useSyncQueue } from '../hooks/useSyncQueue'
import { STATUS } from '../utils/constants'
import { DEFECT_MAX_RATING, summarize } from '../utils/stats'

const BRAND = '#8ecf2e'
const PALETTE = [BRAND, '#ff8a34', '#3b9eff', '#f45b69', '#17191c']

const COUNTERS = [
  ['Chờ đồng bộ', [STATUS.PENDING_SYNC, STATUS.SYNCING], 'bg-amber-400'],
  ['Đã đồng bộ', [STATUS.SYNCED], 'bg-brand-500'],
  ['Lỗi', [STATUS.FAILED], 'bg-red-400'],
]

const BAR_OPTIONS = {
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, border: { display: false } },
    y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#eef0ec' }, border: { display: false } },
  },
}
const DOUGHNUT_OPTIONS = {
  cutout: '68%',
  plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle' } } },
}

export default function Dashboard() {
  const { ready, surveys, counts, error } = useSyncQueue()
  const stats = useMemo(() => summarize(surveys), [surveys])

  const defectsChart = useMemo(
    () => ({
      labels: Object.keys(stats.defectsByBuilding),
      datasets: [{ label: 'Số lỗi', data: Object.values(stats.defectsByBuilding), backgroundColor: BRAND, borderRadius: 999, borderSkipped: false, maxBarThickness: 28 }],
    }),
    [stats],
  )
  const categoryChart = useMemo(
    () => ({
      labels: Object.keys(stats.countByCategory),
      datasets: [{ data: Object.values(stats.countByCategory), backgroundColor: PALETTE, borderWidth: 0, borderRadius: 8, spacing: 3 }],
    }),
    [stats],
  )

  if (error) return <p role="alert" className="text-red-600">Không đọc được dữ liệu: {error.message}</p>
  if (!ready) return <p className="text-muted">Đang tải…</p>

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Thống kê</h1>

      <div className="grid grid-cols-3 gap-3">
        {COUNTERS.map(([label, statuses, dot]) => (
          <div key={label} className="card">
            <span className={`mb-3 block h-2.5 w-2.5 rounded-full ${dot}`} />
            <p className="text-2xl font-semibold">{statuses.reduce((sum, st) => sum + counts[st], 0)}</p>
            <p className="text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>

      {stats.total === 0 ? (
        <p className="text-muted">Chưa có khảo sát nào để thống kê.</p>
      ) : (
        <>
          <div className="rounded-3xl bg-brand-200 p-5">
            <p className="text-sm font-medium text-ink/70">Điểm đánh giá trung bình ({stats.total} khảo sát)</p>
            <p className="text-4xl font-semibold">{stats.averageRating.toFixed(1)} ★</p>
            <ul className="mt-3 flex flex-wrap gap-2 text-sm">
              {Object.entries(stats.averageRatingByCategory).map(([category, avg]) => (
                <li key={category} className="rounded-full bg-white/70 px-3 py-1">{category}: {avg.toFixed(1)}</li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h2 className="mb-3 font-semibold">Lỗi theo toà nhà (đánh giá ≤ {DEFECT_MAX_RATING} sao)</h2>
            {defectsChart.labels.length === 0 ? (
              <p className="text-sm text-muted">Không có lỗi nào.</p>
            ) : (
              <ChartCanvas type="bar" data={defectsChart} options={BAR_OPTIONS} label="Số lỗi theo toà nhà" />
            )}
          </div>

          <div className="card">
            <h2 className="mb-3 font-semibold">Phân bố theo hạng mục</h2>
            <ChartCanvas type="doughnut" data={categoryChart} options={DOUGHNUT_OPTIONS} label="Phân bố khảo sát theo hạng mục" />
          </div>
        </>
      )}
    </section>
  )
}
