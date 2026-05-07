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
            url: { raw: 'https://api.example.com/users/1' },
          },
        },
      ],
    }
    const col = importPostmanCollectionV21(pm)
    expect(col).not.toBeNull()
    expect(col?.name).toBe('Demo')
    expect(col?.root.children).toHaveLength(1)
  })

  it('returns null for non-v2.1 payload', () => {
    const col = importPostmanCollectionV21({ info: { name: 'X', schema: 'v2.0' } })
    expect(col).toBeNull()
  })
})