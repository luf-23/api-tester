const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#x')) {
      const codePoint = Number.parseInt(entity.slice(2), 16)
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match
    }
    if (entity.startsWith('#')) {
      const codePoint = Number.parseInt(entity.slice(1), 10)
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match
    }
    return HTML_ENTITIES[entity.toLowerCase()] ?? match
  })
}

/** Convert GitHub/electron-updater HTML or Markdown notes into compact, safe banner text. */
export function releaseNotesToPlainText(raw: string): string | undefined {
  const text = decodeHtmlEntities(
    raw
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\s*\/\s*(?:p|div|li|h[1-6])\s*>/gi, '\n')
      .replace(/<\s*li(?:\s[^>]*)?>/gi, '- ')
      .replace(/<[^>]*>/g, '')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/(?:\*\*|__|~~|`)(.*?)(?:\*\*|__|~~|`)/g, '$1')
  )

  const normalized = text
    .split(/\r?\n/)
    .map((line) => line.replace(/[\t ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim()

  return normalized || undefined
}

export function formatReleaseNotes(raw: unknown): string | undefined {
  if (raw == null) return undefined
  if (typeof raw === 'string') return releaseNotesToPlainText(raw)
  if (!Array.isArray(raw)) return undefined

  const notes = raw
    .map((entry) => {
      if (typeof entry !== 'object' || entry === null || !('note' in entry)) return undefined
      const note = (entry as { note?: unknown }).note
      return typeof note === 'string' ? releaseNotesToPlainText(note) : undefined
    })
    .filter((note): note is string => Boolean(note))

  return notes.length > 0 ? notes.join('\n') : undefined
}
