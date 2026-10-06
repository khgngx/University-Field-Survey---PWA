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
      <dl className="divide-y rounded-lg border border-slate-200 bg-white">
        {ROWS.map(([label, read]) => (
          <div key={label} className="flex justify-between gap-4 px-4 py-2">
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-right font-medium">{read(draft) || '—'}</dd>
          </div>
        ))}
      </dl>
      {photoUrl && <img src={photoUrl} alt="Ảnh khảo sát" className="max-h-72 w-full rounded-lg object-contain" />}
    </div>
  )
}
