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
      {previewUrl && <img src={previewUrl} alt="Ảnh khảo sát" className="max-h-72 w-full rounded-3xl bg-white object-contain" />}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={capture}
          disabled={busy}
          className="btn btn-primary"
        >
          {busy ? 'Đang xử lý…' : photo ? 'Chụp lại' : 'Chụp ảnh'}
        </button>
        {photo && (
          <button type="button" onClick={() => onChange(undefined)} className="btn btn-secondary">
            Xoá ảnh
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
