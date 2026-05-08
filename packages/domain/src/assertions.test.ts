import { describe, expect, it } from 'vitest'
import { evaluateAssertions, runAssertions } from './assertions'

describe('assertions', () => {
  it('passes matching status and body', () => {
    const out = runAssertions(
      [
        { id: '1', type: 'status', expected: 200, operator: 'eq' },
        { id: '2', type: 'body_contains', expected: 'ok', operator: 'contains' },
      ],
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
        bodyText: '{"ok":true}',
      }
    )
    expect(out.ok).toBe(true)
    expect(out.failures).toHaveLength(0)
  })

  it('evaluateAssertions returns one row per rule', () => {
    const rows = evaluateAssertions(
      [
        { id: 's', type: 'status', expected: 404, operator: 'eq' },
        { id: 'b', type: 'body_contains', expected: 'xyz', operator: 'contains' },
      ],
      { status: 200, headers: {}, bodyText: 'hello world' }
    )
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => !r.ok)).toBe(true)
    expect(rows[0].message).toContain('expected')
    expect(rows[1].message).toContain('missing')
  })

  it('fails json_path when expected mismatch', () => {
    const out = runAssertions(
      [{ id: '3', type: 'json_path', target: '$.id', expected: '2', operator: 'eq' }],
      { status: 200, headers: {}, bodyText: '{"id":"1"}' }
    )
    expect(out.ok).toBe(false)
    expect(out.failures[0]).toContain('expected')
  })
})