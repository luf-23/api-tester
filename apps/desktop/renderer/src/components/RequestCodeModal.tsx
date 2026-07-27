import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { RequestWithTests } from '@api-tester/shared'
import {
  parseRequestCode,
  requestToCode,
  type ImportedRequest,
  type RequestCodeFormat,
} from '../lib/requestCode'

interface Props {
  request?: RequestWithTests
  initialMode?: 'export' | 'import'
  importOnly?: boolean
  onImport: (request: ImportedRequest) => void
  onClose: () => void
}

export function RequestCodeModal({
  request,
  initialMode = 'export',
  importOnly = false,
  onImport,
  onClose,
}: Props) {
  const [mode, setMode] = useState<'export' | 'import'>(initialMode)
  const [format, setFormat] = useState<RequestCodeFormat>('curl')
  const generated = useMemo(
    () => (request ? requestToCode(request, format) : ''),
    [request, format]
  )
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const apply = () => {
    try {
      onImport(parseRequestCode(input, format))
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const copy = async () => {
    await navigator.clipboard.writeText(generated)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return createPortal(
    <div className="confirm-overlay" role="presentation" onClick={onClose}>
      <div className="confirm-dialog request-code-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="request-code-modal__header">
          <h2 className="confirm-dialog__title">Request code</h2>
          <button className="request-code-modal__close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="request-code-modal__switches">
          {importOnly ? (
            <strong>Import request</strong>
          ) : (
            <div className="request-code-modal__tabs">
              <button className={mode === 'export' ? 'is-active' : ''} onClick={() => setMode('export')}>Export</button>
              <button className={mode === 'import' ? 'is-active' : ''} onClick={() => setMode('import')}>Import</button>
            </div>
          )}
          <select value={format} onChange={(e) => { setFormat(e.target.value as RequestCodeFormat); setError('') }}>
            <option value="curl">cURL</option>
            <option value="fetch">Fetch</option>
          </select>
        </div>
        <p className="confirm-dialog__body">
          {mode === 'export' ? 'Copy the current request for use outside API Tester.' : `Paste a ${format === 'curl' ? 'cURL command' : 'fetch(...) call'} to replace the current request fields.`}
        </p>
        <textarea
          ref={textRef}
          className="bulk-kv-modal__textarea request-code-modal__editor"
          value={mode === 'export' ? generated : input}
          readOnly={mode === 'export'}
          onChange={(e) => { setInput(e.target.value); setError('') }}
          placeholder={format === 'curl' ? "curl 'https://api.example.com/items'" : "fetch('https://api.example.com/items')"}
          spellCheck={false}
        />
        {error && <p className="request-code-modal__error">{error}</p>}
        <div className="confirm-dialog__actions">
          <button className="confirm-dialog__btn" onClick={onClose}>Cancel</button>
          {mode === 'export' ? (
            <button className="confirm-dialog__btn confirm-dialog__btn--primary" onClick={() => void copy()}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          ) : (
            <button className="confirm-dialog__btn confirm-dialog__btn--primary" disabled={!input.trim()} onClick={apply}>Import request</button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
