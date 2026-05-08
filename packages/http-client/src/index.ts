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
    responseType: 'text',
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
    const res = await axios.request<ArrayBuffer | string>({
      ...config,
      responseType: 'arraybuffer',
    })
    const durationMs = Date.now() - started
    const buf = res.data as ArrayBuffer
    const bodyText = bufferToString(buf)
    const outHeaders: Record<string, string> = {}
    for (const [k, v] of Object.entries(res.headers as Record<string, unknown>)) {
      if (typeof v === 'string') outHeaders[k] = v
      else if (Array.isArray(v)) outHeaders[k] = v.join(', ')
    }
    const response: HttpResponseView = {
      status: res.status,
      statusText: res.statusText ?? '',
      headers: outHeaders,
      bodyText,
      durationMs,
      sizeBytes: buf.byteLength,
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

function bufferToString(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buf))
  } catch {
    return ''
  }
}
