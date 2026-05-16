import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import type {
  Collection,
  FolderNode,
  HttpMethod,
  RequestWithTests,
} from '@api-tester/shared'
import { importPostmanCollectionV21 } from '@api-tester/domain'
import { ui } from '../locale/ui'
import { useWorkspaceStore, type DropPosition } from '../store/workspace'
import { useTabsStore } from '../store/tabs'
import {
  IconChevDown,
  IconCopy,
  IconEdit,
  IconExport,
  IconFilePlus,
  IconFolder,
  IconFolderPlus,
  IconImport,
  IconMore,
  IconPlus,
  IconRunner,
  IconSearch,
  IconTrash,
} from './icons'
import { AnimatedOverlay } from './ui/AnimatedOverlay'
import { Spinner } from './ui/Spinner'

function isRequest(n: FolderNode | RequestWithTests): n is RequestWithTests {
  return 'method' in n
}

/** Used while search is active so rows targeted by inline rename are not dropped from the tree. */
function treeContainsId(node: FolderNode | RequestWithTests, id: string): boolean {
  if (node.id === id) return true
  if (isRequest(node)) return false
  for (const ch of node.children) {
    if (treeContainsId(ch, id)) return true
  }
  return false
}

function countRequests(n: FolderNode): number {
  let total = 0
  for (const c of n.children) total += isRequest(c) ? 1 : countRequests(c)
  return total
}

function methodLabel(m: HttpMethod): string {
  if (m === 'DELETE') return 'DEL'
  if (m === 'OPTIONS') return 'OPT'
  return m
}

interface ContextMenuState {
  x: number
  y: number
  nodeId: string
  kind: 'folder' | 'request' | 'collection'
}

interface ToastState {
  msg: string
  tone: 'ok' | 'err'
}

