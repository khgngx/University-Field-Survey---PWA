import { useMemo } from 'react'
import ChartCanvas from '../components/ChartCanvas.jsx'
import { useSyncQueue } from '../hooks/useSyncQueue'
import { STATUS } from '../utils/constants'
import { DEFECT_MAX_RATING, summarize } from '../utils/stats'

const PALETTE = ['#0284c7', '#f59e0b', '#16a34a', '#dc2626', '#7c3aed']

const COUNTERS = [
  ['Chờ đồng bộ', [STATUS.PENDING_SYNC, STATUS.SYNCING], 'text-amber-600'],
  ['Đã đồng bộ', [STATUS.SYNCED], 'text-green-600'],
  ['Lỗi', [STATUS.FAILED], 'text-red-600'],
]

const BAR_OPTIONS = { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
const DOUGHNUT_OPTIONS = { plugins: { legend: { position: 'bottom' } } }

export default function Dashboard() {
  const { ready, surveys, counts, error } = useSyncQueue()
  const stats = useMemo(() => summarize(surveys), [surveys])

  const defectsChart = useMemo(
    () => ({
      labels: Object.keys(stats.defectsByBuilding),
      datasets: [{ label: 'Số lỗi', data: Object.values(stats.defectsByBuilding), backgroundColor: PALETTE[3] }],
    }),
    [stats],
  )
  const categoryChart = useMemo(
    () => ({
      labels: Object.keys(stats.countByCategory),
      datasets: [{ data: Object.values(stats.countByCategory), backgroundColor: PALETTE }],
    }),
    [stats],
  )

  if (error) return <p role="alert" className="text-red-600">Không đọc được dữ liệu: {error.message}</p>
  if (!ready) return <p className="text-slate-500">Đang tải…</p>

  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold">Thống kê</h1>

      <div className="grid grid-cols-3 gap-3">
        {COUNTERS.map(([label, statuses, color]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-3 text-center">
            <p className={`text-2xl font-bold ${color}`}>{statuses.reduce((sum, st) => sum + counts[st], 0)}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {stats.total === 0 ? (
        <p className="text-slate-500">Chưa có khảo sát nào để thống kê.</p>
      ) : (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Điểm đánh giá trung bình ({stats.total} khảo sát)</p>
            <p className="text-3xl font-bold">{stats.averageRating.toFixed(1)} ★</p>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 text-sm text-slate-600">
              {Object.entries(stats.averageRatingByCategory).map(([category, avg]) => (
                <li key={category}>{category}: {avg.toFixed(1)}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 font-medium">Lỗi theo toà nhà (đánh giá ≤ {DEFECT_MAX_RATING} sao)</h2>
            {defectsChart.labels.length === 0 ? (
              <p className="text-sm text-slate-500">Không có lỗi nào.</p>
            ) : (
              <ChartCanvas type="bar" data={defectsChart} options={BAR_OPTIONS} label="Số lỗi theo toà nhà" />
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 font-medium">Phân bố theo hạng mục</h2>
            <ChartCanvas type="doughnut" data={categoryChart} options={DOUGHNUT_OPTIONS} label="Phân bố khảo sát theo hạng mục" />
          </div>
        </>
      )}
    </section>
  )
}
