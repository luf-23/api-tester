import { create } from 'zustand'
import type {
  Collection,
  FolderNode,
  HttpMethod,
  KeyValue,
  RequestWithTests,
} from '@api-tester/shared'
import { uid } from '../lib/ids'

type Node = FolderNode | RequestWithTests
export type DropPosition = 'inside' | 'before' | 'after'

function isRequest(node: Node): node is RequestWithTests {
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

function findNodeAndParent(
  root: FolderNode,
  id: string,
  parent: FolderNode | null = null
): { node: Node; parent: FolderNode | null } | undefined {
  if (root.id === id) return { node: root, parent }
  for (const child of root.children) {
    if (child.id === id) return { node: child, parent: root }
    if (!isRequest(child)) {
      const hit = findNodeAndParent(child, id, root)
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

function renameInTree(node: FolderNode, id: string, name: string): FolderNode {
  if (node.id === id) return { ...node, name }
  return {
    ...node,
    children: node.children.map((child) =>
      isRequest(child)
        ? child.id === id
          ? { ...child, name }
          : child
        : renameInTree(child, id, name)
    ),
  }
}

function removeFromTree(node: FolderNode, id: string): FolderNode {
  return {
    ...node,
    children: node.children
      .filter((c) => c.id !== id)
      .map((c) => (isRequest(c) ? c : removeFromTree(c, id))),
  }
}

function insertInto(
  node: FolderNode,
  parentId: string,
  child: Node,
  index?: number
): FolderNode {
  if (node.id === parentId) {
    const next = [...node.children]
    if (index === undefined || index < 0 || index > next.length) next.push(child)
    else next.splice(index, 0, child)
    return { ...node, children: next }
  }
  return {
    ...node,
    children: node.children.map((c) =>
      isRequest(c) ? c : insertInto(c, parentId, child, index)
    ),
  }
}

function isAncestor(node: FolderNode, ancestorId: string, targetId: string): boolean {
  if (node.id !== ancestorId) {
    for (const c of node.children) {
      if (!isRequest(c)) {
        if (isAncestor(c, ancestorId, targetId)) return true
      }
    }
    return false
  }
  // Searching subtree of ancestor for target
  function contains(n: FolderNode): boolean {
    for (const c of n.children) {
      if (c.id === targetId) return true
      if (!isRequest(c) && contains(c)) return true
    }
    return false
  }
  return contains(node)
}

function cloneRequest(req: RequestWithTests): RequestWithTests {
  const dupKv = (arr: KeyValue[]): KeyValue[] =>
    arr.map((kv) => ({ ...kv, id: uid('kv') }))
  return {
    ...req,
    id: uid('req'),
    name: `${req.name} copy`,
    params: dupKv(req.params),
    headers: dupKv(req.headers),
    bodyFields: dupKv(req.bodyFields),
    tests: req.tests.map((t) => ({ ...t, id: uid('a') })),
  }
}

/** Common starter headers — users can toggle off or edit. GET keeps Content-Type off to avoid noise. */
function defaultHeaders(): KeyValue[] {
  return [
    { id: uid('kv'), key: 'Accept', value: 'application/json', enabled: true },
    { id: uid('kv'), key: 'Content-Type', value: 'application/json', enabled: false },
    { id: uid('kv'), key: 'Authorization', value: '', enabled: false },
  ]
}

function emptyRequest(name = 'New Request', method: HttpMethod = 'GET'): RequestWithTests {
  return {
    id: uid('req'),
    name,
    method,
    url: 'https://api.example.com/endpoint',
    params: [],
    headers: defaultHeaders(),
    bodyMode: 'none',
    bodyText: '',
    bodyFields: [],
    tests: [],
  }
}

function emptyFolder(name = 'New Folder'): FolderNode {
  return { id: uid('fld'), name, children: [] }
}

interface WorkspaceState {
  collections: Collection[]
  expanded: Record<string, boolean>
  toggleFolder: (id: string) => void
  expandFolder: (id: string, value?: boolean) => void
  getRequest: (id: string) => RequestWithTests | undefined
  updateRequest: (id: string, patch: Partial<RequestWithTests>) => void
  setKv: (
    id: string,
    section: 'params' | 'headers' | 'bodyFields',
    next: KeyValue[]
  ) => void
  renameNode: (id: string, name: string) => void
  deleteNode: (id: string) => void
  duplicateRequest: (id: string) => string | undefined
  addRequest: (parentId: string, method?: HttpMethod) => string
  addFolder: (parentId: string) => string
  addCollection: (name?: string) => string
  moveNode: (sourceId: string, targetId: string, position: DropPosition) => void
  importPostmanCollection: (collection: Collection) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  collections: [],
  expanded: {},
  toggleFolder: (id) =>
    set((s) => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } })),
  expandFolder: (id, value) =>
    set((s) => ({
      expanded: { ...s.expanded, [id]: value ?? true },
    })),
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
  renameNode: (id, name) =>
    set((s) => ({
      collections: s.collections.map((c) =>
        c.root.id === id
          ? { ...c, name, root: renameInTree(c.root, id, name) }
          : { ...c, root: renameInTree(c.root, id, name) }
      ),
    })),
  deleteNode: (id) =>
    set((s) => {
      const collections = s.collections.filter((c) => c.id !== id && c.root.id !== id)
      if (collections.length !== s.collections.length) return { collections }
      return {
        collections: s.collections.map((c) => ({ ...c, root: removeFromTree(c.root, id) })),
      }
    }),
  duplicateRequest: (id) => {
    let newId: string | undefined
    set((s) => {
      const collections = s.collections.map((c) => {
        const found = findNodeAndParent(c.root, id)
        if (!found || !found.parent || !isRequest(found.node)) return c
        const dup = cloneRequest(found.node)
        newId = dup.id
        const parent = found.parent
        const index = parent.children.findIndex((x) => x.id === id) + 1
        return { ...c, root: insertInto(c.root, parent.id, dup, index) }
      })
      return { collections }
    })
    return newId
  },
  addRequest: (parentId, method = 'GET') => {
    const node = emptyRequest('New Request', method)
    set((s) => ({
      collections: s.collections.map((c) => ({
        ...c,
        root: insertInto(c.root, parentId, node),
      })),
      expanded: { ...s.expanded, [parentId]: true },
    }))
    return node.id
  },
  addFolder: (parentId) => {
    const node = emptyFolder()
    set((s) => ({
      collections: s.collections.map((c) => ({
        ...c,
        root: insertInto(c.root, parentId, node),
      })),
      expanded: { ...s.expanded, [parentId]: true, [node.id]: true },
    }))
    return node.id
  },
  addCollection: (name = 'Untitled Collection') => {
    const rootId = uid('root')
    const col: Collection = {
      id: uid('col'),
      name,
      root: { id: rootId, name, children: [] },
    }
    set((s) => ({
      collections: [...s.collections, col],
      expanded: { ...s.expanded, [rootId]: true },
    }))
    return col.id
  },
  moveNode: (sourceId, targetId, position) =>
    set((s) => {
      if (sourceId === targetId) return s
      const collections = s.collections.map((c) => {
        const src = findNodeAndParent(c.root, sourceId)
        const tgt = findNodeAndParent(c.root, targetId)
        if (!src || !tgt || !src.parent) return c
        // prevent moving folder into its own descendant
        if (!isRequest(src.node) && isAncestor(src.node, src.node.id, targetId)) return c

        let root = removeFromTree(c.root, sourceId)
        if (position === 'inside') {
          if (isRequest(tgt.node)) return c
          root = insertInto(root, tgt.node.id, src.node)
        } else {
          if (!tgt.parent) return c
          const parent = tgt.parent
          // Reread parent index after removal in case sibling ordering shifted
          const parentNow = findNodeAndParent(root, parent.id)?.node as FolderNode | undefined
          if (!parentNow) return c
          const idx = parentNow.children.findIndex((x) => x.id === targetId)
          const insertIdx = position === 'after' ? idx + 1 : idx
          root = insertInto(root, parent.id, src.node, insertIdx)
        }
        return { ...c, root }
      })
      return { collections }
    }),
  importPostmanCollection: (collection) =>
    set((s) => ({
      collections: [...s.collections, collection],
      expanded: { ...s.expanded, [collection.root.id]: true },
    })),
}))

export function emptyKv(): KeyValue {
  return { id: uid('kv'), key: '', value: '', enabled: true }
}
