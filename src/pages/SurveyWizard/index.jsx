import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SurveyValidationError, findRecentSurvey, validateForSubmit } from '../../db/surveys'
import { useDraft } from '../../hooks/useDraft'
import { getCurrentPosition } from '../../services/geo.service'
import { requestNotificationPermission } from '../../services/notify.service'
import { requestSync } from '../../services/sync.service'
import Review from './Review.jsx'
import Step1Location from './Step1Location.jsx'
import Step2Category from './Step2Category.jsx'
import Step3Rating from './Step3Rating.jsx'
import Step4Photo from './Step4Photo.jsx'

// `requires` lists the draft fields that must be valid before moving to the next step.
const STEPS = [
  { title: 'Vị trí', Component: Step1Location, requires: ['building', 'floor', 'room'] },
  { title: 'Hạng mục', Component: Step2Category, requires: ['category'] },
  { title: 'Đánh giá', Component: Step3Rating, requires: ['rating'] },
  { title: 'Ảnh', Component: Step4Photo, requires: [] },
  { title: 'Xem lại', Component: Review, requires: [] },
]

const formatTime = (ms) => new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

export default function SurveyWizard() {
  const navigate = useNavigate()
  const { draft, update, submit, error: draftError } = useDraft()
  const [stepIndex, setStepIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [duplicate, setDuplicate] = useState(null)

  if (draftError) {
    return <p role="alert" className="text-red-600">Không mở được dữ liệu cục bộ: {draftError.message}</p>
  }
  if (!draft) return <p className="text-slate-500">Đang tải…</p>

  const { title, Component, requires } = STEPS[stepIndex]
  const invalid = validateForSubmit(draft)
  const canProceed = requires.every((field) => !invalid.includes(field))
  const isLast = stepIndex === STEPS.length - 1

  async function handleNext() {
    setMessage(null)
    if (stepIndex === 0) {
      // Offline duplicate check: the same room surveyed in the last 24 h offers a new version.
      try {
        const existing = await findRecentSurvey(draft, Date.now(), draft.id)
        if (existing) {
          setDuplicate(existing)
          return
        }
      } catch (err) {
        setMessage(`Không kiểm tra được khảo sát trùng: ${err.message}`)
        return
      }
      update({ version: 1 })
    }
    setStepIndex((i) => i + 1)
  }

  function createNewVersion() {
    update({ version: duplicate.version + 1 })
    setDuplicate(null)
    setStepIndex((i) => i + 1)
  }

  async function handleSubmit() {
    setBusy(true)
    setMessage(null)
    // Permission prompts need this user gesture; neither may block or fail the submit.
    requestNotificationPermission().catch((err) => console.warn('Notification permission failed:', err.message))
    try {
      update({ gps: await getCurrentPosition() })
      await submit()
      // The survey is already safe in IndexedDB; syncing is best-effort and retried by the triggers.
      requestSync().catch((err) => console.error('Sync after submit failed:', err))
      navigate('/queue')
    } catch (err) {
      setMessage(
        err instanceof SurveyValidationError
          ? `Còn thiếu hoặc sai: ${err.missing.join(', ')}`
          : `Không lưu được khảo sát: ${err.message}`,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-4">
      <header>
        <p className="text-sm text-slate-500">Bước {stepIndex + 1}/{STEPS.length}</p>
        <h1 className="text-xl font-semibold">{title}</h1>
      </header>

      <Component draft={draft} update={update} />

      {message && <p role="alert" className="text-sm text-red-600">{message}</p>}

      {duplicate ? (
        <div role="alertdialog" aria-label="Phòng đã được khảo sát" className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p>
            Phòng này đã được khảo sát lúc {formatTime(duplicate.submittedAt ?? duplicate.createdAt)}. Tạo bản cập nhật
            (version {duplicate.version + 1}) hay huỷ?
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={createNewVersion} className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white">
              Tạo bản cập nhật
            </button>
            <button type="button" onClick={() => setDuplicate(null)} className="rounded-lg border px-4 py-2">
              Huỷ
            </button>
          </div>
        </div>
      ) : (
        <footer className="flex justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={() => setStepIndex((i) => i - 1)}
            disabled={stepIndex === 0 || busy}
            className="rounded-lg border px-4 py-2 disabled:opacity-40"
          >
            Quay lại
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy || invalid.length > 0}
              className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white disabled:opacity-50"
            >
              {busy ? 'Đang lưu…' : 'Gửi khảo sát'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed}
              className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white disabled:opacity-50"
            >
              Tiếp tục
            </button>
          )}
        </footer>
      )}
    </section>
  )
}
