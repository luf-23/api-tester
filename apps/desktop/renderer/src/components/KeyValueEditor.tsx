import type { KeyValue } from '@api-tester/shared'
import { ui } from '../locale/ui'
import { emptyKv } from '../store/workspace'
import { IconCheck, IconMore, IconPlus } from './icons'

interface Props {
  rows: KeyValue[]
  onChange: (rows: KeyValue[]) => void
  keyLabel?: string
  valueLabel?: string
  withDescription?: boolean
}

export function KeyValueEditor({
  rows,
  onChange,
  keyLabel = ui.kv.key,
  valueLabel = ui.kv.value,
  withDescription = true,
}: Props) {
  const update = (idx: number, patch: Partial<KeyValue>) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    onChange(next)
  }
  const remove = (idx: number) => onChange(rows.filter((_, i) => i !== idx))
  const add = () => onChange([...rows, emptyKv()])

  return (
    <div className="kv">
      <div className="kv__row kv__head">
        <div className="kv__cell kv__cell--check">
          <IconCheck width={14} height={14} />
        </div>
        <div className="kv__cell">{keyLabel}</div>
        <div className="kv__cell">{valueLabel}</div>
        <div className="kv__cell">{withDescription ? ui.kv.description : ''}</div>
        <div className="kv__cell" />
      </div>
      {rows.map((row, idx) => (
        <div key={row.id} className="kv__row">
          <div className="kv__cell kv__cell--check">
            <button
              type="button"
              className={`checkbox${row.enabled ? ' is-on' : ''}`}
              onClick={() => update(idx, { enabled: !row.enabled })}
              aria-label={ui.kv.toggleRow}
            >
              {row.enabled && <IconCheck />}
            </button>
          </div>
          <div className="kv__cell">
            <input
              type="text"
              value={row.key}
              placeholder={keyLabel}
              onChange={(e) => update(idx, { key: e.target.value })}
            />
          </div>
          <div className="kv__cell">
            <input
              type="text"
              value={row.value}
              placeholder={valueLabel}
              onChange={(e) => update(idx, { value: e.target.value })}
            />
          </div>
          {withDescription && (
            <div className="kv__cell">
              <input
                type="text"
                placeholder={ui.kv.description}
                defaultValue={defaultDescription(row.key)}
              />
            </div>
          )}
          {!withDescription && <div className="kv__cell" />}
          <div className="kv__cell kv__cell--check">
            <button type="button" className="kv__more" onClick={() => remove(idx)} aria-label={ui.kv.rowMenu}>
              <IconMore width={16} height={16} />
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="kv__add" onClick={add}>
        <IconPlus width={16} height={16} /> {ui.kv.addRow}
      </button>
    </div>
  )
}

function defaultDescription(key: string): string {
  const map: Record<string, string> = {
    limit: ui.kv.placeholders.limit,
    role: ui.kv.placeholders.role,
    page: ui.kv.placeholders.page,
    sort: ui.kv.placeholders.sort,
    Authorization: ui.kv.placeholders.Authorization,
    Accept: ui.kv.placeholders.Accept,
    'Content-Type': ui.kv.placeholders['Content-Type'],
  }
  return map[key] ?? ''
}
