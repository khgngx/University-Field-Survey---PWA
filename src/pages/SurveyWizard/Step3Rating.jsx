import StarRating from '../../components/StarRating.jsx'

export default function Step3Rating({ draft, update }) {
  return (
    <div className="space-y-4">
      <div>
        <span className="mb-1 block text-sm font-medium">Tình trạng thiết bị (1–5 sao)</span>
        <StarRating value={draft.rating} onChange={(rating) => update({ rating })} />
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Ghi chú lỗi</span>
        <textarea
          value={draft.defectNotes ?? ''}
          onChange={(e) => update({ defectNotes: e.target.value })}
          rows={4}
          maxLength={2000}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </label>
    </div>
  )
}
