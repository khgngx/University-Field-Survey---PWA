import { CATEGORIES } from '../../utils/constants'

export default function Step2Category({ draft, update }) {
  return (
    <div role="radiogroup" aria-label="Hạng mục" className="grid grid-cols-2 gap-3">
      {CATEGORIES.map((category) => {
        const selected = draft.category === category
        return (
          <button
            key={category}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => update({ category })}
            className={`rounded-lg border px-4 py-3 font-medium ${
              selected ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300 bg-white'
            }`}
          >
            {category}
          </button>
        )
      })}
    </div>
  )
}
