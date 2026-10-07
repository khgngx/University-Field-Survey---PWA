import { STATUS } from '../utils/constants'

const STYLES = {
  [STATUS.DRAFT]: ['Nháp', 'bg-slate-100 text-slate-600'],
  [STATUS.PENDING_SYNC]: ['Chờ đồng bộ', 'bg-amber-100 text-amber-800'],
  [STATUS.SYNCING]: ['Đang đồng bộ', 'bg-sky-100 text-sky-800'],
  [STATUS.SYNCED]: ['Đã đồng bộ', 'bg-brand-100 text-brand-700'],
  [STATUS.FAILED]: ['Lỗi', 'bg-red-100 text-red-700'],
}

export default function StatusBadge({ status }) {
  const [label, style] = STYLES[status] ?? [status, 'bg-slate-100 text-slate-600']
  return <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${style}`}>{label}</span>
}
