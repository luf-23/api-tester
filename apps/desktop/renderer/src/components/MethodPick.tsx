import { useEffect, useId, useRef, useState } from 'react'
import type { HttpMethod } from '@api-tester/shared'
import { IconChevDown } from './icons'

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

export function MethodPick({
  value,
  onChange,
}: {
  value: HttpMethod
  onChange: (m: HttpMethod) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerId = useId()

  useEffect(() => {
    if (!open) return
    const onDocDown = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={`method-pick${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="method-pick__trigger"
        id={triggerId}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="method-pick__value" style={{ color: `var(--method-${value.toLowerCase()})` }}>
          {value}
        </span>
        <IconChevDown width={16} height={16} aria-hidden className="method-pick__chev" />
      </button>
      {open && (
        <ul className="method-pick__menu" role="listbox" aria-labelledby={triggerId}>
          {METHODS.map((m) => (
            <li key={m} role="none">
              <button
                type="button"
                role="option"
                aria-selected={m === value}
                className={`method-pick__option${m === value ? ' is-active' : ''}`}
                style={{ color: `var(--method-${m.toLowerCase()})` }}
                onClick={() => {
                  onChange(m)
                  setOpen(false)
                }}
              >
                {m}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
