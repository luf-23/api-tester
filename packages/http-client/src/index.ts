import axios, { type AxiosRequestConfig } from 'axios'
import FormData from 'form-data'
import https from 'node:https'
import type { Readable } from 'node:stream'
import {
  defaultSendSettings,
  type HttpResponseView,
  type RequestDraft,
  type RequestSendSettings,
} from '@api-tester/shared'

export interface SendResult {
  response: HttpResponseView
  error?: string
  /** Exact response bytes. Main-process callers may retain these for Save As; never persist them as text. */
  rawBody?: Uint8Array
}

export interface StreamHandlers {
  onHeaders: (info: { status: number; statusText: string; headers: Record<string, string> }) => void
  onChunk: (text: string) => void
}

export interface SendRequestOptions {
  /** Resolve the operating system proxy for a URL. `null` means connect directly. */
  resolveSystemProxy?: (url: string) => Promise<string | null>
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

type BuildConfigResult =
  | { ok: false; result: SendResult }
  | { ok: true; config: AxiosRequestConfig }

function axiosProxyFromUrl(value: string): NonNullable<AxiosRequestConfig['proxy']> {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('Invalid proxy URL. Use http://host:port or https://host:port')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Unsupported proxy protocol. Use http:// or https://')
  }
  if (!url.hostname) throw new Error('Proxy URL must include a host')

  const proxy: NonNullable<AxiosRequestConfig['proxy']> = {
    protocol: url.protocol.slice(0, -1),
    host: url.hostname,
    port: url.port ? Number.parseInt(url.port, 10) : url.protocol === 'https:' ? 443 : 80,
  }
  if (url.username || url.password) {
    proxy.auth = {
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
    }
  }
  return proxy
}

async function buildAxiosConfig(
  draft: RequestDraft,
  options: SendRequestOptions
): Promise<BuildConfigResult> {
  const url = buildUrlWithParams(draft.url, draft.params)
  const headers: Record<string, string> = {}
  for (const h of draft.headers) {
    if (!h.enabled || !h.key) continue
    headers[h.key] = h.value
  }

  const send = effectiveSendSettings(draft)
  const config: AxiosRequestConfig = {
    method: draft.method,
    url,
    headers,
    validateStatus: () => true,
    maxRedirects: send.maxRedirects,
    timeout: send.timeoutMs === 0 ? 0 : send.timeoutMs,
    transformResponse: [(data) => data],
  }
  const proxyMode = send.proxyMode ?? 'system'
  if (proxyMode === 'direct') {
    config.proxy = false
  } else if (proxyMode === 'custom') {
    const proxyUrl = send.proxyUrl?.trim() ?? ''
    if (!proxyUrl) {
      return {
        ok: false,
        result: { response: emptyResponse(0), error: 'Custom proxy URL is required' },
      }
    }
    try {
      config.proxy = axiosProxyFromUrl(proxyUrl)
    } catch (e) {
      return {
        ok: false,
        result: {
          response: emptyResponse(0),
          error: e instanceof Error ? e.message : String(e),
        },
      }
    }
  } else if (options.resolveSystemProxy) {
    try {
      const proxyUrl = await options.resolveSystemProxy(url)
      config.proxy = proxyUrl ? axiosProxyFromUrl(proxyUrl) : false
    } catch (e) {
      return {
        ok: false,
        result: {
          response: emptyResponse(0),
          error: e instanceof Error ? e.message : String(e),
        },
      }
    }
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
          ok: false,
          result: {
            response: emptyResponse(0),
            error: 'Invalid JSON body',
          },
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
        if (f.partType === 'file') {
          const raw = f.fileBase64?.trim() ?? ''
          if (!raw) {
            return {
              ok: false,
              result: {
                response: emptyResponse(0),
                error: `Form-data file field "${f.key}" has no file attached`,
              },
            }
          }
          const buf = Buffer.from(raw, 'base64')
          if (buf.length === 0) {
            return {
              ok: false,
              result: {
                response: emptyResponse(0),
                error:
                  raw.length > 0
                    ? `Form-data file field "${f.key}" has invalid base64 payload`
                    : `Form-data file field "${f.key}" has no file attached`,
              },
            }
          }
          const opts: { filename?: string; contentType?: string } = {}
          if (f.fileName) opts.filename = f.fileName
          if (f.fileMime) opts.contentType = f.fileMime
          fd.append(f.key, buf, opts)
        } else {
          fd.append(f.key, f.value)
        }
      }
      config.data = fd
      const formHeaders = fd.getHeaders() as Record<string, string>
      Object.assign(headers, formHeaders)
    }
  }

  return { ok: true, config }
}

