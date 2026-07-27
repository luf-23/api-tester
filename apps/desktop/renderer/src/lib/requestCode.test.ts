import { describe, expect, it } from 'vitest'
import { parseCurl, parseFetch, toCurl, toFetch } from './requestCode'
import type { RequestDraft } from '@api-tester/shared'

const request: RequestDraft = {
  id: 'r', name: 'Create', method: 'POST', url: 'https://example.com/items',
  params: [{ id: 'p', key: 'draft', value: 'yes', enabled: true }],
  headers: [{ id: 'h', key: 'Content-Type', value: 'application/json', enabled: true }],
  bodyMode: 'json', bodyText: '{"name":"tea"}', bodyFields: [],
}

describe('request code conversion', () => {
  it('exports cURL with query, headers and body', () => {
    const output = toCurl(request)
    expect(output).toContain("'https://example.com/items?draft=yes'")
    expect(output).toContain("'Content-Type: application/json'")
    expect(output).toContain(`'{"name":"tea"}'`)
  })

  it('imports cURL', () => {
    const output = parseCurl(`curl 'https://example.com/items?q=tea' -H 'Content-Type: application/json' --data-raw '{"ok":true}'`)
    expect(output).toMatchObject({ method: 'POST', url: 'https://example.com/items', bodyMode: 'json' })
    expect(output.params[0]).toMatchObject({ key: 'q', value: 'tea' })
  })

  it('round trips generated fetch', () => {
    const output = parseFetch(toFetch(request))
    expect(output).toMatchObject({ method: 'POST', url: 'https://example.com/items', bodyMode: 'json' })
    expect(output.headers[0]).toMatchObject({ key: 'Content-Type', value: 'application/json' })
    expect(output.bodyText).toBe('{"name":"tea"}')
  })

  it('imports browser-style fetch with quoted option names', () => {
    const output = parseFetch(`fetch("https://example.com/items", {
      "headers": { "content-type": "application/json", "x-token": "abc" },
      "body": "{\\"name\\":\\"tea\\"}",
      "method": "POST"
    });`)
    expect(output.method).toBe('POST')
    expect(output.bodyText).toBe('{"name":"tea"}')
    expect(output.headers).toHaveLength(2)
  })
})
