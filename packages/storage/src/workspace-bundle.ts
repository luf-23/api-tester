import type {
  Collection,
  Environment,
  FolderNode,
  HistoryEntry,
  RequestWithTests,
  WorkspaceMeta,
} from '@api-tester/shared'
import { randomUUID } from 'node:crypto'

export const WORKSPACE_EXPORT_FORMAT = 'api-tester-workspace' as const
export const WORKSPACE_EXPORT_VERSION = 1 as const

export interface WorkspaceBundleFileV1 {
  format: typeof WORKSPACE_EXPORT_FORMAT
  version: typeof WORKSPACE_EXPORT_VERSION
  exportedAt: number
  meta?: WorkspaceMeta
  environments: Environment[]
  collections: Collection[]
  history?: HistoryEntry[]
}

function normDisplayName(s: string): string {
  return s.trim().toLowerCase()
}

/** Pick a display name not present in `taken` (normalized). Mutates `taken`. */
export function allocateUniqueDisplayName(taken: Set<string>, base: string): string {
  const b = base.trim() || 'Untitled'
  if (!taken.has(normDisplayName(b))) {
    taken.add(normDisplayName(b))
    return b
  }
  let i = 2
  let candidate: string
  do {
    candidate = `${b} (${i})`
    i++
  } while (taken.has(normDisplayName(candidate)))
  taken.add(normDisplayName(candidate))
  return candidate
}

function isFolderNode(n: unknown): n is FolderNode {
  if (!n || typeof n !== 'object') return false
  const o = n as Record<string, unknown>
  return typeof o.id === 'string' && typeof o.name === 'string' && Array.isArray(o.children)
}

function isRequestWithTests(n: unknown): n is RequestWithTests {
  if (!n || typeof n !== 'object') return false
  const o = n as Record<string, unknown>
  if ('children' in o && Array.isArray(o.children)) return false
  return typeof o.method === 'string'
}

function remapRequest(req: RequestWithTests, mapId: (id: string) => string): RequestWithTests {
  return {
    ...req,
    id: mapId(req.id),
    params: req.params.map((kv) => ({ ...kv, id: mapId(kv.id) })),
    headers: req.headers.map((kv) => ({ ...kv, id: mapId(kv.id) })),
    bodyFields: req.bodyFields.map((kv) => ({ ...kv, id: mapId(kv.id) })),
  }
}

function remapFolder(node: FolderNode, mapId: (id: string) => string): FolderNode {
  return {
    ...node,
    id: mapId(node.id),
    children: node.children.map((ch) =>
      isRequestWithTests(ch) ? remapRequest(ch, mapId) : remapFolder(ch, mapId)
    ),
  }
}

/** Deep-clone a collection with fresh ids (avoids collisions when merging into another workspace). */
export function remapCollectionIds(col: Collection): Collection {
  const idMap = new Map<string, string>()
  const mapId = (old: string) => {
    let next = idMap.get(old)
    if (!next) {
      next = randomUUID()
      idMap.set(old, next)
    }
    return next
  }
  return {
    ...col,
    id: mapId(col.id),
    root: remapFolder(col.root, mapId),
  }
}

export function remapEnvironmentIds(env: Environment): Environment {
  return {
    ...env,
    id: randomUUID(),
    variables: env.variables.map((v) => ({ ...v, id: randomUUID() })),
  }
}

export function stringifyWorkspaceBundle(payload: {
  meta: WorkspaceMeta
  environments: Environment[]
  collections: Collection[]
  history: HistoryEntry[]
}): string {
  const body: WorkspaceBundleFileV1 = {
    format: WORKSPACE_EXPORT_FORMAT,
    version: WORKSPACE_EXPORT_VERSION,
    exportedAt: Date.now(),
    meta: payload.meta,
    environments: payload.environments,
    collections: payload.collections,
    history: payload.history,
  }
  return JSON.stringify(body, null, 2)
}

export interface ParsedWorkspaceBundle {
  collections: Collection[]
  environments: Environment[]
  meta?: WorkspaceMeta
  history?: HistoryEntry[]
}

function tryWorkspaceMeta(raw: unknown): WorkspaceMeta | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const m = raw as Record<string, unknown>
  if (typeof m.id !== 'string' || typeof m.name !== 'string') return undefined
  return structuredClone(raw as WorkspaceMeta)
}

function asCollectionArray(raw: unknown): Collection[] | null {
  if (!Array.isArray(raw)) return null
  const out: Collection[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null
    const o = item as Record<string, unknown>
    if (typeof o.id !== 'string' || typeof o.name !== 'string' || !isFolderNode(o.root)) return null
    out.push(o as unknown as Collection)
  }
  return out
}

function asEnvironmentArray(raw: unknown): Environment[] {
  if (!Array.isArray(raw)) return []
  const out: Environment[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    if (typeof o.id !== 'string' || typeof o.name !== 'string' || !Array.isArray(o.variables)) continue
    out.push(o as unknown as Environment)
  }
  return out
}

function asHistoryArray(raw: unknown): HistoryEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined
  return raw
    .filter((item): item is HistoryEntry => {
      if (!item || typeof item !== 'object') return false
      const value = item as Record<string, unknown>
      return (
        typeof value.id === 'string' &&
        typeof value.createdAt === 'number' &&
        typeof value.request === 'object' &&
        value.request !== null
      )
    })
    .map((item) => structuredClone(item))
}

/** Parse our workspace JSON (v1 wrapper or legacy `exportAll` shape). Returns null if not recognized. */
export function tryParseWorkspaceBundle(text: string): ParsedWorkspaceBundle | null {
  let raw: unknown
  try {
    raw = JSON.parse(text) as unknown
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>

  if (o.format === WORKSPACE_EXPORT_FORMAT && o.version === WORKSPACE_EXPORT_VERSION) {
    const cols = asCollectionArray(o.collections)
    if (!cols) return null
    return {
      collections: structuredClone(cols),
      environments: asEnvironmentArray(o.environments),
      meta: tryWorkspaceMeta(o.meta),
      history: asHistoryArray(o.history),
    }
  }

  if (Array.isArray(o.collections)) {
    const cols = asCollectionArray(o.collections)
    if (!cols) return null
    return {
      collections: structuredClone(cols),
      environments: asEnvironmentArray(o.environments),
      meta: tryWorkspaceMeta(o.meta),
      history: asHistoryArray(o.history),
    }
  }

  return null
}
