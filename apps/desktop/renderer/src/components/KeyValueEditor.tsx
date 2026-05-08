import { useMemo, useState } from 'react'
import type { KeyValue } from '@api-tester/shared'
import { ui } from '../locale/ui'
import { emptyKv } from '../store/workspace'
import { IconCheck, IconPlus, IconTrash } from './icons'
import { KvCheckbox } from './KvCheckbox'

interface Props {
  rows: KeyValue[]
  onChange: (rows: KeyValue[]) => void
  keyLabel?: string
  valueLabel?: string
  withDescription?: boolean
  /** Fold rows with `hidden: true` behind a disclosure (headers preset rows). */
  collapseHidden?: boolean
}

export function KeyValueEditor({
  rows,
  onChange,
  keyLabel = ui.kv.key,
  valueLabel = ui.kv.value,
  withDescription = true,
  collapseHidden = false,
}: Props) {
  const [hiddenExpanded, setHiddenExpanded] = useState(false)

  const { mainIndices, hiddenIndices } = useMemo(() => {
    if (!collapseHidden) {
      return { mainIndices: rows.map((_, i) => i), hiddenIndices: [] as number[] }
    }
    const mainIndices: number[] = []
    const hiddenIndices: number[] = []
    rows.forEach((r, i) => (r.hidden ? hiddenIndices : mainIndices).push(i))
    return { mainIndices, hiddenIndices }
  }, [rows, collapseHidden])

  const update = (idx: number, patch: Partial<KeyValue>) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    onChange(next)
  }
  const remove = (idx: number) => onChange(rows.filter((_, i) => i !== idx))
  const add = () => onChange([...rows, emptyKv()])

  const renderRow = (idx: number) => {
    const row = rows[idx]
    const isPreset = row.preset === true
    return (
      <div key={row.id} className={`kv__row${isPreset ? ' kv__row--preset' : ''}`}>
        <div className="kv__cell kv__cell--check">
          <KvCheckbox
            checked={row.enabled}
            onCheckedChange={(enabled) => update(idx, { enabled })}
            aria-label={ui.kv.toggleRow}
          />
        </div>
        <div className="kv__cell">
          {isPreset ? (
            <span className="kv__preset-text">{row.key}</span>
          ) : (
            <input
              type="text"
              value={row.key}
              placeholder={keyLabel}
              onChange={(e) => update(idx, { key: e.target.value })}
            />
          )}
        </div>
        <div className="kv__cell">
          <input
            type="text"
            value={row.value}
            placeholder={isPreset ? presetValuePlaceholder(row.key, valueLabel) : valueLabel}
            onChange={(e) => update(idx, { value: e.target.value })}
          />
        </div>
        {withDescription && (
          <div className="kv__cell">
            {isPreset ? (
              <span className="kv__preset-text kv__preset-text--muted">{presetDescription(row.key)}</span>
            ) : (
              <input
                type="text"
                placeholder={ui.kv.description}
                defaultValue={defaultDescription(row.key)}
              />
            )}
          </div>
        )}
        {!withDescription && <div className="kv__cell" />}
        <div className="kv__cell kv__cell--check kv__cell--actions">
          {isPreset ? (
            <span className="kv__preset-no-remove" aria-hidden />
          ) : (
            <button
              type="button"
              className="kv__remove"
              onClick={() => remove(idx)}
              aria-label={ui.kv.removeRow}
              title={ui.kv.removeRow}
            >
              <IconTrash width={17} height={17} />
            </button>
          )}
        </div>
      </div>
    )
  }

  const showIndices = collapseHidden ? mainIndices : rows.map((_, i) => i)

  return (
    <div className="kv">
      <div className="kv__row kv__head">
        <div className="kv__cell kv__cell--check kv__cell--head-check" aria-hidden>
          <IconCheck width={14} height={14} />
        </div>
        <div className="kv__cell">{keyLabel}</div>
        <div className="kv__cell">{valueLabel}</div>
        <div className="kv__cell">{withDescription ? ui.kv.description : ''}</div>
        <div className="kv__cell" />
      </div>
      {showIndices.map((idx) => renderRow(idx))}
      {collapseHidden && hiddenIndices.length > 0 && (
        <button
          type="button"
          className="kv__hidden-toggle"
          onClick={() => setHiddenExpanded((v) => !v)}
        >
          {hiddenExpanded ? ui.kv.hideHiddenHeaders : ui.kv.showHiddenHeaders(hiddenIndices.length)}
        </button>
      )}
      {collapseHidden && hiddenExpanded && hiddenIndices.map((idx) => renderRow(idx))}
      <button type="button" className="kv__add" onClick={add}>
        <IconPlus width={16} height={16} /> {ui.kv.addRow}
      </button>
    </div>
  )
}

function defaultDescription(key: string): string {
  return descriptionMap(key) ?? ''
}

function presetDescription(key: string): string {
  return descriptionMap(key) ?? '—'
}

function presetValuePlaceholder(key: string, fallback: string): string {
  return descriptionMap(key) ?? fallback
}

function descriptionMap(key: string): string | undefined {
  const map: Record<string, string> = {
    limit: ui.kv.placeholders.limit,
    role: ui.kv.placeholders.role,
    page: ui.kv.placeholders.page,
    sort: ui.kv.placeholders.sort,
    Authorization: ui.kv.placeholders.Authorization,
    Accept: ui.kv.placeholders.Accept,
    'Content-Type': ui.kv.placeholders['Content-Type'],
    'Cache-Control': ui.kv.placeholders['Cache-Control'],
    Host: ui.kv.placeholders.Host,
    'User-Agent': ui.kv.placeholders['User-Agent'],
  }
  return map[key]
}
