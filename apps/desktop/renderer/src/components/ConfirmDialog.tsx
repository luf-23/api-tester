import { useEffect, useRef, useState } from 'react'
import { AnimatedOverlay } from './ui/AnimatedOverlay'
import { Spinner } from './ui/Spinner'

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus({ preventScroll: true })
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  const confirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
      onCancel()
    } catch {
      // Keep the dialog open so the caller can report the failure.
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatedOverlay open={open} onBackdropClick={() => !busy && onCancel()}>
      <div role="alertdialog" aria-modal="true" className="confirm-dialog">
        <h2 className="confirm-dialog__title">{title}</h2>
        <p className="confirm-dialog__body">{body}</p>
        <div className="confirm-dialog__actions">
          <button
            ref={cancelRef}
            type="button"
            className="confirm-dialog__btn"
            disabled={busy}
            onClick={onCancel}
          >
            取消
          </button>
          <button
            type="button"
            className={`confirm-dialog__btn ${
              danger ? 'confirm-dialog__btn--danger' : 'confirm-dialog__btn--primary'
            }`}
            disabled={busy}
            onClick={() => void confirm()}
          >
            {busy && <Spinner size="sm" />}
            {busy ? '处理中…' : confirmLabel}
          </button>
        </div>
      </div>
    </AnimatedOverlay>
  )
}
