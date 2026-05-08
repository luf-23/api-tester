import { JSONPath } from 'jsonpath-plus'
import type { AssertionRule } from '@api-tester/shared'

export interface AssertionContext {
  status: number
  headers: Record<string, string>
  bodyText: string
}

/** Per-rule outcome for UI (e.g. Test Results tab). */
export interface AssertionResultItem {
  ruleId: string
  ok: boolean
  message?: string
}

export function evaluateAssertions(
  rules: AssertionRule[],
  ctx: AssertionContext
): AssertionResultItem[] {
  return rules.map((rule) => {
    const message = assertOne(rule, ctx)
    return { ruleId: rule.id, ok: message === undefined, message }
  })
}

export function runAssertions(
  rules: AssertionRule[],
  ctx: AssertionContext
): { ok: boolean; failures: string[] } {
  const items = evaluateAssertions(rules, ctx)
  const failures = items.filter((i) => !i.ok).map((i) => i.message ?? 'failed')
  return { ok: failures.length === 0, failures }
}

function assertOne(rule: AssertionRule, ctx: AssertionContext): string | undefined {
  switch (rule.type) {
    case 'status': {
      const expected = Number(rule.expected)
      if (Number.isNaN(expected)) return `[status] invalid expected`
      if (ctx.status !== expected) return `[status] expected ${expected}, got ${ctx.status}`
      return
    }
    case 'header': {
      const key = rule.target ?? ''
      const lk = key.toLowerCase()
      const actual = ctx.headers[lk] ?? ctx.headers[key]
      if (rule.operator === 'exists') {
        if (actual === undefined) return `[header] missing ${key}`
        return
      }
      const exp = String(rule.expected ?? '')
      if (actual !== exp) return `[header] ${key}: expected "${exp}", got "${actual ?? ''}"`
      return
    }
    case 'body_contains': {
      const needle = String(rule.expected ?? '')
      if (!ctx.bodyText.includes(needle))
        return `[body_contains] missing "${needle}"`
      return
    }
    case 'json_path': {
      const path = rule.target ?? '$'
      try {
        const parsed = JSON.parse(ctx.bodyText)
        const results = JSONPath({ path, json: parsed, wrap: false }) as unknown
        if (rule.operator === 'exists') {
          if (results === undefined || results === null)
            return `[json_path] ${path} not found`
          return
        }
        const exp = rule.expected
        const actual =
          Array.isArray(results) && results.length === 1 ? results[0] : results
        if (actual !== exp && String(actual) !== String(exp))
          return `[json_path] ${path}: expected ${JSON.stringify(exp)}, got ${JSON.stringify(actual)}`
        return
      } catch {
        return `[json_path] invalid JSON body`
      }
    }
    default:
      return `[unknown rule]`
  }
}
