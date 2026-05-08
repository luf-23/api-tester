import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Collection } from '@api-tester/shared'
import { CollectionsPanel } from './components/CollectionsPanel'
import { TopBar } from './components/TopBar'
import { RequestPanel } from './components/RequestPanel'
import { ResponsePanel } from './components/ResponsePanel'
import { StatusBar } from './components/StatusBar'
import { useTabsStore } from './store/tabs'
import { useWorkspaceStore } from './store/workspace'
import { useThemeStore } from './store/theme'
import { ui } from './locale/ui'

const LS_SIDEBAR = 'api-tester.sidebarW'
const LS_SPLIT = 'api-tester.editorSplit'
const SIDEBAR_MIN = 240
const SIDEBAR_MAX = 560
const SPLIT_MIN = 0.22
const SPLIT_MAX = 0.78

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

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_SIDEBAR) : null
    const n = raw ? parseInt(raw, 10) : 308
    return clamp(Number.isFinite(n) ? n : 308, SIDEBAR_MIN, SIDEBAR_MAX)
  })
  const sidebarWidthRef = useRef(sidebarWidth)
  sidebarWidthRef.current = sidebarWidth

  const [splitFrac, setSplitFrac] = useState(() => {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_SPLIT) : null
    const n = raw ? parseFloat(raw) : 0.5
    return clamp(Number.isFinite(n) ? n : 0.5, SPLIT_MIN, SPLIT_MAX)
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
    void bridge
      .collectionsGetAll()
      .then((cols) => {
        if (cancelled) return
        useWorkspaceStore.setState({ collections: cols })
        setBoot({ ui: true, persist: true })
      })
      .catch((err) => {
        console.error('Failed to load collections', err)
        if (!cancelled) setBoot({ ui: true, persist: false })
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!boot.ui || !boot.persist) return
    const bridge = window.apiTester
    if (!bridge?.collectionsSaveAll) return

    let timeout: ReturnType<typeof setTimeout>
    const persist = (cols: Collection[]) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        void bridge.collectionsSaveAll(cols)
      }, 450)
    }

    const unsub = useWorkspaceStore.subscribe((state, prev) => {
      if (state.collections === prev.collections) return
      persist(state.collections)
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

  if (!boot.ui) {
    return (
      <div className="app app--boot">
        <div className="app__boot">{ui.app.loadingWorkspace}</div>
      </div>
    )
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
              <p className="app__empty-title">{ui.app.emptyTitle}</p>
              <p className="app__empty-hint">{ui.app.emptyHint}</p>
            </div>
          )}
        </main>
      </div>
      <StatusBar />
    </div>
  )
}
