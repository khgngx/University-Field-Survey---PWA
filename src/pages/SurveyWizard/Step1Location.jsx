import { useState } from 'react'
import { scanRoomQr } from '../../services/scanner.service'

const FIELDS = [
  { name: 'building', label: 'Toà nhà', placeholder: 'A' },
  { name: 'floor', label: 'Tầng', placeholder: '3' },
  { name: 'room', label: 'Phòng', placeholder: 'A305' },
]

export default function Step1Location({ draft, update }) {
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState(null)

  async function scan() {
    setScanning(true)
    setScanError(null)
    try {
      const location = await scanRoomQr()
      if (location) update(location)
    } catch (err) {
      setScanError(err.message)
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={scan}
        disabled={scanning}
        className="w-full rounded-lg border border-sky-600 px-4 py-2 font-medium text-sky-700 disabled:opacity-50"
      >
        {scanning ? 'Đang mở camera…' : 'Quét QR phòng để tự điền'}
      </button>
      {scanError && <p role="alert" className="text-sm text-red-600">{scanError}</p>}

      {FIELDS.map(({ name, label, placeholder }) => (
        <label key={name} className="block">
          <span className="mb-1 block text-sm font-medium">{label}</span>
          <input
            value={draft[name] ?? ''}
            onChange={(e) => update({ [name]: e.target.value })}
            placeholder={placeholder}
            maxLength={50}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
      ))}
    </div>
  )
}
