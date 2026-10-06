import { useState } from 'react'
import { useObjectUrl } from '../hooks/useObjectUrl'
import { takePhoto } from '../services/camera.service'

export default function PhotoPicker({ photo, onChange }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const previewUrl = useObjectUrl(photo)

  async function capture() {
    setBusy(true)
    setError(null)
    try {
      const blob = await takePhoto()
      if (blob) onChange(blob)
    } catch (err) {
      setError(`Không chụp được ảnh: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {previewUrl && <img src={previewUrl} alt="Ảnh khảo sát" className="max-h-72 w-full rounded-lg object-contain" />}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={capture}
          disabled={busy}
          className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {busy ? 'Đang xử lý…' : photo ? 'Chụp lại' : 'Chụp ảnh'}
        </button>
        {photo && (
          <button type="button" onClick={() => onChange(undefined)} className="rounded-lg border px-4 py-2">
            Xoá ảnh
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
