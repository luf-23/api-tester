import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyValue } from '@api-tester/shared'
import { ui } from '../locale/ui'
import { bulkTextToParams, paramsToBulkText } from '../lib/bulkKv'

interface Props {
  rows: KeyValue[]
  onApply: (next: KeyValue[]) => void
  onClose: () => void
}

export function BulkKvModal({ rows, onApply, onClose }: Props) {
  const titleId = useId()
  const hintId = useId()
  const [text, setText] = useState(() => paramsToBulkText(rows))
  const taRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    taRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const apply = () => {
    onApply(bulkTextToParams(text))
  }

  return (
    <div className="confirm-overlay" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={hintId}
        className="confirm-dialog confirm-dialog--bulk"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="confirm-dialog__title">
          {ui.request.bulkEditTitle}
        </h2>
        <p id={hintId} className="confirm-dialog__body bulk-kv-modal__hint">
          {ui.request.bulkEditHint}
        </p>
        <textarea
          ref={taRef}
          className="bulk-kv-modal__textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          aria-label={ui.request.bulkEditTitle}
        />
        <div className="confirm-dialog__actions">
          <button type="button" className="confirm-dialog__btn" onClick={onClose}>
            {ui.request.bulkEditCancel}
          </button>
          <button type="button" className="confirm-dialog__btn confirm-dialog__btn--primary" onClick={apply}>
            {ui.request.bulkEditApply}
          </button>
        </div>
      </div>
    </div>
  )
}
