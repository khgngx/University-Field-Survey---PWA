const STARS = [1, 2, 3, 4, 5]

export default function StarRating({ value, onChange, label = 'Đánh giá' }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {STARS.map((star) => {
        const selected = value === star
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${star} sao`}
            onClick={() => onChange(star)}
            className={`h-12 w-12 rounded-lg text-3xl leading-none ${
              value >= star ? 'text-amber-400' : 'text-slate-300'
            } ${selected ? 'ring-2 ring-sky-600' : ''}`}
          >
            ★
          </button>
        )
      })}
    </div>
  )
}
