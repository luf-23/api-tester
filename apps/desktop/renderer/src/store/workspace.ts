import { create } from 'zustand'
import type { Collection, FolderNode, RequestWithTests, KeyValue } from '@api-tester/shared'
import { sampleCollection } from '../lib/seed'
import { uid } from '../lib/ids'

function isRequest(node: FolderNode | RequestWithTests): node is RequestWithTests {
  return 'method' in node
}

function findRequest(node: FolderNode, id: string): RequestWithTests | undefined {
  for (const child of node.children) {
    if (isRequest(child)) {
      if (child.id === id) return child
    } else {
      const hit = findRequest(child, id)
      if (hit) return hit
    }
  }
  return undefined
}

function patchRequest(node: FolderNode, id: string, patch: Partial<RequestWithTests>): FolderNode {
  return {
    ...node,
    children: node.children.map((child) =>
      isRequest(child)
        ? child.id === id
          ? { ...child, ...patch }
          : child
        : patchRequest(child, id, patch)
    ),
  }
}

interface WorkspaceState {
  collections: Collection[]
  expanded: Record<string, boolean>
  toggleFolder: (id: string) => void
  getRequest: (id: string) => RequestWithTests | undefined
  updateRequest: (id: string, patch: Partial<RequestWithTests>) => void
  setKv: (
    id: string,
    section: 'params' | 'headers' | 'bodyFields',
    next: KeyValue[]
  ) => void
}

const initialExpanded: Record<string, boolean> = {
  [sampleCollection.root.id]: true,
  fld_users: true,
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  collections: [sampleCollection],
  expanded: initialExpanded,
  toggleFolder: (id) =>
    set((s) => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } })),
  getRequest: (id) => {
    for (const col of get().collections) {
      const r = findRequest(col.root, id)
      if (r) return r
    }
    return undefined
  },
  updateRequest: (id, patch) =>
    set((s) => ({
      collections: s.collections.map((c) => ({ ...c, root: patchRequest(c.root, id, patch) })),
    })),
  setKv: (id, section, next) =>
    set((s) => ({
      collections: s.collections.map((c) => ({
        ...c,
        root: patchRequest(c.root, id, { [section]: next } as Partial<RequestWithTests>),
      })),
    })),
}))

export function emptyKv(): KeyValue {
  return { id: uid('kv'), key: '', value: '', enabled: true }
}
