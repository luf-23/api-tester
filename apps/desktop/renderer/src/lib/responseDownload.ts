import type { HttpResponseView } from '@api-tester/shared'

const MIME_EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/zip': 'zip',
  'application/gzip': 'gz',
  'application/json': 'json',
  'application/xml': 'xml',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'text/html': 'html',
  'text/plain': 'txt',
  'text/csv': 'csv',
}

export function headerValue(headers: Record<string, string>, name: string): string {
  const wanted = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return value
  }
  return ''
}

function cleanFileName(value: string): string {
  const withoutPath = value.replace(/\\/g, '/').split('/').pop()?.trim() ?? ''
  return withoutPath.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
}

function contentDispositionFileName(value: string): string {
  const encoded = value.match(/filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i)?.[1]
  if (encoded) {
    const raw = encoded.trim().replace(/^"|"$/g, '')
    try {
      const decoded = cleanFileName(decodeURIComponent(raw))
      if (decoded) return decoded
    } catch {
      // Fall through to filename= or the MIME-derived name.
    }
  }
  const quoted = value.match(/filename\s*=\s*"([^"]+)"/i)?.[1]
  const plain = quoted ?? value.match(/filename\s*=\s*([^;]+)/i)?.[1]
  return plain ? cleanFileName(plain.trim().replace(/^"|"$/g, '')) : ''
}

export function suggestedResponseFileName(response: HttpResponseView): string {
  const disposition = headerValue(response.headers, 'content-disposition')
  const fromHeader = contentDispositionFileName(disposition)
  if (fromHeader) return fromHeader

  const mime = headerValue(response.headers, 'content-type').split(';')[0].trim().toLowerCase()
  const extension = MIME_EXTENSIONS[mime] ?? (mime.startsWith('text/') ? 'txt' : 'bin')
  return `response.${extension}`
}

export function isBinaryResponse(response: HttpResponseView): boolean {
  const mime = headerValue(response.headers, 'content-type').split(';')[0].trim().toLowerCase()
  if (!mime) return false
  if (mime.startsWith('text/')) return false
  if (mime === 'application/json' || mime.endsWith('+json')) return false
  if (mime === 'application/xml' || mime.endsWith('+xml')) return false
  if (mime.includes('javascript')) return false
  if (mime === 'application/x-www-form-urlencoded') return false
  return true
}
