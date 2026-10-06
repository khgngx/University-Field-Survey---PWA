import { STATUS } from '../utils/constants'

const STYLES = {
  [STATUS.DRAFT]: ['Nháp', 'bg-slate-200 text-slate-700'],
  [STATUS.PENDING_SYNC]: ['Chờ đồng bộ', 'bg-amber-100 text-amber-800'],
  [STATUS.SYNCING]: ['Đang đồng bộ', 'bg-sky-100 text-sky-800'],
  [STATUS.SYNCED]: ['Đã đồng bộ', 'bg-green-100 text-green-800'],
  [STATUS.FAILED]: ['Lỗi', 'bg-red-100 text-red-800'],
}

export default function StatusBadge({ status }) {
  const [label, style] = STYLES[status] ?? [status, 'bg-slate-200 text-slate-700']
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>{label}</span>
}
