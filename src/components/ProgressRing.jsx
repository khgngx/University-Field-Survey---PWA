const RADIUS = 26
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// Decorative: the caller already renders the same progress as text.
export default function ProgressRing({ value, max }) {
  return (
    <div aria-hidden="true" className="relative h-20 w-20 shrink-0 rounded-full bg-white">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={RADIUS} fill="none" strokeWidth="7" className="stroke-brand-100" />
        <circle
          cx="32"
          cy="32"
          r={RADIUS}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - value / max)}
          className="stroke-brand-500 transition-[stroke-dashoffset] duration-300"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold">{value}</span>
    </div>
  )
}
