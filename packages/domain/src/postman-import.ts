import type {
  Collection,
  FolderNode,
  HttpMethod,
  KeyValue,
  RequestWithTests,
  BodyMode,
} from '@api-tester/shared'

/** Minimal Postman Collection v2.1 importer for common REST APIs. */
export function importPostmanCollectionV21(json: unknown): Collection | null {
  if (!json || typeof json !== 'object') return null
  const root = json as Record<string, unknown>
  if (root.info && typeof root.info === 'object') {
    const info = root.info as Record<string, unknown>
    if (info.schema && String(info.schema).includes('v2.1')) {
      return mapCollection(root)
    }
  }
  return null
}

function mapCollection(raw: Record<string, unknown>): Collection {
  const info = (raw.info as Record<string, unknown>) ?? {}
  const name = String(info.name ?? 'Imported')
  const item = Array.isArray(raw.item) ? raw.item : []
  const rootFolder: FolderNode = {
    id: cryptoRandomId(),
    name: 'root',
    children: item.map((it) => mapItem(it as Record<string, unknown>)),
  }
  return {
    id: cryptoRandomId(),
    name,
    root: rootFolder,
  }
}

function mapItem(obj: Record<string, unknown>): FolderNode | RequestWithTests {
  if (obj.request) {
    return mapRequest(obj)
  }
  const name = String(obj.name ?? 'folder')
  const children = Array.isArray(obj.item)
    ? obj.item.map((it) => mapItem(it as Record<string, unknown>))
    : []
  return {
    id: cryptoRandomId(),
    name,
    children,
  }
}

function mapRequest(obj: Record<string, unknown>): RequestWithTests {
  const name = String(obj.name ?? 'Request')
  const req = obj.request as Record<string, unknown> | string
  if (typeof req === 'string') {
    let baseUrl = req
    let params: KeyValue[] = []
    try {
      const u = new URL(req)
      params = []
      u.searchParams.forEach((value, key) => {
        params.push({
          id: cryptoRandomId(),
          key,
          value,
          enabled: true,
        })
      })
      u.search = ''
      baseUrl = u.toString()
    } catch {
      /* keep raw string */
    }
    return {
      id: cryptoRandomId(),
      name,
      method: 'GET',
      url: baseUrl,
      params,
      headers: [],
      bodyMode: 'none',
      bodyText: '',
      bodyFields: [],
    }
  }
  const method = String(req.method ?? 'GET').toUpperCase() as HttpMethod
  const params = extractQueryParams(req.url)
  let url = extractUrl(req.url)
  if (params.length && url.includes('?')) {
    try {
      const u = new URL(url)
      u.search = ''
      url = u.toString()
    } catch {
      /* leave url as extracted */
    }
  }
  const headers = mapHeaders(req.header)
  const { bodyMode, bodyText, bodyFields } = mapBody(req.body)

  return {
    id: cryptoRandomId(),
    name,
    method,
    url,
    params,
    headers,
    bodyMode,
    bodyText,
    bodyFields,
  }
}

function extractQueryParams(urlField: unknown): KeyValue[] {
  if (!urlField || typeof urlField !== 'object') return []
  const u = urlField as Record<string, unknown>
  const query = u.query
  if (!Array.isArray(query)) return []
  const out: KeyValue[] = []
  for (const row of query) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const key = String(o.key ?? '')
    if (!key) continue
    out.push({
      id: cryptoRandomId(),
      key,
      value: String(o.value ?? ''),
      enabled: !o.disabled,
    })
  }
  return out
}

function extractUrl(urlField: unknown): string {
  if (typeof urlField === 'string') return urlField
  if (urlField && typeof urlField === 'object') {
    const u = urlField as Record<string, unknown>
    if (typeof u.raw === 'string') return u.raw
    const host = Array.isArray(u.host) ? (u.host as string[]).join('.') : ''
    const path = Array.isArray(u.path) ? (u.path as string[]).join('/') : ''
    const protocol = typeof u.protocol === 'string' ? u.protocol.replace(/:$/, '') : 'https'
    if (host && path) return `${protocol}://${host}/${path}`
  }
  return 'https://example.com'
}

function mapHeaders(headerField: unknown): KeyValue[] {
  if (!Array.isArray(headerField)) return []
  const out: KeyValue[] = []
  for (const h of headerField) {
    if (!h || typeof h !== 'object') continue
    const o = h as Record<string, unknown>
    const key = String(o.key ?? '')
    const val = String(o.value ?? '')
    const disabled = Boolean(o.disabled)
    out.push({
      id: cryptoRandomId(),
      key,
      value: val,
      enabled: !disabled && !!key,
    })
  }
  return out
}

function mapBody(body: unknown): {
  bodyMode: BodyMode
  bodyText: string
  bodyFields: KeyValue[]
} {
  if (!body || typeof body !== 'object') {
    return { bodyMode: 'none', bodyText: '', bodyFields: [] }
  }
  const b = body as Record<string, unknown>
  const mode = String(b.mode ?? 'raw')
  if (mode === 'raw') {
    const raw = String(b.raw ?? '')
    return { bodyMode: 'json', bodyText: raw, bodyFields: [] }
  }
  if (mode === 'urlencoded') {
    const urlencoded = Array.isArray(b.urlencoded) ? b.urlencoded : []
    const fields: KeyValue[] = []
    for (const row of urlencoded) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      fields.push({
        id: cryptoRandomId(),
        key: String(r.key ?? ''),
        value: String(r.value ?? ''),
        enabled: !r.disabled,
      })
    }
    return { bodyMode: 'form-urlencoded', bodyText: '', bodyFields: fields }
  }
  if (mode === 'formdata') {
    const formdata = Array.isArray(b.formdata) ? b.formdata : []
    const fields: KeyValue[] = []
    for (const row of formdata) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      if (String(r.type) === 'file') {
        const src = r.src
        let name = 'file'
        if (Array.isArray(src) && src.length > 0) {
          name = String(src[src.length - 1] ?? 'file')
        } else if (typeof src === 'string' && src.trim() !== '') {
          const norm = src.replace(/\\/g, '/')
          name = norm.split('/').pop() || 'file'
        }
        fields.push({
          id: cryptoRandomId(),
          key: String(r.key ?? ''),
          value: '',
          enabled: !r.disabled,
          partType: 'file',
          fileName: name,
          fileBase64: '',
        })
        continue
      }
      fields.push({
        id: cryptoRandomId(),
        key: String(r.key ?? ''),
        value: String(r.value ?? ''),
        enabled: !r.disabled,
      })
    }
    return { bodyMode: 'form-data', bodyText: '', bodyFields: fields }
  }
  return { bodyMode: 'none', bodyText: '', bodyFields: [] }
}

function cryptoRandomId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `id_${Math.random().toString(36).slice(2)}`
}
