import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WorkspaceMeta } from '@api-tester/shared'
import { CollectionsPanel } from './components/CollectionsPanel'
import { TopBar } from './components/TopBar'
import { RequestPanel } from './components/RequestPanel'
import { ResponsePanel } from './components/ResponsePanel'
import { StatusBar } from './components/StatusBar'
import { UnsavedPrompt } from './components/UnsavedPrompt'
import { UpdateBanner } from './components/UpdateBanner'
import {
  persistEditorTabState,
  pruneTabsToExistingRequests,
  saveCollectionsToDisk,
} from './lib/persistWorkspace'
import { useTabsStore } from './store/tabs'
import { useWorkspaceStore } from './store/workspace'
import { useThemeStore } from './store/theme'
import { ui } from './locale/ui'
import { BootScreen } from './components/ui/BootScreen'
import { IconFilePlus, IconFolderPlus, IconSend } from './components/icons'

const LS_SIDEBAR = 'api-tester.sidebarW'
const LS_SPLIT = 'api-tester.editorSplit'
const SIDEBAR_MIN = 240
const SIDEBAR_MAX = 560
const SPLIT_MIN = 0.22
const SPLIT_MAX = 0.78
/** Default fraction of vertical space for the request pane (top); response gets the rest. */
const SPLIT_DEFAULT = 0.56

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

