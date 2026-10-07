import StarRating from '../../components/StarRating.jsx'

export default function Step3Rating({ draft, update }) {
  return (
    <div className="space-y-4">
      <div className="card">
        <span className="field-label">Tình trạng thiết bị (1–5 sao)</span>
        <StarRating value={draft.rating} onChange={(rating) => update({ rating })} />
      </div>
      <label className="block">
        <span className="field-label">Ghi chú lỗi</span>
        <textarea
          value={draft.defectNotes ?? ''}
          onChange={(e) => update({ defectNotes: e.target.value })}
          rows={4}
          maxLength={2000}
          className="field"
        />
      </label>
    </div>
  )
}
