import { beforeEach, describe, expect, it } from 'vitest'
import {
  defaultSendSettings,
  type Collection,
  type RequestWithTests,
} from '@api-tester/shared'
import { useWorkspaceStore } from './workspace'

function request(id: string, name: string): RequestWithTests {
  return {
    id,
    name,
    method: 'GET',
    url: 'https://example.com',
    params: [],
    headers: [],
    bodyMode: 'none',
    bodyText: '',
    bodyFields: [],
    sendSettings: defaultSendSettings(),
  }
}

describe('workspace moveNode', () => {
  beforeEach(() => {
    const source = request('req-source', 'Source request')
    const collections: Collection[] = [
      {
        id: 'collection-a',
        name: 'Collection A',
        root: { id: 'root-a', name: 'Collection A', children: [source] },
      },
      {
        id: 'collection-b',
        name: 'Collection B',
        root: { id: 'root-b', name: 'Collection B', children: [] },
      },
    ]
    useWorkspaceStore.setState({
      collections,
      lastPersistedCollectionsJson: JSON.stringify(collections),
      dirtyRequestIds: {},
      expanded: {},
    })
  })

  it('moves a request into another collection', () => {
    useWorkspaceStore.getState().moveNode('req-source', 'root-b', 'inside')

    const [sourceCollection, targetCollection] =
      useWorkspaceStore.getState().collections
    expect(sourceCollection.root.children).toHaveLength(0)
    expect(targetCollection.root.children.map((node) => node.id)).toEqual([
      'req-source',
    ])
    expect(useWorkspaceStore.getState().dirtyRequestIds).toEqual({
      'req-source': true,
    })
  })
})
