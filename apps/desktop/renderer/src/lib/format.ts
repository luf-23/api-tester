export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

export function tryFormatJson(text: string): { pretty: string; ok: boolean } {
  try {
    const parsed = JSON.parse(text)
    return { pretty: JSON.stringify(parsed, null, 2), ok: true }
  } catch {
    return { pretty: text, ok: false }
  }
}

export function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export function statusClass(status: number): string {
  if (status >= 500) return 's-5xx'
  if (status >= 400) return 's-4xx'
  if (status >= 300) return 's-3xx'
  if (status >= 200) return 's-2xx'
  return 's-5xx'
}
