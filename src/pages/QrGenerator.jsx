import { useEffect, useMemo, useRef, useState } from 'react'
import { MAX_LOCATION_LENGTH } from '../utils/limits'
import { qrFileName, qrToPixels } from '../utils/qrImage'
import { formatRoomQr } from '../utils/roomQr'

const FIELDS = [
  { name: 'building', label: 'Toà nhà', placeholder: 'A' },
  { name: 'floor', label: 'Tầng', placeholder: '3' },
  { name: 'room', label: 'Phòng', placeholder: 'A305' },
]
const CAPTION_HEIGHT = 64
const MAX_CAPTION_FONT = 30
const MIN_CAPTION_FONT = 14

function drawCaption(ctx, text, width, top) {
  let size = MAX_CAPTION_FONT
  ctx.font = `bold ${size}px system-ui, sans-serif`
  while (size > MIN_CAPTION_FONT && ctx.measureText(text).width > width - 24) {
    size -= 2
    ctx.font = `bold ${size}px system-ui, sans-serif`
  }
  ctx.fillStyle = '#000'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, width / 2, top + CAPTION_HEIGHT / 2)
}

const toBlob = (canvas) =>
  new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Không tạo được ảnh PNG'))), 'image/png'),
  )

export default function QrGenerator() {
  const [location, setLocation] = useState({ building: '', floor: '', room: '' })
  const [message, setMessage] = useState(null)
  const canvasRef = useRef(null)

  const touched = Object.values(location).some((v) => v.trim() !== '')
  const { payload, error } = useMemo(() => {
    try {
      return { payload: formatRoomQr(location), error: null }
    } catch (err) {
      return { payload: null, error: touched ? err.message : null }
    }
  }, [location, touched])

  // Redraw whenever the payload changes: the QR on top, a human-readable label underneath so the
  // printed sticker can be read without scanning it.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!payload || !canvas) return
    const { data, width, height } = qrToPixels(payload)
    canvas.width = width
    canvas.height = height + CAPTION_HEIGHT
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.putImageData(new ImageData(data, width, height), 0, 0)
    const { building, floor, room } = location
    drawCaption(ctx, `${building.trim()} · Tầng ${floor.trim()} · Phòng ${room.trim()}`, width, height)
  }, [payload, location])

  async function download() {
    setMessage(null)
    try {
      const url = URL.createObjectURL(await toBlob(canvasRef.current))
      const link = document.createElement('a')
      link.href = url
      link.download = qrFileName(location)
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (err) {
      setMessage(err.message)
    }
  }

  const canShareFiles = typeof navigator.share === 'function' && typeof navigator.canShare === 'function'

  async function share() {
    setMessage(null)
    try {
      const file = new File([await toBlob(canvasRef.current)], qrFileName(location), { type: 'image/png' })
      if (!navigator.canShare({ files: [file] })) throw new Error('Thiết bị này không chia sẻ được ảnh. Hãy dùng nút Tải ảnh PNG.')
      await navigator.share({ files: [file], title: `QR phòng ${payload}` })
    } catch (err) {
      if (err.name !== 'AbortError') setMessage(err.message) // AbortError = the user closed the share sheet
    }
  }

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Tạo QR phòng</h1>
        <p className="text-sm text-slate-500">
          Nhập thông tin một lần, tải mã QR về và dán ở phòng. Lần sau chỉ cần quét (hoặc tải ảnh QR lên) ở Bước 1 của khảo sát.
        </p>
      </header>

      {FIELDS.map(({ name, label, placeholder }) => (
        <label key={name} className="block">
          <span className="mb-1 block text-sm font-medium">{label}</span>
          <input
            value={location[name]}
            onChange={(e) => setLocation((prev) => ({ ...prev, [name]: e.target.value }))}
            placeholder={placeholder}
            maxLength={MAX_LOCATION_LENGTH}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
      ))}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {!payload && !error && <p className="text-sm text-slate-500">Nhập đủ Toà nhà, Tầng và Phòng để tạo mã QR.</p>}

      {payload && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <canvas ref={canvasRef} aria-label={`Mã QR ${payload}`} className="mx-auto h-auto w-full max-w-xs" />
          <p className="text-center text-sm text-slate-500">
            Nội dung mã: <code className="rounded bg-slate-100 px-1">{payload}</code>
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={download} className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white">
              Tải ảnh PNG
            </button>
            {canShareFiles && (
              <button type="button" onClick={share} className="rounded-lg border border-sky-600 px-4 py-2 font-medium text-sky-700">
                Chia sẻ
              </button>
            )}
          </div>
          {message && <p role="alert" className="text-center text-sm text-red-600">{message}</p>}
        </div>
      )}
    </section>
  )
}
