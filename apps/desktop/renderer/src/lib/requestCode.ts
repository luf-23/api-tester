import type { HttpMethod, KeyValue, RequestDraft } from '@api-tester/shared'

export type RequestCodeFormat = 'curl' | 'fetch'
export type ImportedRequest = Pick<
  RequestDraft,
  'method' | 'url' | 'params' | 'headers' | 'bodyMode' | 'bodyText' | 'bodyFields'
>

let nextId = 0
const kv = (key: string, value: string): KeyValue => ({
  id: `import-kv-${Date.now()}-${nextId++}`,
  key,
  value,
  enabled: true,
})

function splitUrl(raw: string): { url: string; params: KeyValue[] } {
  const q = raw.indexOf('?')
  if (q < 0) return { url: raw, params: [] }
  const base = raw.slice(0, q)
  const hash = raw.indexOf('#', q)
  const query = raw.slice(q + 1, hash < 0 ? undefined : hash)
  const params: KeyValue[] = []
  new URLSearchParams(query).forEach((value, key) => params.push(kv(key, value)))
  return { url: base + (hash < 0 ? '' : raw.slice(hash)), params }
}

function requestUrl(request: RequestDraft): string {
  const entries = request.params.filter((p) => p.enabled && p.key)
  if (!entries.length) return request.url
  const hashAt = request.url.indexOf('#')
  const hash = hashAt < 0 ? '' : request.url.slice(hashAt)
  const withoutHash = hashAt < 0 ? request.url : request.url.slice(0, hashAt)
  const separator = withoutHash.includes('?') ? '&' : '?'
  return `${withoutHash}${separator}${entries
    .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join('&')}${hash}`
}

function enabledHeaders(request: RequestDraft): Array<[string, string]> {
  return request.headers.filter((h) => h.enabled && h.key).map((h) => [h.key, h.value])
}

function bodyValue(request: RequestDraft): string | undefined {
  if (request.bodyMode === 'json' || request.bodyMode === 'text') return request.bodyText
  if (request.bodyMode === 'form-urlencoded') {
    return request.bodyFields
      .filter((f) => f.enabled && f.key)
      .map((f) => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`)
      .join('&')
  }
  return undefined
}

const shellQuote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`

export function toCurl(request: RequestDraft): string {
  const lines = [`curl --request ${request.method} ${shellQuote(requestUrl(request))}`]
  for (const [key, value] of enabledHeaders(request)) {
    lines.push(`  --header ${shellQuote(`${key}: ${value}`)}`)
  }
  const body = bodyValue(request)
  if (body !== undefined) lines.push(`  --data-raw ${shellQuote(body)}`)
  if (request.bodyMode === 'form-data') {
    for (const field of request.bodyFields.filter((f) => f.enabled && f.key)) {
      const value =
        field.partType === 'file' && field.fileName ? `@${field.fileName}` : field.value
      lines.push(`  --form ${shellQuote(`${field.key}=${value}`)}`)
    }
  }
  return lines.join(' \\\n')
}

export function toFetch(request: RequestDraft): string {
  const init: string[] = []
  if (request.method !== 'GET') init.push(`method: ${JSON.stringify(request.method)}`)
  const headers = Object.fromEntries(enabledHeaders(request))
  if (Object.keys(headers).length) init.push(`headers: ${JSON.stringify(headers, null, 2)}`)
  const body = bodyValue(request)
  if (body !== undefined) init.push(`body: ${JSON.stringify(body)}`)
  if (request.bodyMode === 'form-data') {
    init.push(`// form-data fields require a FormData instance before calling fetch`)
  }
  const options = init.length ? `, {\n${init.map((x) => `  ${x.replace(/\n/g, '\n  ')}`).join(',\n')}\n}` : ''
  return `fetch(${JSON.stringify(requestUrl(request))}${options});`
}

export function requestToCode(request: RequestDraft, format: RequestCodeFormat): string {
  return format === 'curl' ? toCurl(request) : toFetch(request)
}

function tokenizeCurl(input: string): string[] {
  const source = input.replace(/\\\r?\n/g, ' ')
  const tokens: string[] = []
  let token = ''
  let quote: "'" | '"' | null = null
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (quote) {
      if (ch === quote) quote = null
      else if (ch === '\\' && quote === '"' && i + 1 < source.length) token += source[++i]
      else token += ch
    } else if (ch === "'" || ch === '"') quote = ch
    else if (/\s/.test(ch)) {
      if (token) {
        tokens.push(token)
        token = ''
      }
    } else if (ch === '\\' && i + 1 < source.length) token += source[++i]
    else token += ch
  }
  if (quote) throw new Error('Unclosed quote in cURL command')
  if (token) tokens.push(token)
  return tokens
}

function inferBody(headers: KeyValue[], body?: string): Pick<ImportedRequest, 'bodyMode' | 'bodyText' | 'bodyFields'> {
  if (body === undefined) return { bodyMode: 'none', bodyText: '', bodyFields: [] }
  const contentType = headers.find((h) => h.key.toLowerCase() === 'content-type')?.value.toLowerCase()
  if (contentType?.includes('application/x-www-form-urlencoded')) {
    const fields: KeyValue[] = []
    new URLSearchParams(body).forEach((value, key) => fields.push(kv(key, value)))
    return { bodyMode: 'form-urlencoded', bodyText: '', bodyFields: fields }
  }
  if (contentType?.includes('json') || /^\s*[[{]/.test(body)) {
    return { bodyMode: 'json', bodyText: body, bodyFields: [] }
  }
  return { bodyMode: 'text', bodyText: body, bodyFields: [] }
}

export function parseCurl(input: string): ImportedRequest {
  const tokens = tokenizeCurl(input.trim())
  if (tokens[0]?.toLowerCase() !== 'curl') throw new Error('The command must start with curl')
  let method: HttpMethod | undefined
  let url = ''
  let body: string | undefined
  const headers: KeyValue[] = []
  const forms: KeyValue[] = []
  const take = (i: number) => {
    if (!tokens[i + 1]) throw new Error(`Missing value after ${tokens[i]}`)
    return tokens[i + 1]
  }
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i]
    if (t === '-X' || t === '--request') method = take(i++).toUpperCase() as HttpMethod
    else if (t === '-H' || t === '--header') {
      const raw = take(i++)
      const colon = raw.indexOf(':')
      if (colon > 0) headers.push(kv(raw.slice(0, colon).trim(), raw.slice(colon + 1).trim()))
    } else if (['-d', '--data', '--data-raw', '--data-binary', '--data-urlencode'].includes(t)) {
      body = take(i++)
    } else if (t === '-F' || t === '--form') {
      const raw = take(i++)
      const eq = raw.indexOf('=')
      if (eq > 0) forms.push(kv(raw.slice(0, eq), raw.slice(eq + 1)))
    } else if (t === '--url') url = take(i++)
    else if (!t.startsWith('-')) url = t
  }
  if (!url) throw new Error('No URL found in cURL command')
  const split = splitUrl(url)
  if (forms.length) {
    return {
      method: method ?? 'POST', ...split, headers,
      bodyMode: 'form-data', bodyText: '', bodyFields: forms,
    }
  }
  return {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    ...split,
    headers,
    ...inferBody(headers, body),
  }
}

function readJsString(source: string): string {
  const quote = source[0]
  if (!["'", '"', '`'].includes(quote)) throw new Error('Expected a quoted string')
  let out = ''
  for (let i = 1; i < source.length; i++) {
    const ch = source[i]
    if (ch === quote) return out
    if (ch === '\\') {
      const next = source[++i]
      out += next === 'n' ? '\n' : next === 'r' ? '\r' : next === 't' ? '\t' : next
    } else out += ch
  }
  throw new Error('Unclosed string in fetch call')
}

function balancedObject(source: string, start: number): string {
  let depth = 0
  let quote: string | null = null
  for (let i = start; i < source.length; i++) {
    const ch = source[i]
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = null
    } else if (["'", '"', '`'].includes(ch)) quote = ch
    else if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1)
  }
  throw new Error('Unclosed options object in fetch call')
}

