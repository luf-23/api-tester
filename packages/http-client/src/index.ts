import axios, { type AxiosRequestConfig } from 'axios'
import FormData from 'form-data'
import https from 'node:https'
import {
  defaultSendSettings,
  type HttpResponseView,
  type RequestDraft,
  type RequestSendSettings,
} from '@api-tester/shared'

export interface SendResult {
  response: HttpResponseView
  error?: string
}

function buildUrlWithParams(baseUrl: string, params: RequestDraft['params']): string {
  const u = new URL(baseUrl)
  for (const p of params) {
    if (!p.enabled || !p.key) continue
    u.searchParams.append(p.key, p.value)
  }
  return u.toString()
}

function effectiveSendSettings(draft: RequestDraft): RequestSendSettings {
  const base = defaultSendSettings()
  const s = draft.sendSettings
  if (!s) return base
  return { ...base, ...s }
}

export async function sendRequest(draft: RequestDraft): Promise<SendResult> {
  const url = buildUrlWithParams(draft.url, draft.params)
  const headers: Record<string, string> = {}
  for (const h of draft.headers) {
    if (!h.enabled || !h.key) continue
    headers[h.key] = h.value
  }

  const send = effectiveSendSettings(draft)
  const started = Date.now()
  const config: AxiosRequestConfig = {
    method: draft.method,
    url,
    headers,
    validateStatus: () => true,
    maxRedirects: send.maxRedirects,
    timeout: send.timeoutMs === 0 ? 0 : send.timeoutMs,
    /** Single responseType avoids axios merge quirks with `text` + overridden `arraybuffer`. */
    responseType: 'arraybuffer',
    transformResponse: [(data) => data],
  }
  if (!send.validateTls) {
    config.httpsAgent = new https.Agent({ rejectUnauthorized: false })
  }

  if (draft.method !== 'GET' && draft.method !== 'HEAD') {
    if (draft.bodyMode === 'json') {
      try {
        const parsed =
          draft.bodyText.trim() === '' ? undefined : JSON.parse(draft.bodyText)
        config.data = parsed
        if (!headers['Content-Type'] && !headers['content-type']) {
          headers['Content-Type'] = 'application/json'
        }
      } catch {
        return {
          response: emptyResponse(Date.now() - started),
          error: 'Invalid JSON body',
        }
      }
    } else if (draft.bodyMode === 'text') {
      config.data = draft.bodyText
    } else if (draft.bodyMode === 'form-urlencoded') {
      const sp = new URLSearchParams()
      for (const f of draft.bodyFields) {
        if (!f.enabled || !f.key) continue
        sp.append(f.key, f.value)
      }
      config.data = sp.toString()
      if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
      }
    } else if (draft.bodyMode === 'form-data') {
      const fd = new FormData()
      for (const f of draft.bodyFields) {
        if (!f.enabled || !f.key) continue
        fd.append(f.key, f.value)
      }
      config.data = fd
      const formHeaders = fd.getHeaders() as Record<string, string>
      Object.assign(headers, formHeaders)
    }
  }

  try {
    const res = await axios.request(config)
    const durationMs = Date.now() - started
    const bytes = responseDataToUint8Array(res.data)
    const bodyText = utf8DecodeLossy(bytes)
    const outHeaders: Record<string, string> = {}
    for (const [k, v] of Object.entries(res.headers as Record<string, unknown>)) {
      if (typeof v === 'string') outHeaders[k] = v
      else if (Array.isArray(v)) outHeaders[k] = v.join(', ')
    }
    const preview = imagePreviewFields(bytes, outHeaders)
    const response: HttpResponseView = {
      status: res.status,
      statusText: res.statusText ?? '',
      headers: outHeaders,
      bodyText,
      durationMs,
      sizeBytes: bytes.byteLength,
      ...preview,
    }
    return { response }
  } catch (e) {
    const durationMs = Date.now() - started
    return {
      response: emptyResponse(durationMs),
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

function emptyResponse(durationMs: number): HttpResponseView {
  return {
    status: 0,
    statusText: '',
    headers: {},
    bodyText: '',
    durationMs,
    sizeBytes: 0,
  }
}

/** Normalize axios `responseType: 'arraybuffer'` payload (Buffer in Node, ArrayBuffer elsewhere, or mis-set string). */
function responseDataToUint8Array(data: unknown): Uint8Array {
  if (data == null) return new Uint8Array()
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data)
  }
  if (ArrayBuffer.isView(data)) {
    const v = data as ArrayBufferView
    return new Uint8Array(v.buffer, v.byteOffset, v.byteLength)
  }
  if (typeof data === 'string') {
    const out = new Uint8Array(data.length)
    for (let i = 0; i < data.length; i++) out[i] = data.charCodeAt(i) & 0xff
    return out
  }
  return new Uint8Array()
}

function utf8DecodeLossy(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  } catch {
    return ''
  }
}

const PREVIEW_MAX_BYTES = 15 * 1024 * 1024

function normalizeContentType(headers: Record<string, string>): string {
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === 'content-type' && typeof v === 'string') {
      return v.split(';')[0].trim().toLowerCase()
    }
  }
  return ''
}

/** When servers send octet-stream but body is a known image signature. */
function sniffImageMime(bytes: Uint8Array): string | undefined {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png'
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return 'image/gif'
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  return undefined
}

function imagePreviewFields(
  bytes: Uint8Array,
  headers: Record<string, string>
): Pick<HttpResponseView, 'bodyBase64' | 'bodyMime'> | undefined {
  const len = bytes.byteLength
  if (len === 0 || len > PREVIEW_MAX_BYTES) return undefined
  let mime = normalizeContentType(headers)
  if (!mime.startsWith('image/')) {
    const sniffed = sniffImageMime(bytes)
    if (!sniffed) return undefined
    mime = sniffed
  }
  return {
    bodyBase64: Buffer.from(bytes).toString('base64'),
    bodyMime: mime,
  }
}
