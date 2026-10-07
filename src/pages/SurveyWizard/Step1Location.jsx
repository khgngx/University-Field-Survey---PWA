import { useRef, useState } from 'react'
import Icon from '../../components/Icon.jsx'
import { readRoomQrFromImage, scanRoomQr } from '../../services/scanner.service'
import { MAX_LOCATION_LENGTH } from '../../utils/limits'

const FIELDS = [
  { name: 'building', label: 'Toà nhà', placeholder: 'A' },
  { name: 'floor', label: 'Tầng', placeholder: '3' },
  { name: 'room', label: 'Phòng', placeholder: 'A305' },
]

export default function Step1Location({ draft, update }) {
  const [busy, setBusy] = useState(null) // 'scan' | 'upload' | null
  const [qrError, setQrError] = useState(null)
  const fileInput = useRef(null)

  async function fillFrom(read) {
    setQrError(null)
    try {
      const location = await read()
      if (location) update(location)
    } catch (err) {
      setQrError(err.message)
    }
  }

  async function run(kind, read) {
    setBusy(kind)
    await fillFrom(read)
    setBusy(null)
  }

  function onFileChosen(event) {
    const file = event.target.files?.[0]
    event.target.value = '' // lets the same file be chosen again after a failed read
    if (file) run('upload', () => readRoomQrFromImage(file))
  }

  const buttonClass = 'card flex items-center justify-between gap-2 text-left text-sm font-semibold disabled:opacity-50'
  const iconClass = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => run('scan', scanRoomQr)} disabled={busy !== null} className={buttonClass}>
          {busy === 'scan' ? 'Đang mở camera…' : 'Quét QR phòng'}
          <span className={iconClass}><Icon name="scan" /></span>
        </button>
        <button type="button" onClick={() => fileInput.current.click()} disabled={busy !== null} className={buttonClass}>
          {busy === 'upload' ? 'Đang đọc ảnh…' : 'Tải ảnh QR lên'}
          <span className={iconClass}><Icon name="upload" /></span>
        </button>
        <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onFileChosen} aria-label="Chọn ảnh mã QR" />
      </div>
      {qrError && <p role="alert" className="text-sm text-red-600">{qrError}</p>}

      {FIELDS.map(({ name, label, placeholder }) => (
        <label key={name} className="block">
          <span className="field-label">{label}</span>
          <input
            value={draft[name] ?? ''}
            onChange={(e) => update({ [name]: e.target.value })}
            placeholder={placeholder}
            maxLength={MAX_LOCATION_LENGTH}
            className="field"
          />
        </label>
      ))}
    </div>
  )
}
