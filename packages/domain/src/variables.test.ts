import { describe, expect, it } from 'vitest'
import { applyVariablesToRequest, mergeVariables, substituteString } from './variables'
import type { RequestDraft } from '@api-tester/shared'

describe('variables', () => {
  it('merges env over global', () => {
    const out = mergeVariables(
      [
        { id: '1', key: 'baseUrl', value: 'https://a.com', enabled: true },
        { id: '2', key: 'token', value: 'global', enabled: true },
      ],
      [{ id: '3', key: 'token', value: 'env', enabled: true }]
    )
    expect(out.baseUrl).toBe('https://a.com')
    expect(out.token).toBe('env')
  })

  it('replaces placeholders in request fields', () => {
    const draft: RequestDraft = {
      id: 'r1',
      name: 't',
      method: 'GET',
      url: '{{baseUrl}}/users/{{id}}',
      params: [{ id: 'p1', key: 'q', value: '{{id}}', enabled: true }],
      headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{token}}', enabled: true }],
      bodyMode: 'json',
      bodyText: '{"id":"{{id}}"}',
      bodyFields: [],
    }
    const out = applyVariablesToRequest(draft, {
      baseUrl: 'https://api.example.com',
      id: '42',
      token: 'abc',
    })
    expect(out.url).toBe('https://api.example.com/users/42')
    expect(out.params[0].value).toBe('42')
    expect(out.headers[0].value).toBe('Bearer abc')
    expect(out.bodyText).toContain('42')
  })

  it('returns empty string for missing var', () => {
    expect(substituteString('x={{missing}}', {})).toBe('x=')
  })
})