import { describe, expect, it } from 'vitest'
import {
  allocateUniqueDisplayName,
  remapCollectionIds,
  tryParseWorkspaceBundle,
  WORKSPACE_EXPORT_FORMAT,
  WORKSPACE_EXPORT_VERSION,
} from './workspace-bundle'
import type { Collection } from '@api-tester/shared'

describe('allocateUniqueDisplayName', () => {
  it('returns base when free', () => {
    const taken = new Set<string>()
    expect(allocateUniqueDisplayName(taken, 'Alpha')).toBe('Alpha')
    expect(taken.has('alpha')).toBe(true)
  })

  it('adds numeric suffix when taken', () => {
    const taken = new Set(['alpha'])
    expect(allocateUniqueDisplayName(taken, 'Alpha')).toBe('Alpha (2)')
    expect(allocateUniqueDisplayName(taken, 'Alpha')).toBe('Alpha (3)')
  })
})

describe('remapCollectionIds', () => {
  it('remaps collection and nested ids consistently', () => {
    const col: Collection = {
      id: 'same-everywhere',
      name: 'API',
      root: {
        id: 'same-everywhere',
        name: 'API',
        children: [
          {
            id: 'same-everywhere',
            name: 'GET x',
            method: 'GET',
            url: 'https://example.com',
            params: [],
            headers: [],
            bodyMode: 'none',
            bodyText: '',
            bodyFields: [],
          },
        ],
      },
    }
    const next = remapCollectionIds(col)
    expect(next.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(next.root.id).toBe(next.id)
    const req = next.root.children[0]
    if (!req || !('method' in req)) throw new Error('expected request')
    expect(req.id).toBe(next.id)
  })
})

describe('tryParseWorkspaceBundle', () => {
  it('parses v1 wrapper', () => {
    const json = JSON.stringify({
      format: WORKSPACE_EXPORT_FORMAT,
      version: WORKSPACE_EXPORT_VERSION,
      exportedAt: 1,
      meta: { id: 'w1', name: 'W' },
      environments: [],
      collections: [
        {
          id: 'c1',
          name: 'Col',
          root: { id: 'r1', name: 'Col', children: [] },
        },
      ],
    })
    const p = tryParseWorkspaceBundle(json)
    expect(p?.collections).toHaveLength(1)
    expect(p?.meta?.id).toBe('w1')
  })

  it('parses legacy exportAll shape', () => {
    const json = JSON.stringify({
      meta: { id: 'w1', name: 'W' },
      environments: [],
      collections: [
        {
          id: 'c1',
          name: 'Col',
          root: { id: 'r1', name: 'Col', children: [] },
        },
      ],
      history: [],
    })
    const p = tryParseWorkspaceBundle(json)
    expect(p?.collections).toHaveLength(1)
    expect(p?.meta?.name).toBe('W')
  })

  it('keeps history in a full workspace backup', () => {
    const history = [
      {
        id: 'h1',
        createdAt: 123,
        request: {
          id: 'r1',
          name: 'GET health',
          method: 'GET',
          url: 'https://example.com/health',
          params: [],
          headers: [],
          bodyMode: 'none',
          bodyText: '',
          bodyFields: [],
        },
      },
    ]
    const json = JSON.stringify({
      format: WORKSPACE_EXPORT_FORMAT,
      version: WORKSPACE_EXPORT_VERSION,
      exportedAt: 1,
      environments: [],
      collections: [],
      history,
    })
    expect(tryParseWorkspaceBundle(json)?.history).toEqual(history)
  })

  it('returns null for Postman-shaped JSON', () => {
    const json = JSON.stringify({
      info: {
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: [],
    })
    expect(tryParseWorkspaceBundle(json)).toBeNull()
  })
})
