import type { KeyValue } from '@api-tester/shared'
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
  keyLabel = 'Key',
  valueLabel = 'Value',
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
        <div className="kv__cell">{withDescription ? 'Description' : ''}</div>
        <div className="kv__cell" />
      </div>
      {rows.map((row, idx) => (
        <div key={row.id} className="kv__row">
          <div className="kv__cell kv__cell--check">
            <button
              className={`checkbox${row.enabled ? ' is-on' : ''}`}
              onClick={() => update(idx, { enabled: !row.enabled })}
              aria-label="Toggle row"
            >
              {row.enabled && <IconCheck />}
            </button>
          </div>
          <div className="kv__cell">
            <input
              type="text"
              value={row.key}
              placeholder={keyLabel.toLowerCase()}
              onChange={(e) => update(idx, { key: e.target.value })}
            />
          </div>
          <div className="kv__cell">
            <input
              type="text"
              value={row.value}
              placeholder={valueLabel.toLowerCase()}
              onChange={(e) => update(idx, { value: e.target.value })}
            />
          </div>
          {withDescription && (
            <div className="kv__cell">
              <input
                type="text"
                placeholder="description"
                defaultValue={defaultDescription(row.key)}
              />
            </div>
          )}
          {!withDescription && <div className="kv__cell" />}
          <div className="kv__cell kv__cell--check">
            <button className="kv__more" onClick={() => remove(idx)} aria-label="Row menu">
              <IconMore width={16} height={16} />
            </button>
          </div>
        </div>
      ))}
      <button className="kv__add" onClick={add}>
        <IconPlus width={16} height={16} /> Add parameter
      </button>
    </div>
  )
}

function defaultDescription(key: string): string {
  const map: Record<string, string> = {
    limit: 'Maximum number of users to return',
    role: 'Filter users by role',
    page: 'Page number for pagination',
    sort: 'Sort order',
    Authorization: 'Bearer token for the request',
    Accept: 'Expected response media type',
  }
  return map[key] ?? ''
}
