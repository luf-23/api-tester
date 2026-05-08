import { describe, expect, it } from 'vitest'
import { importPostmanCollectionV21 } from './postman-import'

describe('postman import', () => {
  it('imports basic v2.1 collection', () => {
    const pm = {
      info: {
        name: 'Demo',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: [
        {
          name: 'GetUser',
          request: {
            method: 'GET',
            url: {
              raw: 'https://api.example.com/users?page=1&q=test',
              host: ['api', 'example', 'com'],
              path: ['users'],
              query: [
                { key: 'page', value: '1', disabled: false },
                { key: 'q', value: 'test' },
              ],
            },
          },
        },
      ],
    }
    const col = importPostmanCollectionV21(pm)
    expect(col).not.toBeNull()
    expect(col?.name).toBe('Demo')
    expect(col?.root.children).toHaveLength(1)
    const req = col?.root.children[0]
    expect(req && 'method' in req).toBe(true)
    if (req && 'method' in req) {
      expect(req.url).toBe('https://api.example.com/users')
      expect(req.params).toHaveLength(2)
      expect(req.params.find((p) => p.key === 'page')?.value).toBe('1')
      expect(req.params.find((p) => p.key === 'q')?.value).toBe('test')
    }
  })

  it('returns null for non-v2.1 payload', () => {
    const col = importPostmanCollectionV21({ info: { name: 'X', schema: 'v2.0' } })
    expect(col).toBeNull()
  })
})