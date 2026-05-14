import { useRef, useState, type ChangeEvent } from 'react'
import type { KeyValue } from '@api-tester/shared'
import { ui } from '../locale/ui'
import { emptyKv } from '../store/workspace'
import { IconCheck, IconPlus, IconTrash } from './icons'
import { KvCheckbox } from './KvCheckbox'

const MAX_FILE_BYTES = 20 * 1024 * 1024

function approxBytesFromBase64(b64: string): number {
  const t = b64.trim()
  if (!t) return 0
  const pad = t.endsWith('==') ? 2 : t.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((t.length * 3) / 4) - pad)
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunk = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  rows: KeyValue[]
  onChange: (rows: KeyValue[]) => void
}

export function FormDataFieldsEditor({ rows, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const pickIndexRef = useRef<number | null>(null)
  const [hint, setHint] = useState<string | null>(null)

  const update = (idx: number, patch: Partial<KeyValue>) => {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  const remove = (idx: number) => onChange(rows.filter((_, i) => i !== idx))
  const add = () => onChange([...rows, emptyKv()])

  const onPickClick = (idx: number) => {
    pickIndexRef.current = idx
    fileRef.current?.click()
  }

  const onFileInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const idx = pickIndexRef.current
    pickIndexRef.current = null
    const file = e.target.files?.[0]
    e.target.value = ''
    if (idx == null || !file) return

    if (file.size > MAX_FILE_BYTES) {
      setHint(ui.request.formDataFileTooLarge(formatBytes(MAX_FILE_BYTES)))
      window.setTimeout(() => setHint(null), 4500)
      return
    }

    const buf = await file.arrayBuffer()
    const fileBase64 = arrayBufferToBase64(buf)
    update(idx, {
      partType: 'file',
      fileName: file.name,
      fileMime: file.type || undefined,
      fileBase64,
      value: '',
    })
  }

  const setPartKind = (idx: number, kind: 'text' | 'file') => {
    const row = rows[idx]
    if (kind === 'text') {
      update(idx, {
        partType: 'text',
        fileName: undefined,
        fileMime: undefined,
        fileBase64: undefined,
        value: row.partType === 'file' ? '' : row.value,
      })
    } else {
      update(idx, {
        partType: 'file',
        value: '',
        fileBase64: row.partType === 'file' ? row.fileBase64 : undefined,
        fileName: row.partType === 'file' ? row.fileName : undefined,
        fileMime: row.partType === 'file' ? row.fileMime : undefined,
      })
    }
  }

  return (
    <div className="kv form-data-fields">
      <input ref={fileRef} type="file" className="form-data-fields__file-input" onChange={onFileInputChange} />
      {hint && <p className="form-data-fields__hint">{hint}</p>}
      <div className="kv__row kv__head">
        <div className="kv__cell kv__cell--check kv__cell--head-check" aria-hidden>
          <IconCheck width={14} height={14} />
        </div>
        <div className="kv__cell">{ui.kv.key}</div>
        <div className="kv__cell form-data-fields__col-type">{ui.request.formDataPartType}</div>
        <div className="kv__cell">{ui.request.formDataValueOrFile}</div>
        <div className="kv__cell" aria-hidden />
      </div>
      {rows.map((row, idx) => {
        const isFile = row.partType === 'file'
        const attached = !!(isFile && row.fileBase64 && row.fileBase64.length > 0)
        const approx = attached && row.fileBase64 ? approxBytesFromBase64(row.fileBase64) : 0
        return (
          <div key={row.id} className="kv__row">
            <div className="kv__cell kv__cell--check">
              <KvCheckbox
                checked={row.enabled}
                onCheckedChange={(enabled) => update(idx, { enabled })}
                aria-label={ui.kv.toggleRow}
              />
            </div>
            <div className="kv__cell">
              <input
                type="text"
                value={row.key}
                placeholder={ui.kv.key}
                spellCheck={false}
                onChange={(e) => update(idx, { key: e.target.value })}
              />
            </div>
            <div className="kv__cell form-data-fields__col-type">
              <select
                className="form-data-fields__type-select"
                value={isFile ? 'file' : 'text'}
                onChange={(e) => setPartKind(idx, e.target.value === 'file' ? 'file' : 'text')}
                aria-label={ui.request.formDataPartType}
              >
                <option value="text">{ui.request.formDataTypeText}</option>
                <option value="file">{ui.request.formDataTypeFile}</option>
              </select>
            </div>
            <div className="kv__cell form-data-fields__col-value">
              {isFile ? (
                <div className="form-data-fields__file-cell">
                  <span className="form-data-fields__file-meta dim" title={row.fileName}>
                    {attached
                      ? `${row.fileName ?? ui.request.formDataUnnamedFile}${approx ? ` (${formatBytes(approx)})` : ''}`
                      : ui.request.formDataNoFile}
                  </span>
                  <button type="button" className="btn btn--sm" onClick={() => onPickClick(idx)}>
                    {ui.request.formDataChooseFile}
                  </button>
                  {attached && (
                    <button
                      type="button"
                      className="btn btn--sm"
                      onClick={() =>
                        update(idx, { fileBase64: undefined, fileMime: undefined, fileName: undefined })
                      }
                    >
                      {ui.request.formDataClearFile}
                    </button>
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  value={row.value}
                  placeholder={ui.kv.value}
                  spellCheck={false}
                  onChange={(e) => update(idx, { value: e.target.value })}
                />
              )}
            </div>
            <div className="kv__cell kv__cell--check kv__cell--actions">
              <button
                type="button"
                className="kv__remove"
                onClick={() => remove(idx)}
                aria-label={ui.kv.removeRow}
                title={ui.kv.removeRow}
              >
                <IconTrash width={17} height={17} />
              </button>
            </div>
          </div>
        )
      })}
      <button type="button" className="kv__add" onClick={add}>
        <IconPlus width={16} height={16} /> {ui.kv.addRow}
      </button>
    </div>
  )
}
