import vm from 'node:vm'
import { randomUUID } from 'node:crypto'
import type { HttpMethod, RequestDraft } from '@api-tester/shared'
import { applyVariablesToRequest } from './variables'

const SCRIPT_TIMEOUT_MS = 5000

const METHODS = new Set<HttpMethod>([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
])

function parseMethod(m: string): HttpMethod | undefined {
  const u = m.toUpperCase()
  return METHODS.has(u as HttpMethod) ? (u as HttpMethod) : undefined
}

function createPmApi(vars: Record<string, string>, draft: RequestDraft) {
  const environment = {
    get(key: string): string | undefined {
      const k = String(key)
      return Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : undefined
    },
    set(key: string, value: unknown): void {
      vars[String(key)] = String(value)
    },
    unset(key: string): void {
      delete vars[String(key)]
    },
  }

  const headers = {
    upsert(key: string, value: unknown): void {
      const k = String(key)
      const v = String(value)
      const idx = draft.headers.findIndex((h) => h.key.toLowerCase() === k.toLowerCase())
      if (idx >= 0) {
        const row = draft.headers[idx]
        draft.headers[idx] = { ...row, key: k, value: v, enabled: true }
      } else {
        draft.headers.push({ id: randomUUID(), key: k, value: v, enabled: true })
      }
    },
    remove(key: string): void {
      const k = String(key).toLowerCase()
      draft.headers = draft.headers.filter((h) => h.key.toLowerCase() !== k)
    },
    get(key: string): string | undefined {
      const k = String(key).toLowerCase()
      const row = draft.headers.find((h) => h.enabled && h.key.toLowerCase() === k)
      return row?.value
    },
  }

  const request = {
    get url(): string {
      return draft.url
    },
    setUrl(u: string): void {
      draft.url = String(u)
    },
    get method(): string {
      return draft.method
    },
    setMethod(m: string): void {
      const parsed = parseMethod(m)
      if (!parsed) throw new Error(`Invalid HTTP method: ${m}`)
      draft.method = parsed
    },
    headers,
    body: {
      get raw(): string {
        return draft.bodyText
      },
      set raw(text: string) {
        draft.bodyText = String(text)
      },
    },
  }

  return {
    environment,
    variables: environment,
    request,
  }
}

function executeUserScript(code: string, pm: ReturnType<typeof createPmApi>): string | undefined {
  const sandbox = {
    pm,
    console: {
      log: (...args: unknown[]) => {
        console.info('[pre-request]', ...args)
      },
    },
    Math,
    Date,
    JSON,
    String,
    Number,
    Boolean,
    Array,
    Object,
    parseInt,
    parseFloat,
    isFinite,
    isNaN,
    encodeURIComponent,
    decodeURIComponent,
    btoa: (s: string) => Buffer.from(String(s), 'utf8').toString('base64'),
    atob: (s: string) => Buffer.from(String(s), 'base64').toString('utf8'),
  }

  const ctx = vm.createContext(sandbox)
  try {
    vm.runInContext(code, ctx, {
      timeout: SCRIPT_TIMEOUT_MS,
      filename: 'pre-request.js',
      displayErrors: true,
    })
    return undefined
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

/**
 * Mutates `vars` when script calls pm.environment.set / pm.variables.set.
 * Returns a draft ready for variable substitution and HTTP send.
 */
export function resolveRequestForSend(
  draft: RequestDraft & { preRequestScript?: string },
  vars: Record<string, string>
): { ok: true; request: RequestDraft } | { ok: false; error: string } {
  const working = structuredClone(draft) as RequestDraft & { preRequestScript?: string }
  const script = working.preRequestScript?.trim()
  if (script) {
    const pm = createPmApi(vars, working)
    const err = executeUserScript(script, pm)
    if (err) return { ok: false, error: err }
  }
  const resolved = applyVariablesToRequest(working, vars)
  return { ok: true, request: resolved }
}