function propertyString(source: string, name: string): string | undefined {
  const match = new RegExp(`(?:^|[,\\s{])["']?${name}["']?\\s*:\\s*`, 'i').exec(source)
  if (!match) return undefined
  const rest = source.slice(match.index + match[0].length)
  const value = rest.trimStart()
  if (value.startsWith('JSON.stringify')) {
    const objectAt = value.indexOf('{')
    if (objectAt >= 0) return JSON.stringify(JSON.parse(balancedObject(value, objectAt)))
  }
  return readJsString(value)
}

export function parseFetch(input: string): ImportedRequest {
  const start = input.indexOf('fetch')
  const open = input.indexOf('(', start + 5)
  if (start < 0 || open < 0) throw new Error('No fetch(...) call found')
  const after = input.slice(open + 1).trimStart()
  const url = readJsString(after)
  const urlEnd = after.indexOf(after[0], 1 + url.length)
  const comma = after.indexOf(',', Math.max(1, urlEnd))
  const options = comma < 0 ? '' : balancedObject(after, after.indexOf('{', comma))
  const method = (propertyString(options, 'method')?.toUpperCase() ?? 'GET') as HttpMethod
  const body = propertyString(options, 'body')
  const headers: KeyValue[] = []
  const headersAt = options.search(/["']?headers["']?\s*:/i)
  if (headersAt >= 0) {
    const objectAt = options.indexOf('{', headersAt)
    if (objectAt >= 0) {
      const object = balancedObject(options, objectAt)
      const pair = /(['"])(.*?)\1\s*:\s*(['"])(.*?)\3/g
      let match: RegExpExecArray | null
      while ((match = pair.exec(object))) headers.push(kv(match[2], match[4]))
    }
  }
  return { method, ...splitUrl(url), headers, ...inferBody(headers, body) }
}

export function parseRequestCode(input: string, format: RequestCodeFormat): ImportedRequest {
  return format === 'curl' ? parseCurl(input) : parseFetch(input)
}
