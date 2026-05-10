import { useTabsStore } from '../store/tabs'
import { useWorkspaceStore } from '../store/workspace'

export async function saveCollectionsToDisk(): Promise<{ ok: true } | { ok: false; message: string }> {
  const bridge = window.apiTester
  if (!bridge?.collectionsSaveAll) return { ok: false, message: 'no-bridge' }
  const cols = useWorkspaceStore.getState().collections
  const json = JSON.stringify(cols)
  try {
    await bridge.collectionsSaveAll(cols)
    useWorkspaceStore.getState().syncPersistedSnapshot(json)
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