export function CollectionsPanel() {
  const collections = useWorkspaceStore((s) => s.collections)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [drag, setDrag] = useState<{ id: string; over?: string; pos?: DropPosition } | null>(
    null
  )

  const deleteNode = useWorkspaceStore((s) => s.deleteNode)
  const duplicateRequest = useWorkspaceStore((s) => s.duplicateRequest)
  const addRequest = useWorkspaceStore((s) => s.addRequest)
  const addFolder = useWorkspaceStore((s) => s.addFolder)
  const addCollection = useWorkspaceStore((s) => s.addCollection)
  const mergePostman = useWorkspaceStore((s) => s.importPostmanCollection)
  const moveNode = useWorkspaceStore((s) => s.moveNode)
  const closeTab = useTabsStore((s) => s.close)
  const openTabs = useTabsStore((s) => s.openIds)

  useEffect(() => {
    const close = () => setMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('blur', close)
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  const showToast = useCallback((msg: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tone })
  }, [])

  const performDelete = useCallback(
    (id: string) => {
      const collectIds = (n: FolderNode | RequestWithTests): string[] =>
        isRequest(n) ? [n.id] : n.children.flatMap(collectIds)
      const target = (() => {
        for (const c of collections) {
          const stack: Array<FolderNode | RequestWithTests> = [c.root]
          while (stack.length) {
            const cur = stack.pop()!
            if (cur.id === id) return cur
            if (!isRequest(cur)) stack.push(...cur.children)
          }
        }
        return undefined
      })()
      const ids = target ? collectIds(target) : [id]
      ids.forEach((rid) => {
        if (openTabs.includes(rid)) closeTab(rid)
      })
      deleteNode(id)
      showToast(ui.collections.toastDeleted)
    },
    [collections, openTabs, closeTab, deleteNode, showToast]
  )

  const handleImport = useCallback(async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setImporting(true)
      try {
        const text = await file.text()
        let parsed: unknown
        try {
          parsed = JSON.parse(text) as unknown
        } catch {
          showToast(`${ui.collections.importFail}：JSON 无效`, 'err')
          return
        }

        const isPostman =
          parsed &&
          typeof parsed === 'object' &&
          'info' in parsed &&
          typeof (parsed as { info?: unknown }).info === 'object' &&
          (parsed as { info: { schema?: unknown } }).info != null &&
          String((parsed as { info: { schema?: string } }).info.schema ?? '').toLowerCase().includes(
            'postman'
          )

        const bridge = window.apiTester

        if (isPostman) {
          if (bridge?.importPostman) {
            await bridge.importPostman(text)
            if (bridge.collectionsGetAll) {
              const refreshed = await bridge.collectionsGetAll()
              useWorkspaceStore.setState({ collections: refreshed })
              useWorkspaceStore.getState().syncPersistedSnapshot(JSON.stringify(refreshed))
            }
            showToast(ui.collections.toastImported)
          } else {
            const col = importPostmanCollectionV21(parsed)
            if (!col) throw new Error(ui.collections.postmanError)
            mergePostman(col)
            showToast(`已导入「${col.name}」`)
          }
          return
        }

        if (bridge?.importWorkspaceMerge) {
          const result = await bridge.importWorkspaceMerge(text)
          if (bridge.collectionsGetAll) {
            const refreshed = await bridge.collectionsGetAll()
            useWorkspaceStore.setState({ collections: refreshed })
            useWorkspaceStore.getState().syncPersistedSnapshot(JSON.stringify(refreshed))
          }
          const renamed =
            result.renamedCollections.length + result.renamedEnvironments.length
          showToast(
            ui.collections.toastMergedImport(
              result.importedCollections,
              result.importedEnvironments,
              renamed
            )
          )
          return
        }

        showToast(`${ui.collections.importFail}：需在桌面应用内使用导入`, 'err')
      } catch (err) {
        showToast(`${ui.collections.importFail}：${(err as Error).message}`, 'err')
      } finally {
        setImporting(false)
      }
    }
    input.click()
  }, [mergePostman, showToast])

  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      const bridge = window.apiTester
      const text = bridge?.exportWorkspace
        ? await bridge.exportWorkspace()
        : JSON.stringify({ collections }, null, 2)
      const blob = new Blob([text], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `api-tester-workspace-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast(ui.collections.toastExportOk)
    } catch (err) {
      showToast(`${ui.collections.exportFail}：${(err as Error).message}`, 'err')
    } finally {
      setExporting(false)
    }
  }, [collections, showToast])

  const onContext = (
    e: MouseEvent,
    nodeId: string,
    kind: ContextMenuState['kind']
  ) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, nodeId, kind })
  }

  const matchesSearch = useMemo(() => {
    if (!search) return null
    const q = search.toLowerCase()
    return (n: RequestWithTests) =>
      n.name.toLowerCase().includes(q) || n.url.toLowerCase().includes(q)
  }, [search])

  const filteredCollections = useMemo(() => {
    if (!matchesSearch) return collections
    const filterNode = (node: FolderNode): FolderNode | null => {
      const kept: Array<FolderNode | RequestWithTests> = []
      for (const child of node.children) {
        if (isRequest(child)) {
          if (matchesSearch(child)) kept.push(child)
        } else {
          const sub = filterNode(child)
          if (sub) kept.push(sub)
        }
      }
      if (kept.length === 0) return null
      return { ...node, children: kept }
    }
    return collections
      .map((c) => {
        const pinFullTree = editingId != null && treeContainsId(c.root, editingId)
        const root = pinFullTree
          ? c.root
          : filterNode(c.root) ?? { ...c.root, children: [] }
        return { ...c, root }
      })
      .filter(
        (c) =>
          c.root.children.length > 0 ||
          (editingId != null && treeContainsId(c.root, editingId))
      )
  }, [collections, matchesSearch, editingId])

  return (
    <div className="collections">
      <div className="collections__top">
        <div className="collections__identity">
          <span className="collections__identity-title">{ui.collections.title}</span>
          <span className="collections__identity-badge">{ui.collections.badgeLocal}</span>
        </div>
        <div className="search-row">
          <div className="search-input">
            <IconSearch width={18} height={18} />
            <input
              placeholder={ui.collections.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="search-input__clear"
                onClick={() => setSearch('')}
                aria-label={ui.collections.clearSearch}
              >
                ×
              </button>
            )}
          </div>
          <button
            type="button"
            className={`icon-btn${importing ? ' is-loading' : ''}`}
            title={importing ? ui.collections.importing : ui.collections.importTitle}
            disabled={importing}
            aria-busy={importing}
            onClick={handleImport}
          >
            {importing ? <Spinner size="sm" /> : <IconImport />}
          </button>
          <button
            type="button"
            className={`icon-btn${exporting ? ' is-loading' : ''}`}
            title={exporting ? ui.collections.exporting : ui.collections.exportTitle}
            disabled={exporting}
            aria-busy={exporting}
            onClick={() => void handleExport()}
          >
            {exporting ? <Spinner size="sm" /> : <IconExport />}
          </button>
          <button
            className="icon-btn is-accent"
            title={ui.collections.newCollectionTitle}
            onClick={() => {
              const id = addCollection()
              showToast(ui.collections.toastCreated)
              // Defer edit mode until after the button finishes its focus cycle (Electron / Chromium).
              requestAnimationFrame(() => {
                requestAnimationFrame(() => setEditingId(id))
              })
            }}
          >
            <IconPlus />
          </button>
        </div>
      </div>
      <div className="tree" onClick={() => setMenu(null)}>
        {filteredCollections.length === 0 && (
          <div className="tree__empty">
            <p>{ui.collections.noMatches}</p>
            <small>{ui.collections.noMatchesHint}</small>
          </div>
        )}
        {filteredCollections.map((col) => (
          <CollectionTree
            key={col.id}
            collection={col}
            search={search}
            editingId={editingId}
            setEditingId={setEditingId}
            showToast={showToast}
            onContext={onContext}
            drag={drag}
            setDrag={setDrag}
            onDropMove={moveNode}
          />
        ))}
      </div>

      {menu && (
        <ContextMenu
          state={menu}
          onClose={() => setMenu(null)}
          onAction={(action) => {
            const id = menu.nodeId
            if (action === 'rename') setEditingId(id)
            else if (action === 'delete') {
              setPendingDeleteId(id)
            } else if (action === 'duplicate') {
              const newId = duplicateRequest(id)
              if (newId) showToast(ui.collections.toastDuplicated)
            } else if (action === 'add-request') {
              const newId = addRequest(id)
              setEditingId(newId)
            } else if (action === 'add-folder') {
              const newId = addFolder(id)
              setEditingId(newId)
            } else if (action === 'run') {
              showToast(ui.collections.toastRunPlaceholder)
            }
            setMenu(null)
          }}
        />
      )}

      {pendingDeleteId && (
        <DeleteConfirmDialog
          onCancel={() => setPendingDeleteId(null)}
          onConfirm={() => {
            performDelete(pendingDeleteId)
            setPendingDeleteId(null)
          }}
        />
      )}

      {toast && (
        <div className={`toast toast--${toast.tone}`} role="status" aria-live="polite">
          {toast.msg}
        </div>
      )}
    </div>
  )
}

interface CollectionTreeProps {
  collection: Collection
  search: string
  editingId: string | null
  setEditingId: (id: string | null) => void
  showToast: (msg: string, tone?: 'ok' | 'err') => void
  onContext: (e: MouseEvent, id: string, kind: ContextMenuState['kind']) => void
  drag: { id: string; over?: string; pos?: DropPosition } | null
  setDrag: React.Dispatch<
    React.SetStateAction<{ id: string; over?: string; pos?: DropPosition } | null>
  >
  onDropMove: (sourceId: string, targetId: string, position: DropPosition) => void
}

function CollectionTree({
  collection,
  search,
  editingId,
  setEditingId,
  showToast,
  onContext,
  drag,
  setDrag,
  onDropMove,
}: CollectionTreeProps) {
  return (
    <FolderRow
      node={collection.root}
      depth={1}
      search={search}
      isCollectionRoot
      editingId={editingId}
      setEditingId={setEditingId}
      showToast={showToast}
      onContext={onContext}
      drag={drag}
      setDrag={setDrag}
      onDropMove={onDropMove}
    />
  )
}

interface FolderRowProps {
  node: FolderNode
  depth: number
  search: string
  isCollectionRoot?: boolean
  editingId: string | null
  setEditingId: (id: string | null) => void
  showToast: (msg: string, tone?: 'ok' | 'err') => void
  onContext: (e: MouseEvent, id: string, kind: ContextMenuState['kind']) => void
  drag: { id: string; over?: string; pos?: DropPosition } | null
  setDrag: React.Dispatch<
    React.SetStateAction<{ id: string; over?: string; pos?: DropPosition } | null>
  >
  onDropMove: (sourceId: string, targetId: string, position: DropPosition) => void
}

function FolderRow({
  node,
  depth,
  search,
  isCollectionRoot,
  editingId,
  setEditingId,
  showToast,
  onContext,
  drag,
  setDrag,
  onDropMove,
}: FolderRowProps) {
  const expanded = useWorkspaceStore((s) => s.expanded[node.id] ?? false)
  const toggle = useWorkspaceStore((s) => s.toggleFolder)
  const expandFolder = useWorkspaceStore((s) => s.expandFolder)
  const renameNode = useWorkspaceStore((s) => s.renameNode)
  const addRequest = useWorkspaceStore((s) => s.addRequest)
  const addFolder = useWorkspaceStore((s) => s.addFolder)
  const total = countRequests(node)
  const isEditing = editingId === node.id
  const isOver = drag?.over === node.id && drag?.id !== node.id

  const handleDragOver = (e: DragEvent) => {
    if (!drag || drag.id === node.id) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - rect.top
    let pos: DropPosition = 'inside'
    if (y < rect.height * 0.25) pos = 'before'
    else if (y > rect.height * 0.75) pos = 'after'
    setDrag((prev) => (prev ? { ...prev, over: node.id, pos } : prev))
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (drag && drag.id !== node.id && drag.pos) {
      onDropMove(drag.id, node.id, drag.pos)
      if (drag.pos === 'inside') expandFolder(node.id, true)
    }
    setDrag(null)
  }

  return (
    <>
      <div
        className={`tree-row tree-row--folder${isEditing ? ' is-renaming' : ''}${
          isOver ? ` is-drop is-drop-${drag?.pos}` : ''
        }`}
        data-depth={depth}
        draggable={!isCollectionRoot}
        onClick={(e) => {
          if (isEditing) {
            const el = e.target as HTMLElement
            if (el.closest('.tree-row__actions')) return
            const row = e.currentTarget as HTMLElement
            const inp = row.querySelector<HTMLInputElement>('input.tree-row__rename')
            if (el.closest('.tree-row__chev') && inp) {
              const t = inp.value.trim()
              if (!t) setEditingId(null)
              else if (!renameNode(node.id, t)) {
                if (isCollectionRoot) showToast(ui.collections.collectionNameExists, 'err')
                return
              } else setEditingId(null)
              toggle(node.id)
              return
            }
            inp?.focus({ preventScroll: true })
            inp?.select()
            return
          }
          toggle(node.id)
        }}
        onContextMenu={(e) =>
          onContext(e, node.id, isCollectionRoot ? 'collection' : 'folder')
        }
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', node.id)
          setDrag({ id: node.id })
        }}
        onDragEnd={() => setDrag(null)}
        onDragOver={handleDragOver}
        onDragLeave={() =>
          setDrag((prev) => (prev?.over === node.id ? { id: prev.id } : prev))
        }
        onDrop={handleDrop}
      >
        <IconChevDown className={`tree-row__chev${expanded ? '' : ' is-collapsed'}`} />
        <IconFolder className="tree-row__icon" />
        {isEditing ? (
          <InlineRename
            initial={node.name}
            onCommit={(v) => {
              const t = v.trim()
              if (!t) {
                setEditingId(null)
                return
              }
              if (!renameNode(node.id, t)) {
                if (isCollectionRoot) showToast(ui.collections.collectionNameExists, 'err')
                return
              }
              setEditingId(null)
            }}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <span className="tree-row__name">{node.name}</span>
        )}
        <span className="tree-row__count">
          {total === 1 ? ui.collections.requestsCountOne : ui.collections.requestsCountMany(total)}
        </span>
        <div className="tree-row__actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="row-icon"
            title={ui.collections.addRequest}
            onClick={() => {
              const id = addRequest(node.id)
              setEditingId(id)
            }}
          >
            <IconFilePlus width={16} height={16} />
          </button>
          <button
            className="row-icon"
            title={ui.collections.addFolder}
            onClick={() => {
              const id = addFolder(node.id)
              setEditingId(id)
            }}
          >
            <IconFolderPlus width={16} height={16} />
          </button>
          <button
            className="row-icon"
            title={ui.collections.more}
            onClick={(e) =>
              onContext(e, node.id, isCollectionRoot ? 'collection' : 'folder')
            }
          >
            <IconMore width={16} height={16} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="tree-children" data-depth={depth}>
          {node.children.length === 0 && (
            <div className="tree-row tree-row--empty" data-depth={depth + 1}>
              <span className="tree-row__name dim">{ui.collections.emptyFolderHint}</span>
            </div>
          )}
          {node.children.map((child) => {
            if (isRequest(child)) {
              return (
                <RequestRow
                  key={child.id}
                  request={child}
                  depth={depth + 1}
                  editingId={editingId}
                  setEditingId={setEditingId}
                  onContext={onContext}
                  drag={drag}
                  setDrag={setDrag}
                  onDropMove={onDropMove}
                />
              )
            }
            return (
              <FolderRow
                key={child.id}
                node={child}
                depth={depth + 1}
                search={search}
                editingId={editingId}
                setEditingId={setEditingId}
                showToast={showToast}
                onContext={onContext}
                drag={drag}
                setDrag={setDrag}
                onDropMove={onDropMove}
              />
            )
          })}
        </div>
      )}
    </>
  )
}

interface RequestRowProps {
  request: RequestWithTests
  depth: number
  editingId: string | null
  setEditingId: (id: string | null) => void
  onContext: (e: MouseEvent, id: string, kind: ContextMenuState['kind']) => void
  drag: { id: string; over?: string; pos?: DropPosition } | null
  setDrag: React.Dispatch<
    React.SetStateAction<{ id: string; over?: string; pos?: DropPosition } | null>
  >
  onDropMove: (sourceId: string, targetId: string, position: DropPosition) => void
}

function RequestRow({
  request,
  depth,
  editingId,
  setEditingId,
  onContext,
  drag,
  setDrag,
  onDropMove,
}: RequestRowProps) {
  const open = useTabsStore((s) => s.open)
  const activeId = useTabsStore((s) => s.activeId)
  const renameNode = useWorkspaceStore((s) => s.renameNode)
  const duplicateRequest = useWorkspaceStore((s) => s.duplicateRequest)
  const isEditing = editingId === request.id
  const isOver = drag?.over === request.id && drag?.id !== request.id

  return (
    <div
      className={`tree-row tree-row--request${isEditing ? ' is-renaming' : ''}${
        activeId === request.id ? ' is-active' : ''
      }${isOver ? ` is-drop is-drop-${drag?.pos}` : ''}`}
      data-depth={depth}
      draggable
      onClick={(e) => {
        if (isEditing) {
          const el = e.target as HTMLElement
          if (el.closest('.tree-row__actions')) return
          const inp = (e.currentTarget as HTMLElement).querySelector<HTMLInputElement>(
            'input.tree-row__rename'
          )
          inp?.focus({ preventScroll: true })
          inp?.select()
          return
        }
        open(request.id)
      }}
      onContextMenu={(e) => onContext(e, request.id, 'request')}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', request.id)
        setDrag({ id: request.id })
      }}
      onDragEnd={() => setDrag(null)}
      onDragOver={(e) => {
        if (!drag || drag.id === request.id) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const y = e.clientY - rect.top
        const pos: DropPosition = y < rect.height / 2 ? 'before' : 'after'
        setDrag((prev) => (prev ? { ...prev, over: request.id, pos } : prev))
      }}
      onDragLeave={() =>
        setDrag((prev) => (prev?.over === request.id ? { id: prev.id } : prev))
      }
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (drag && drag.id !== request.id && drag.pos) {
          onDropMove(drag.id, request.id, drag.pos)
        }
        setDrag(null)
      }}
    >
      <span className={`method ${request.method}`}>{methodLabel(request.method)}</span>
      {isEditing ? (
        <InlineRename
          initial={request.name}
          onCommit={(v) => {
            if (v.trim()) renameNode(request.id, v.trim())
            setEditingId(null)
          }}
          onCancel={() => setEditingId(null)}
        />
      ) : (
        <span className="tree-row__name" title={request.url}>
          {request.name}
        </span>
      )}
      <div className="tree-row__actions" onClick={(e) => e.stopPropagation()}>
        <button
          className="row-icon"
          title={ui.collections.duplicate}
          onClick={() => duplicateRequest(request.id)}
        >
          <IconCopy width={16} height={16} />
        </button>
        <button
          className="row-icon"
          title={ui.collections.rename}
          onClick={() => setEditingId(request.id)}
        >
          <IconEdit width={16} height={16} />
        </button>
        <button
          className="row-icon"
          title={ui.collections.more}
          onClick={(e) => onContext(e, request.id, 'request')}
        >
          <IconMore width={16} height={16} />
        </button>
      </div>
    </div>
  )
}

function InlineRename({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string
  onCommit: (v: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)
  useLayoutEffect(() => {
    const focusInput = () => {
      const el = ref.current
      if (!el) return
      el.focus({ preventScroll: true })
      el.select()
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(focusInput)
    })
    return () => cancelAnimationFrame(id)
  }, [])
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onCommit(value)
    else if (e.key === 'Escape') onCancel()
  }
  return (
    <input
      ref={ref}
      className="tree-row__rename"
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={onKey}
      onBlur={() => onCommit(value)}
      onClick={(e) => e.stopPropagation()}
    />
  )
}

function DeleteConfirmDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: () => void
}) {
  const titleId = useId()
  const descId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])
  useLayoutEffect(() => {
    cancelRef.current?.focus({ preventScroll: true })
  }, [])
  return (
    <AnimatedOverlay open onBackdropClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="confirm-dialog"
      >
        <h2 id={titleId} className="confirm-dialog__title">
          {ui.collections.confirmDeleteTitle}
        </h2>
        <p id={descId} className="confirm-dialog__body">
          {ui.collections.confirmDeleteBody}
        </p>
        <div className="confirm-dialog__actions">
          <button
            ref={cancelRef}
            type="button"
            className="confirm-dialog__btn"
            onClick={onCancel}
          >
            {ui.collections.confirmDeleteCancel}
          </button>
          <button
            type="button"
            className="confirm-dialog__btn confirm-dialog__btn--danger"
            onClick={onConfirm}
          >
            {ui.collections.confirmDeleteConfirm}
          </button>
        </div>
      </div>
    </AnimatedOverlay>
  )
}

function ContextMenu({
  state,
  onClose: _onClose,
  onAction,
}: {
  state: ContextMenuState
  onClose: () => void
  onAction: (
    action:
      | 'rename'
      | 'delete'
      | 'duplicate'
      | 'add-request'
      | 'add-folder'
      | 'run'
  ) => void
}) {
  const isFolderLike = state.kind !== 'request'
  return (
    <div
      className="ctx-menu"
      style={{ top: state.y, left: state.x }}
      onClick={(e) => e.stopPropagation()}
    >
      {isFolderLike && (
        <>
          <button onClick={() => onAction('add-request')}>
            <IconFilePlus width={16} height={16} /> {ui.collections.ctxAddRequest}
          </button>
          <button onClick={() => onAction('add-folder')}>
            <IconFolderPlus width={16} height={16} /> {ui.collections.ctxAddFolder}
          </button>
          <button onClick={() => onAction('run')}>
            <IconRunner width={16} height={16} /> {ui.collections.ctxRunFolder}
          </button>
          <div className="ctx-menu__sep" />
        </>
      )}
      {!isFolderLike && (
        <>
          <button onClick={() => onAction('duplicate')}>
            <IconCopy width={16} height={16} /> {ui.collections.ctxDuplicate}
          </button>
          <div className="ctx-menu__sep" />
        </>
      )}
      <button onClick={() => onAction('rename')}>
        <IconEdit width={16} height={16} /> {ui.collections.ctxRename}
      </button>
      <button className="is-danger" onClick={() => onAction('delete')}>
        <IconTrash width={16} height={16} /> {ui.collections.ctxDelete}
      </button>
    </div>
  )
}
