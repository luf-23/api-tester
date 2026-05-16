import { useEffect, useRef, useState } from 'react'
import { ui } from '../locale/ui'
import { AnimatedOverlay } from './ui/AnimatedOverlay'
import { Spinner } from './ui/Spinner'

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
  const [busyAction, setBusyAction] = useState<'save' | 'discard' | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel, busy])

  useEffect(() => {
    if (open) cancelRef.current?.focus({ preventScroll: true })
  }, [open])

  const run = async (fn: () => void | Promise<void>, action: 'save' | 'discard') => {
    setBusy(true)
    setBusyAction(action)
    try {
      await fn()
      onCancel()
    } catch {
      /* parent may throw to keep dialog open */
    } finally {
      setBusy(false)
      setBusyAction(null)
    }
  }

  return (
    <AnimatedOverlay open={open} onBackdropClick={() => !busy && onCancel()}>
      <div role="alertdialog" aria-modal="true" className="confirm-dialog">
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
            onClick={() => void run(onDiscard, 'discard')}
          >
            {busyAction === 'discard' && <Spinner size="sm" />}
            {ui.unsaved.discard}
          </button>
          <button
            type="button"
            className="confirm-dialog__btn confirm-dialog__btn--primary"
            disabled={busy}
            onClick={() => void run(onSave, 'save')}
          >
            {busyAction === 'save' && <Spinner size="sm" />}
            {busyAction === 'save' ? ui.unsaved.saving : ui.unsaved.save}
          </button>
        </div>
      </div>
    </AnimatedOverlay>
  )
}
