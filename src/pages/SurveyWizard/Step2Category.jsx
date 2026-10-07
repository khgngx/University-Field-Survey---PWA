import Icon from '../../components/Icon.jsx'
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
            className={`flex items-center justify-between gap-2 rounded-3xl p-4 text-left font-semibold ${
              selected ? 'bg-brand-200 ring-2 ring-brand-500 ring-inset' : 'bg-white'
            }`}
          >
            {category}
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                selected ? 'bg-brand-500' : 'bg-canvas text-transparent'
              }`}
            >
              <Icon name="check" className="h-4 w-4" />
            </span>
          </button>
        )
      })}
    </div>
  )
}
