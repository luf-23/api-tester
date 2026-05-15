import type { Collection, FolderNode, RequestWithTests } from '@api-tester/shared'
import { useTabsStore } from '../store/tabs'
import { useWorkspaceStore } from '../store/workspace'

function isReq(n: FolderNode | RequestWithTests): n is RequestWithTests {
  return 'method' in n
}

function findReq(node: FolderNode, id: string): RequestWithTests | undefined {
  for (const ch of node.children) {
    if (isReq(ch)) {
      if (ch.id === id) return ch
    } else {
      const hit = findReq(ch, id)
      if (hit) return hit
    }
  }
  return undefined
}

function findColWithRequest(cols: Collection[], requestId: string): Collection | undefined {
  for (const c of cols) {
    if (findReq(c.root, requestId)) return c
  }
  return undefined
}

/** Immediate folder id whose `children` contains this request (collection root id if top-level). */
function parentFolderIdOfRequest(root: FolderNode, requestId: string): string | null {
  for (const ch of root.children) {
    if (isReq(ch)) {
      if (ch.id === requestId) return root.id
    } else {
      const sub = parentFolderIdOfRequest(ch, requestId)
      if (sub !== null) return sub
    }
  }
  return null
}

function replaceReqInTree(node: FolderNode, id: string, req: RequestWithTests): FolderNode {
  return {
    ...node,
    children: node.children.map((ch) =>
      isReq(ch) ? (ch.id === id ? structuredClone(req) : ch) : replaceReqInTree(ch, id, req)
    ),
  }
}

function collectRequestIdsUnderRoot(root: FolderNode): string[] {
  const ids: string[] = []
  const walk = (n: FolderNode | RequestWithTests) => {
    if (isReq(n)) ids.push(n.id)
    else for (const ch of n.children) walk(ch)
  }
  walk(root)
  return ids
}

type SavePlan =
  | { kind: 'full'; cols: Collection[] }
  | { kind: 'partial'; cols: Collection[]; clearDirtyIds: string[] }

/**
 * Persist only one request's body into the last on-disk snapshot when safe (same collection + same tree parent).
 * Otherwise fall back to saving the full in-memory workspace (e.g. cross-folder move, brand-new request tree).
 */
function planSingleRequestSave(
  liveCols: Collection[],
  lastJson: string | null,
  requestId: string
): SavePlan {
  if (!lastJson) return { kind: 'full', cols: liveCols }

  let persisted: Collection[]
  try {
    persisted = JSON.parse(lastJson) as Collection[]
  } catch {
    return { kind: 'full', cols: liveCols }
  }

  const liveCol = findColWithRequest(liveCols, requestId)
  const liveReq = liveCol ? findReq(liveCol.root, requestId) : undefined
  if (!liveCol || !liveReq) return { kind: 'full', cols: liveCols }

  const snapCol = findColWithRequest(persisted, requestId)
  if (!snapCol) {
    const idx = persisted.findIndex((c) => c.id === liveCol.id)
    const next =
      idx === -1 ? [...persisted, liveCol] : persisted.map((c, i) => (i === idx ? liveCol : c))
    return {
      kind: 'partial',
      cols: next,
      clearDirtyIds: collectRequestIdsUnderRoot(liveCol.root),
    }
  }

  if (snapCol.id !== liveCol.id) return { kind: 'full', cols: liveCols }

  const liveParent = parentFolderIdOfRequest(liveCol.root, requestId)
  const snapParent = parentFolderIdOfRequest(snapCol.root, requestId)
  if (liveParent !== snapParent) return { kind: 'full', cols: liveCols }

  const cols = persisted.map((c) =>
    findReq(c.root, requestId) ? { ...c, root: replaceReqInTree(c.root, requestId, liveReq) } : c
  )
  return { kind: 'partial', cols, clearDirtyIds: [requestId] }
}

export type SaveCollectionsOptions = {
  /** When set, merge this request into the last persisted snapshot when possible; other dirty tabs stay dirty. */
  onlyRequestId?: string
}

export async function saveCollectionsToDisk(
  options?: SaveCollectionsOptions
): Promise<{ ok: true } | { ok: false; message: string }> {
  const bridge = window.apiTester
  if (!bridge?.collectionsSaveAll) return { ok: false, message: 'no-bridge' }

  const liveCols = useWorkspaceStore.getState().collections
  const lastJson = useWorkspaceStore.getState().lastPersistedCollectionsJson
  const onlyId = options?.onlyRequestId?.trim()

  const plan: SavePlan =
    onlyId != null && onlyId !== ''
      ? planSingleRequestSave(liveCols, lastJson, onlyId)
      : { kind: 'full', cols: liveCols }

  try {
    await bridge.collectionsSaveAll(plan.cols)
    const json = JSON.stringify(plan.cols)
    if (plan.kind === 'full') {
      useWorkspaceStore.getState().syncPersistedSnapshot(json)
    } else {
      useWorkspaceStore.getState().syncPersistedSnapshot(json, {
        clearRequestIds: plan.clearDirtyIds,
      })
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}

export async function persistEditorTabState(): Promise<void> {
  const bridge = window.apiTester
  if (!bridge?.workspaceSaveMeta) return
  const { openIds, activeId } = useTabsStore.getState()
  const getRequest = useWorkspaceStore.getState().getRequest
  const openRequestIds = openIds.filter((id) => getRequest(id))
  const activeRequestId =
    activeId && openRequestIds.includes(activeId)
      ? activeId
      : openRequestIds[openRequestIds.length - 1] ?? null
  await bridge.workspaceSaveMeta({ editorTabState: { openRequestIds, activeRequestId } })
}

export function pruneTabsToExistingRequests(): void {
  const getRequest = useWorkspaceStore.getState().getRequest
  const { openIds, activeId } = useTabsStore.getState()
  const nextOpen = openIds.filter((id) => getRequest(id))
  const nextActive =
    activeId && nextOpen.includes(activeId) ? activeId : nextOpen[nextOpen.length - 1] ?? null
  useTabsStore.setState({ openIds: nextOpen, activeId: nextActive })
}
