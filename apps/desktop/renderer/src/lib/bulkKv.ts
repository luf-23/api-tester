import type { KeyValue } from '@api-tester/shared'
import { uid } from './ids'

function newParamRow(partial: Pick<KeyValue, 'key' | 'value' | 'enabled'>): KeyValue {
  return {
    id: uid('kv'),
    key: partial.key,
    value: partial.value,
    enabled: partial.enabled,
    hidden: false,
  }
}

/** Serialize query params for the bulk editor (one line per row). */
export function paramsToBulkText(rows: KeyValue[]): string {
  return rows
    .map((r) => {
      const line = `${r.key}=${r.value}`
      return r.enabled ? line : `# ${line}`
    })
    .join('\n')
}

/**
 * Parse bulk text into param rows. Empty input yields one blank row.
 * - One parameter per line.
 * - `key=value` (first `=` separates) or `key: value` (first `:` if no `=`).
 * - Lines starting with `#` (after trim) are imported as disabled.
 */
export function bulkTextToParams(text: string): KeyValue[] {
  const lines = text.split(/\r?\n/)
  const out: KeyValue[] = []

  for (let line of lines) {
    line = line.replace(/\s+$/, '')
    const trimmedStart = line.trimStart()
    if (trimmedStart === '') continue

    let enabled = true
    let content = trimmedStart
    if (content.startsWith('#')) {
      enabled = false
      content = content.slice(1).trimStart()
      if (content === '') continue
    }

    const eq = content.indexOf('=')
    const col = content.indexOf(':')
    let key = ''
    let value = ''
    if (eq !== -1 && (col === -1 || eq < col)) {
      key = content.slice(0, eq).trim()
      value = content.slice(eq + 1).trim()
    } else if (col !== -1) {
      key = content.slice(0, col).trim()
      value = content.slice(col + 1).trim()
    } else {
      key = content.trim()
    }

    out.push(newParamRow({ key, value, enabled }))
  }

  if (out.length === 0) return [newParamRow({ key: '', value: '', enabled: true })]
  return out
}
