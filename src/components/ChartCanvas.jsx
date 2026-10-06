import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js'
import { useEffect, useRef } from 'react'

// Register only what the dashboard uses, instead of chart.js/auto, to keep the bundle small.
Chart.register(ArcElement, BarController, BarElement, CategoryScale, DoughnutController, Legend, LinearScale, Tooltip)

// `data` and `options` must be referentially stable (useMemo): a change rebuilds the chart.
export default function ChartCanvas({ type, data, options, label }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const chart = new Chart(canvasRef.current, {
      type,
      data,
      options: { responsive: true, maintainAspectRatio: false, ...options },
    })
    return () => chart.destroy()
  }, [type, data, options])

  return (
    <div className="h-56">
      <canvas ref={canvasRef} role="img" aria-label={label} />
    </div>
  )
}
