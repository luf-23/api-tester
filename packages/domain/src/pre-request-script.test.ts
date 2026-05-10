import { describe, expect, it } from 'vitest'
import { resolveRequestForSend } from './pre-request-script'

const base = {
  id: 'r1',
  name: 'req',
  method: 'GET' as const,
  url: 'https://example.com',
  params: [] as [],
  headers: [] as [],
  bodyMode: 'none' as const,
  bodyText: '',
  bodyFields: [] as [],
}

describe('resolveRequestForSend', () => {
  it('substitutes vars only when script empty', () => {
    const vars = { a: 'hello' }
    const out = resolveRequestForSend({ ...base, url: '{{a}}/x' }, vars)
    expect(out.ok).toBe(true)
    if (out.ok) expect(out.request.url).toBe('hello/x')
  })

  it('runs script to set variables used in URL', () => {
    const vars: Record<string, string> = {}
    const out = resolveRequestForSend(
      {
        ...base,
        url: 'https://example.com?t={{ts}}',
        preRequestScript: `pm.environment.set('ts', '42')`,
      },
      vars
    )
    expect(out.ok).toBe(true)
    if (out.ok) expect(out.request.url).toBe('https://example.com?t=42')
  })

  it('headers.upsert then substitution', () => {
    const vars = { h: 'X-Token', v: 'abc' }
    const out = resolveRequestForSend(
      {
        ...base,
        url: 'https://example.com',
        headers: [
          { id: 'k1', key: 'Accept', value: 'application/json', enabled: true },
        ],
        preRequestScript: `pm.request.headers.upsert(pm.environment.get('h'), pm.environment.get('v'))`,
      },
      vars
    )
    expect(out.ok).toBe(true)
    if (out.ok) {
      const tok = out.request.headers.find((x) => x.key === 'X-Token')
      expect(tok?.value).toBe('abc')
    }
  })

  it('fails with script error message', () => {
    const out = resolveRequestForSend(
      {
        ...base,
        preRequestScript: `throw new Error('nope')`,
      },
      {}
    )
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error).toContain('nope')
  })
})
