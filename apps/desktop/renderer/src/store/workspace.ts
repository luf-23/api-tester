import { create } from 'zustand'
import {
  defaultSendSettings,
  type Collection,
  type FolderNode,
  type HttpMethod,
  type KeyValue,
  type RequestWithTests,
} from '@api-tester/shared'
import { uid } from '../lib/ids'

type Node = FolderNode | RequestWithTests
export type DropPosition = 'inside' | 'before' | 'after'

function isRequest(node: Node): node is RequestWithTests {
  return 'method' in node
}

function collectRequestIdsInSubtree(node: FolderNode | RequestWithTests): string[] {
  if (isRequest(node)) return [node.id]
  return node.children.flatMap((ch) => collectRequestIdsInSubtree(ch))
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

function replaceRequestInTree(node: FolderNode, id: string, req: RequestWithTests): FolderNode {
  return {
    ...node,
    children: node.children.map((child) =>
      isRequest(child)
        ? child.id === id
          ? structuredClone(req)
          : child
        : replaceRequestInTree(child, id, req)
    ),
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
  }
}

/** Built-in headers — name fixed; enable checkbox and edit value as needed. GET keeps Content-Type off to avoid noise. */
function defaultHeaders(): KeyValue[] {
  return [
    { id: uid('kv'), key: 'Accept', value: 'application/json', enabled: true, preset: true },
    { id: uid('kv'), key: 'Content-Type', value: 'application/json', enabled: false, preset: true },
    {
      id: uid('kv'),
      key: 'Authorization',
      value: '',
      enabled: false,
      hidden: true,
      preset: true,
    },
    {
      id: uid('kv'),
      key: 'Cache-Control',
      value: 'no-cache',
      enabled: false,
      hidden: true,
      preset: true,
    },
    { id: uid('kv'), key: 'Host', value: '', enabled: false, hidden: true, preset: true },
    {
      id: uid('kv'),
      key: 'User-Agent',
      value: '',
      enabled: false,
      hidden: true,
      preset: true,
    },
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
    sendSettings: defaultSendSettings(),
  }
}

function emptyFolder(name = 'New Folder'): FolderNode {
  return { id: uid('fld'), name, children: [] }
}

function normCollectionName(s: string): string {
  return s.trim().toLowerCase()
}

function uniqueCollectionName(collections: Collection[], base: string): string {
  const taken = new Set(collections.map((c) => normCollectionName(c.name)))
  const b = base.trim() || 'Untitled Collection'
  if (!taken.has(normCollectionName(b))) return b
  let i = 2
  let candidate: string
  do {
    candidate = `${b} (${i})`
    i++
  } while (taken.has(normCollectionName(candidate)))
  return candidate
}

interface WorkspaceState {
  collections: Collection[]
  /** Last JSON written by Save / initial load / disk refresh — used for discard & quit-without-save. */
  lastPersistedCollectionsJson: string | null
  /** Request tabs with unsaved edits (relative to last persisted snapshot). */
  dirtyRequestIds: Record<string, true>
  expanded: Record<string, boolean>
  syncPersistedSnapshot: (
    collectionsJson: string,
    dirty?: 'clear-all' | { clearRequestIds: string[] }
  ) => void
  revertTabDiscard: (requestId: string) => void
  revertWorkspaceToLastPersisted: () => void
  hasUnsavedChanges: () => boolean
  toggleFolder: (id: string) => void
  expandFolder: (id: string, value?: boolean) => void
  getRequest: (id: string) => RequestWithTests | undefined
  updateRequest: (id: string, patch: Partial<RequestWithTests>) => void
  setKv: (
    id: string,
    section: 'params' | 'headers' | 'bodyFields',
    next: KeyValue[]
  ) => void
  renameNode: (id: string, name: string) => boolean
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
  lastPersistedCollectionsJson: null,
  dirtyRequestIds: {},
  syncPersistedSnapshot: (collectionsJson, dirty = 'clear-all') =>
    set((s) => {
      if (dirty === 'clear-all') {
        return {
          lastPersistedCollectionsJson: collectionsJson,
          dirtyRequestIds: {},
        }
      }
      const nextDirty = { ...s.dirtyRequestIds }
      for (const id of dirty.clearRequestIds) {
        delete nextDirty[id]
      }
      return {
        lastPersistedCollectionsJson: collectionsJson,
        dirtyRequestIds: nextDirty,
      }
    }),
  revertTabDiscard: (requestId) => {
    const snap = get().lastPersistedCollectionsJson
    if (!snap) {
      get().deleteNode(requestId)
      return
    }
    let cols: Collection[]
    try {
      cols = JSON.parse(snap) as Collection[]
    } catch {
      get().deleteNode(requestId)
      return
    }
    let restored: RequestWithTests | undefined
    for (const c of cols) {
      const r = findRequest(c.root, requestId)
      if (r) {
        restored = structuredClone(r)
        break
      }
    }
    set((s) => {
      if (!restored) {
        return {
          collections: s.collections.map((c) => ({
            ...c,
            root: removeFromTree(c.root, requestId),
          })),
          dirtyRequestIds: Object.fromEntries(
            Object.entries(s.dirtyRequestIds).filter(([k]) => k !== requestId)
          ) as Record<string, true>,
        }
      }
      const collections = s.collections.map((c) => ({
        ...c,
        root: replaceRequestInTree(c.root, requestId, restored!),
      }))
      const dirtyRequestIds = { ...s.dirtyRequestIds }
      delete dirtyRequestIds[requestId]
      return { collections, dirtyRequestIds }
    })
  },
  revertWorkspaceToLastPersisted: () => {
    const snap = get().lastPersistedCollectionsJson
    if (!snap) return
    try {
      const cols = JSON.parse(snap) as Collection[]
      set({ collections: cols, dirtyRequestIds: {} })
    } catch {
      /* keep current workspace */
    }
  },
  hasUnsavedChanges: () => Object.keys(get().dirtyRequestIds).length > 0,
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
      dirtyRequestIds: { ...s.dirtyRequestIds, [id]: true },
    })),
  setKv: (id, section, next) =>
    set((s) => ({
      collections: s.collections.map((c) => ({
        ...c,
        root: patchRequest(c.root, id, { [section]: next } as Partial<RequestWithTests>),
      })),
      dirtyRequestIds: { ...s.dirtyRequestIds, [id]: true },
    })),
  renameNode: (id, name) => {
    const trimmed = name.trim()
    if (!trimmed) return false
    const state = get()
    const colForRoot = state.collections.find((c) => c.root.id === id)
    if (colForRoot) {
      const key = normCollectionName(trimmed)
      const dup = state.collections.some(
        (c) => c.id !== colForRoot.id && normCollectionName(c.name) === key
      )
      if (dup) return false
    }
    const touchRequest = !colForRoot && state.collections.some((c) => !!findRequest(c.root, id))
    set((s) => ({
      collections: s.collections.map((c) =>
        c.root.id === id
          ? { ...c, name: trimmed, root: renameInTree(c.root, id, trimmed) }
          : { ...c, root: renameInTree(c.root, id, trimmed) }
      ),
      dirtyRequestIds: touchRequest ? { ...s.dirtyRequestIds, [id]: true } : s.dirtyRequestIds,
    }))
    return true
  },
  deleteNode: (id) =>
    set((s) => {
      const removedIds = new Set<string>()
      const collectRemoved = (node: FolderNode | RequestWithTests) => {
        if (isRequest(node)) removedIds.add(node.id)
        else for (const ch of node.children) collectRemoved(ch)
      }
      for (const c of s.collections) {
        const hit = findNodeAndParent(c.root, id)
        if (hit) {
          collectRemoved(hit.node)
          break
        }
      }
      const dirtyRequestIds = { ...s.dirtyRequestIds }
      for (const rid of removedIds) delete dirtyRequestIds[rid]

      const collections = s.collections.filter((c) => c.id !== id && c.root.id !== id)
      if (collections.length !== s.collections.length) return { collections, dirtyRequestIds }
      return {
        collections: s.collections.map((c) => ({ ...c, root: removeFromTree(c.root, id) })),
        dirtyRequestIds,
      }
    }),
  duplicateRequest: (id) => {
    let newId: string | undefined
    set((s) => {
      let assigned: string | undefined
      const collections = s.collections.map((c) => {
        const found = findNodeAndParent(c.root, id)
        if (!found || !found.parent || !isRequest(found.node)) return c
        const dup = cloneRequest(found.node)
        assigned = dup.id
        const parent = found.parent
        const index = parent.children.findIndex((x) => x.id === id) + 1
        return { ...c, root: insertInto(c.root, parent.id, dup, index) }
      })
      newId = assigned
      return {
        collections,
        dirtyRequestIds: assigned
          ? { ...s.dirtyRequestIds, [assigned]: true }
          : s.dirtyRequestIds,
      }
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
      dirtyRequestIds: { ...s.dirtyRequestIds, [node.id]: true },
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
    const unique = uniqueCollectionName(get().collections, name)
    const col: Collection = {
      id: uid('col'),
      name: unique,
      root: { id: rootId, name: unique, children: [] },
    }
    set((s) => ({
      collections: [...s.collections, col],
      expanded: { ...s.expanded, [rootId]: true },
    }))
    /** Root folder id — matches tree row `node.id` for inline rename. */
    return col.root.id
  },
  moveNode: (sourceId, targetId, position) =>
    set((s) => {
      if (sourceId === targetId) return s

      let srcIds: string[] = []
      for (const c of s.collections) {
        const src = findNodeAndParent(c.root, sourceId)
        if (src) {
          srcIds = isRequest(src.node)
            ? [src.node.id]
            : collectRequestIdsInSubtree(src.node)
          break
        }
      }

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

      const dirtyRequestIds = { ...s.dirtyRequestIds }
      for (const rid of srcIds) dirtyRequestIds[rid] = true
      return { collections, dirtyRequestIds }
    }),
  importPostmanCollection: (collection) =>
    set((s) => {
      const touched = collectRequestIdsInSubtree(collection.root)
      const dirtyRequestIds = { ...s.dirtyRequestIds }
      for (const rid of touched) dirtyRequestIds[rid] = true
      return {
        collections: [...s.collections, collection],
        expanded: { ...s.expanded, [collection.root.id]: true },
        dirtyRequestIds,
      }
    }),
}))

export function emptyKv(): KeyValue {
  return { id: uid('kv'), key: '', value: '', enabled: true, hidden: false }
}
