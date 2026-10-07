import { useObjectUrl } from '../../hooks/useObjectUrl'

const ROWS = [
  ['Toà nhà', (d) => d.building],
  ['Tầng', (d) => d.floor],
  ['Phòng', (d) => d.room],
  ['Hạng mục', (d) => d.category],
  ['Đánh giá', (d) => (d.rating ? `${d.rating} / 5 sao` : '')],
  ['Ghi chú lỗi', (d) => d.defectNotes],
]

export default function Review({ draft }) {
  const photoUrl = useObjectUrl(draft.photoBlob)
  return (
    <div className="space-y-4">
      <dl className="divide-y divide-slate-100 rounded-3xl bg-white">
        {ROWS.map(([label, read]) => (
          <div key={label} className="flex justify-between gap-4 px-5 py-3">
            <dt className="text-muted">{label}</dt>
            <dd className="text-right font-medium">{read(draft) || '—'}</dd>
          </div>
        ))}
      </dl>
      {photoUrl && <img src={photoUrl} alt="Ảnh khảo sát" className="max-h-72 w-full rounded-3xl bg-white object-contain" />}
    </div>
  )
}
