import { useEffect, useRef, useState } from 'react'
import { ui } from '../locale/ui'

export function UnsavedPrompt({
  open,
  title,
  body,
  onCancel,
  onSave,
  onDiscard,
}: {
  open: boolean
  title: string
  body: string
  onCancel: () => void
  onSave: () => void | Promise<void>
  onDiscard: () => void | Promise<void>
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  useEffect(() => {
    if (open) cancelRef.current?.focus({ preventScroll: true })
  }, [open])

  if (!open) return null

  const run = async (fn: () => void | Promise<void>) => {
    setBusy(true)
    try {
      await fn()
      onCancel()
    } catch {
      /* parent may throw to keep dialog open */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="confirm-overlay" role="presentation" onClick={() => !busy && onCancel()}>
      <div
        role="alertdialog"
        aria-modal="true"
        className="confirm-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="confirm-dialog__title">{title}</h2>
        <p className="confirm-dialog__body">{body}</p>
        <div className="confirm-dialog__actions confirm-dialog__actions--triple">
          <button
            ref={cancelRef}
            type="button"
            className="confirm-dialog__btn"
            disabled={busy}
            onClick={onCancel}
          >
            {ui.unsaved.cancel}
          </button>
          <button
            type="button"
            className="confirm-dialog__btn"
            disabled={busy}
            onClick={() => void run(onDiscard)}
          >
            {ui.unsaved.discard}
          </button>
          <button
            type="button"
            className="confirm-dialog__btn confirm-dialog__btn--primary"
            disabled={busy}
            onClick={() => void run(onSave)}
          >
            {ui.unsaved.save}
          </button>
        </div>
      </div>
    </div>
  )
}