export async function sendRequest(
  draft: RequestDraft,
  options: SendRequestOptions = {}
): Promise<SendResult> {
  const built = await buildAxiosConfig(draft, options)
  if (!built.ok) return built.result

  const started = Date.now()
  const config: AxiosRequestConfig = {
    ...built.config,
    responseType: 'arraybuffer',
  }

  try {
    const res = await axios.request(config)
    const durationMs = Date.now() - started
    const bytes = responseDataToUint8Array(res.data)
    const outHeaders: Record<string, string> = {}
    for (const [k, v] of Object.entries(res.headers as Record<string, unknown>)) {
      if (typeof v === 'string') outHeaders[k] = v
      else if (Array.isArray(v)) outHeaders[k] = v.join(', ')
    }
    const bodyText = isTextualResponse(outHeaders) ? utf8DecodeLossy(bytes) : ''
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
    return { response, rawBody: bytes }
  } catch (e) {
    const durationMs = Date.now() - started
    return {
      response: emptyResponse(durationMs),
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export async function sendRequestStream(
  draft: RequestDraft,
  handlers: StreamHandlers,
  options: SendRequestOptions = {}
): Promise<SendResult> {
  const built = await buildAxiosConfig(draft, options)
  if (!built.ok) return built.result

  const started = Date.now()
  const config: AxiosRequestConfig = {
    ...built.config,
    responseType: 'stream',
    /** Let Node receive raw bytes; axios default transforms break streaming. */
    transformResponse: [(data) => data],
  }

  try {
    const res = await axios.request(config)
    const outHeaders: Record<string, string> = {}
    for (const [k, v] of Object.entries(res.headers as Record<string, unknown>)) {
      if (typeof v === 'string') outHeaders[k] = v
      else if (Array.isArray(v)) outHeaders[k] = v.join(', ')
    }

    handlers.onHeaders({
      status: res.status,
      statusText: res.statusText ?? '',
      headers: outHeaders,
    })

    const stream = res.data as Readable
    const chunks: Buffer[] = []
    const decoder = new TextDecoder('utf-8', { fatal: false })
    const decodeAsText = isTextualResponse(outHeaders)

    return await new Promise((resolve) => {
      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
        if (decodeAsText) handlers.onChunk(decoder.decode(chunk, { stream: true }))
      })
      stream.on('end', () => {
        if (decodeAsText) handlers.onChunk(decoder.decode())
        const bytes = Buffer.concat(chunks)
        const bodyText = decodeAsText ? utf8DecodeLossy(new Uint8Array(bytes)) : ''
        const durationMs = Date.now() - started
        const preview = imagePreviewFields(new Uint8Array(bytes), outHeaders)
        resolve({
          response: {
            status: res.status,
            statusText: res.statusText ?? '',
            headers: outHeaders,
            bodyText,
            durationMs,
            sizeBytes: bytes.byteLength,
            ...preview,
          },
          rawBody: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
        })
      })
      stream.on('error', (err: Error) => {
        resolve({
          response: emptyResponse(Date.now() - started),
          error: err.message,
        })
      })
    })
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

function isTextualResponse(headers: Record<string, string>): boolean {
  const mime = normalizeContentType(headers)
  if (!mime || mime.startsWith('text/')) return true
  if (mime === 'application/json' || mime.endsWith('+json')) return true
  if (mime === 'application/xml' || mime.endsWith('+xml')) return true
  if (mime.includes('javascript')) return true
  return mime === 'application/x-www-form-urlencoded'
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