export default function App() {
  const activeId = useTabsStore((s) => s.activeId)
  const collections = useWorkspaceStore((s) => s.collections)
  const activeRequest = useMemo(() => {
    void collections
    if (!activeId) return undefined
    return useWorkspaceStore.getState().getRequest(activeId)
  }, [activeId, collections])
  const themeId = useThemeStore((s) => s.themeId)
  const [boot, setBoot] = useState<{ ui: boolean; persist: boolean }>({
    ui: false,
    persist: false,
  })
  const [quitPromptOpen, setQuitPromptOpen] = useState(false)

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_SIDEBAR) : null
    const n = raw ? parseInt(raw, 10) : 308
    return clamp(Number.isFinite(n) ? n : 308, SIDEBAR_MIN, SIDEBAR_MAX)
  })
  const sidebarWidthRef = useRef(sidebarWidth)
  sidebarWidthRef.current = sidebarWidth

  const [splitFrac, setSplitFrac] = useState(() => {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_SPLIT) : null
    const n = raw ? parseFloat(raw) : SPLIT_DEFAULT
    return clamp(Number.isFinite(n) ? n : SPLIT_DEFAULT, SPLIT_MIN, SPLIT_MAX)
  })
  const splitFracRef = useRef(splitFrac)
  splitFracRef.current = splitFrac

  const editorStackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId)
  }, [themeId])

  useEffect(() => {
    const bridge = window.apiTester
    if (!bridge?.collectionsGetAll) {
      setBoot({ ui: true, persist: false })
      return
    }
    let cancelled = false
    void Promise.all([bridge.collectionsGetAll(), bridge.themeGet(), bridge.workspaceGet()])
      .then(([cols, themeId, meta]) => {
        if (cancelled) return
        if (typeof themeId === 'string' && themeId.trim()) {
          useThemeStore.getState().setTheme(themeId.trim())
        }
        useWorkspaceStore.setState({ collections: cols })
        useWorkspaceStore.getState().syncPersistedSnapshot(JSON.stringify(cols))

        const m = meta as WorkspaceMeta
        const ts = m.editorTabState
        if (ts?.openRequestIds?.length) {
          const getRequest = useWorkspaceStore.getState().getRequest
          const openRequestIds = ts.openRequestIds.filter((id) => getRequest(id))
          const activeRequestId =
            ts.activeRequestId && openRequestIds.includes(ts.activeRequestId)
              ? ts.activeRequestId
              : openRequestIds[openRequestIds.length - 1] ?? null
          useTabsStore.setState({ openIds: openRequestIds, activeId: activeRequestId })
        }

        setBoot({ ui: true, persist: true })
      })
      .catch((err) => {
        console.error('Failed to load workspace', err)
        if (!cancelled) setBoot({ ui: true, persist: false })
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const bridge = window.apiTester
    if (!bridge?.onCloseRequested || !bridge?.appFinishClose) return

    return bridge.onCloseRequested(() => {
      if (!boot.persist || !useWorkspaceStore.getState().hasUnsavedChanges()) {
        void persistEditorTabState().finally(() => void bridge.appFinishClose!())
        return
      }
      setQuitPromptOpen(true)
    })
  }, [boot.persist])

  useEffect(() => {
    if (!boot.ui || !boot.persist) return
    const bridge = window.apiTester
    if (!bridge?.workspaceSaveMeta) return

    let timeout: ReturnType<typeof setTimeout>
    const flush = () => {
      void persistEditorTabState()
    }

    const unsub = useTabsStore.subscribe((state, prev) => {
      if (state.openIds === prev.openIds && state.activeId === prev.activeId) return
      clearTimeout(timeout)
      timeout = setTimeout(flush, 400)
    })

    return () => {
      clearTimeout(timeout)
      unsub()
    }
  }, [boot.ui, boot.persist])

  useEffect(() => {
    if (!boot.ui || !boot.persist) return
    const bridge = window.apiTester
    if (!bridge?.themeSet) return

    let timeout: ReturnType<typeof setTimeout>
    const persist = (id: string) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        void bridge.themeSet(id)
      }, 320)
    }

    const unsub = useThemeStore.subscribe((state, prev) => {
      if (state.themeId === prev.themeId) return
      persist(state.themeId)
    })

    return () => {
      clearTimeout(timeout)
      unsub()
    }
  }, [boot.ui, boot.persist])

  const startColResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const w0 = sidebarWidthRef.current
    let last = w0
    const onMove = (ev: MouseEvent) => {
      last = clamp(w0 + ev.clientX - startX, SIDEBAR_MIN, SIDEBAR_MAX)
      setSidebarWidth(last)
    }
    const onUp = () => {
      localStorage.setItem(LS_SIDEBAR, String(last))
      document.body.classList.remove('is-resizing-col')
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.body.classList.add('is-resizing-col')
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const startRowResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const el = editorStackRef.current
    if (!el) return
    let lastFrac = splitFracRef.current
    const onMove = (ev: MouseEvent) => {
      const r = el.getBoundingClientRect()
      const y = ev.clientY - r.top
      lastFrac = clamp(y / r.height, SPLIT_MIN, SPLIT_MAX)
      setSplitFrac(lastFrac)
    }
    const onUp = () => {
      localStorage.setItem(LS_SPLIT, String(lastFrac))
      document.body.classList.remove('is-resizing-row')
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.body.classList.add('is-resizing-row')
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const createFirstRequest = useCallback(() => {
    const workspace = useWorkspaceStore.getState()
    let collection = workspace.collections[0]
    if (!collection) {
      workspace.addCollection('My Collection')
      collection = useWorkspaceStore.getState().collections[0]
    }
    if (!collection) return
    const requestId = useWorkspaceStore.getState().addRequest(collection.root.id)
    useTabsStore.getState().open(requestId)
  }, [])

  const createCollection = useCallback(() => {
    useWorkspaceStore.getState().addCollection('New Collection')
  }, [])

  if (!boot.ui) {
    return <BootScreen message={ui.app.loadingWorkspace} />
  }

  return (
    <div className="app">
      <div className="app__workspace">
        <aside className="app__sidebar" style={{ width: sidebarWidth }}>
          <CollectionsPanel />
        </aside>
        <div
          className="resize-handle resize-handle--col"
          role="separator"
          aria-orientation="vertical"
          aria-label={ui.app.resizeCollections}
          onMouseDown={startColResize}
        />
        <main className="app__main">
          <UpdateBanner />
          <TopBar />
          {activeRequest ? (
            <div className="editor-stack" ref={editorStackRef}>
              <div
                className="editor-stack__pane editor-stack__pane--request"
                style={{ flexGrow: splitFrac, flexShrink: 1, flexBasis: 0 }}
              >
                <RequestPanel request={activeRequest} />
              </div>
              <div
                className="resize-handle resize-handle--row"
                role="separator"
                aria-orientation="horizontal"
                aria-label={ui.app.resizeEditor}
                onMouseDown={startRowResize}
              />
              <div
                className="editor-stack__pane editor-stack__pane--response"
                style={{ flexGrow: 1 - splitFrac, flexShrink: 1, flexBasis: 0 }}
              >
                <ResponsePanel requestId={activeRequest.id} />
              </div>
            </div>
          ) : (
            <div className="app__empty">
              <div className="app__empty-illustration" aria-hidden>
                <IconSend />
              </div>
              <p className="app__empty-eyebrow">READY TO TEST</p>
              <h1 className="app__empty-title">{ui.app.emptyTitle}</h1>
              <p className="app__empty-hint">{ui.app.emptyHint}</p>
              <div className="app__empty-actions">
                <button type="button" className="btn btn--primary" onClick={createFirstRequest}>
                  <IconFilePlus /> New request
                </button>
                <button type="button" className="btn" onClick={createCollection}>
                  <IconFolderPlus /> New collection
                </button>
              </div>
              <div className="app__empty-shortcut">
                <kbd>Ctrl</kbd><span>+</span><kbd>Enter</kbd>
                <span>to send a request</span>
              </div>
            </div>
          )}
        </main>
      </div>
      <StatusBar />

      <UnsavedPrompt
        open={quitPromptOpen}
        title={ui.unsaved.quitTitle}
        body={ui.unsaved.quitBody}
        onCancel={() => setQuitPromptOpen(false)}
        onSave={async () => {
          const r = await saveCollectionsToDisk()
          if (!r.ok) {
            window.alert(ui.unsaved.saveFailed(r.message))
            throw new Error('save-failed')
          }
          await persistEditorTabState()
          await window.apiTester.appFinishClose!()
        }}
        onDiscard={async () => {
          useWorkspaceStore.getState().revertWorkspaceToLastPersisted()
          pruneTabsToExistingRequests()
          await persistEditorTabState()
          await window.apiTester.appFinishClose!()
        }}
      />
    </div>
  )
}
