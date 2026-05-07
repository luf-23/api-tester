import type { KeyValue, RequestDraft } from '@api-tester/shared'

const VAR_RE = /\{\{\s*([^}]+?)\s*\}\}/g

export function mergeVariables(
  globalKv: KeyValue[],
  envKv: KeyValue[]
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const kv of globalKv) {
    if (kv.enabled && kv.key) out[kv.key] = kv.value
  }
  for (const kv of envKv) {
    if (kv.enabled && kv.key) out[kv.key] = kv.value
  }
  return out
}

export function substituteString(input: string, vars: Record<string, string>): string {
  return input.replace(VAR_RE, (_, rawKey: string) => {
    const key = rawKey.trim()
    if (Object.prototype.hasOwnProperty.call(vars, key)) return vars[key] ?? ''
    return ''
  })
}

/** Apply variables to URL, headers, params, body fields. */
export function applyVariablesToRequest(
  draft: RequestDraft,
  vars: Record<string, string>
): RequestDraft {
  return {
    ...draft,
    url: substituteString(draft.url, vars),
    params: draft.params.map((p) => ({
      ...p,
      key: substituteString(p.key, vars),
      value: substituteString(p.value, vars),
    })),
    headers: draft.headers.map((h) => ({
      ...h,
      key: substituteString(h.key, vars),
      value: substituteString(h.value, vars),
    })),
    bodyText: substituteString(draft.bodyText, vars),
    bodyFields: draft.bodyFields.map((f) => ({
      ...f,
      key: substituteString(f.key, vars),
      value: substituteString(f.value, vars),
    })),
  }
}
