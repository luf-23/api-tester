import { useEffect, useMemo, useRef, useState } from 'react'
import { useTabsStore } from '../store/tabs'
import { useWorkspaceStore } from '../store/workspace'
import { ThemeCard } from './ThemeCard'
import { ui } from '../locale/ui'
import { saveCollectionsToDisk } from '../lib/persistWorkspace'
import { IconClose, IconMore, IconPlus, IconSettings } from './icons'
import { UnsavedPrompt } from './UnsavedPrompt'

type TabPrompt =
  | null
  | { kind: 'single'; id: string; name: string }
  | { kind: 'closeAll' }

export function TopBar() {
  const settingsWrapRef = useRef<HTMLDivElement>(null)
  const tabMenuWrapRef = useRef<HTMLDivElement>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tabMenuOpen, setTabMenuOpen] = useState(false)
  const [tabPrompt, setTabPrompt] = useState<TabPrompt>(null)

  useEffect(() => {
    if (!settingsOpen) return
    const onPointerDown = (e: PointerEvent) => {
      const el = settingsWrapRef.current
      if (el && !el.contains(e.target as Node)) setSettingsOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [settingsOpen])

  useEffect(() => {
    if (!tabMenuOpen) return
    const onPointerDown = (e: PointerEvent) => {
      const el = tabMenuWrapRef.current
      if (el && !el.contains(e.target as Node)) setTabMenuOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [tabMenuOpen])

  const openIds = useTabsStore((s) => s.openIds)
  const activeId = useTabsStore((s) => s.activeId)
  const activate = useTabsStore((s) => s.activate)
  const close = useTabsStore((s) => s.close)
  const openTab = useTabsStore((s) => s.open)
  const collections = useWorkspaceStore((s) => s.collections)
  const dirtyRequestIds = useWorkspaceStore((s) => s.dirtyRequestIds)
  const revertTabDiscard = useWorkspaceStore((s) => s.revertTabDiscard)
  const revertWorkspaceToLastPersisted = useWorkspaceStore((s) => s.revertWorkspaceToLastPersisted)
  const hasUnsavedChanges = useWorkspaceStore((s) => s.hasUnsavedChanges)

  const tabsMeta = useMemo(() => {
    void collections
    void dirtyRequestIds
    return openIds.map((id) => ({
      id,
      request: useWorkspaceStore.getState().getRequest(id),
    }))
  }, [openIds, collections, dirtyRequestIds])

  const addCollection = useWorkspaceStore((s) => s.addCollection)
  const addRequest = useWorkspaceStore((s) => s.addRequest)

  const onNewTab = () => {
    let col = collections[0]
    if (!col) {
      addCollection('My collection')
      col = useWorkspaceStore.getState().collections[0]
    }
    if (!col) return
    const id = addRequest(col.root.id)
    openTab(id)
  }

  const hasSavedTab = openIds.some((id) => !dirtyRequestIds[id])

  const requestCloseTab = (id: string, name: string) => {
    if (!dirtyRequestIds[id]) {
      close(id)
      return
    }
    setTabPrompt({ kind: 'single', id, name })
  }

  const closeAllTabs = () => {
    if (openIds.length === 0) {
      setTabMenuOpen(false)
      return
    }
    if (!hasUnsavedChanges()) {
      for (const id of [...openIds]) close(id)
      setTabMenuOpen(false)
      return
    }
    setTabPrompt({ kind: 'closeAll' })
    setTabMenuOpen(false)
  }

  const closeSavedTabs = () => {
    for (const id of [...openIds]) {
      if (!dirtyRequestIds[id]) close(id)
    }
    setTabMenuOpen(false)
  }

  const tabPromptTitle =
    tabPrompt?.kind === 'closeAll' ? ui.unsaved.closeAllTitle : ui.unsaved.tabTitle
  const tabPromptBody =
    tabPrompt?.kind === 'closeAll'
      ? ui.unsaved.closeAllBody
      : tabPrompt?.kind === 'single'
        ? ui.unsaved.tabBody(tabPrompt.name)
        : ''

  return (
    <header className="topbar">
      <div className="tabs" role="tablist" aria-label={ui.topBar.tablist}>
        {tabsMeta.map(({ id, request: r }) => {
          if (!r) return null
          const active = id === activeId
          const dirty = Boolean(dirtyRequestIds[id])
          return (
            <div
              key={id}
              role="tab"
              aria-selected={active}
              aria-label={
                dirty ? `${r.name}（${ui.topBar.tabUnsavedHint}）` : undefined
              }
              tabIndex={active ? 0 : -1}
              className={`tab${active ? ' is-active' : ''}${dirty ? ' is-dirty' : ''}`}
              onClick={() => activate(id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  activate(id)
                }
              }}
            >
              {dirty && (
                <span
                  className="tab__dirty"
                  title={ui.topBar.tabUnsavedHint}
                  aria-hidden
                />
              )}
              <span className={`method method--tab ${r.method}`}>
                {r.method === 'DELETE' ? 'DEL' : r.method}
              </span>
              <span className="tab__label">{r.name}</span>
              <button
                type="button"
                className="tab__close"
                onClick={(e) => {
                  e.stopPropagation()
                  requestCloseTab(id, r.name)
                }}
                aria-label={ui.topBar.closeTab(r.name)}
              >
                <IconClose width={16} height={16} />
              </button>
            </div>
          )
        })}
        <button type="button" className="tab tab--add" title={ui.topBar.newRequest} onClick={onNewTab}>
          <IconPlus width={18} height={18} />
        </button>
      </div>
      <div className="tabs-toolbar" ref={tabMenuWrapRef}>
        <button
          type="button"
          className={`tabs-toolbar__more${tabMenuOpen ? ' is-active' : ''}`}
          title={ui.topBar.tabOverflowTitle}
          aria-label={ui.topBar.tabOverflowTitle}
          aria-expanded={tabMenuOpen}
          aria-haspopup="menu"
          onClick={() => setTabMenuOpen((o) => !o)}
        >
          <IconMore width={18} height={18} />
        </button>
        {tabMenuOpen && (
          <div className="tabs-toolbar__menu" role="menu">
            <button
              type="button"
              role="menuitem"
              className="tabs-toolbar__menu-item"
              disabled={openIds.length === 0}
              onClick={closeAllTabs}
            >
              {ui.topBar.closeAllTabs}
            </button>
            <button
              type="button"
              role="menuitem"
              className="tabs-toolbar__menu-item"
              disabled={!hasSavedTab}
              onClick={closeSavedTabs}
            >
              {ui.topBar.closeSavedTabs}
            </button>
          </div>
        )}
      </div>
      <div className="topbar__actions">
        <div className="topbar-settings" ref={settingsWrapRef}>
          <button
            type="button"
            className={`icon-btn${settingsOpen ? ' is-active' : ''}`}
            title={ui.topBar.appearance}
            aria-expanded={settingsOpen}
            aria-haspopup="dialog"
            onClick={() => setSettingsOpen((o) => !o)}
          >
            <IconSettings />
          </button>
          {settingsOpen && (
            <div className="topbar-settings__panel" role="dialog" aria-label={ui.topBar.appearancePanel}>
              <ThemeCard />
            </div>
          )}
        </div>
      </div>

      <UnsavedPrompt
        open={tabPrompt !== null}
        title={tabPromptTitle}
        body={tabPromptBody}
        onCancel={() => setTabPrompt(null)}
        onSave={async () => {
          const p = tabPrompt
          const r = await saveCollectionsToDisk()
          if (!r.ok) {
            window.alert(ui.unsaved.saveFailed(r.message))
            throw new Error('save-failed')
          }
          if (p?.kind === 'closeAll') {
            const ids = [...useTabsStore.getState().openIds]
            for (const id of ids) close(id)
          } else if (p?.kind === 'single') {
            close(p.id)
          }
        }}
        onDiscard={async () => {
          const p = tabPrompt
          if (p?.kind === 'closeAll') {
            revertWorkspaceToLastPersisted()
            useTabsStore.setState({ openIds: [], activeId: null, responses: {} })
          } else if (p?.kind === 'single') {
            revertTabDiscard(p.id)
            close(p.id)
          }
        }}
      />
    </header>
  )
}
