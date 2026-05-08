import { useEffect, useRef, useState } from 'react'
import { useTabsStore } from '../store/tabs'
import { useWorkspaceStore } from '../store/workspace'
import { ThemeCard } from './ThemeCard'
import { ui } from '../locale/ui'
import { IconClose, IconPlus, IconSettings } from './icons'

export function TopBar() {
  const settingsWrapRef = useRef<HTMLDivElement>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    if (!settingsOpen) return
    const onPointerDown = (e: PointerEvent) => {
      const el = settingsWrapRef.current
      if (el && !el.contains(e.target as Node)) setSettingsOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [settingsOpen])

  const openIds = useTabsStore((s) => s.openIds)
  const activeId = useTabsStore((s) => s.activeId)
  const activate = useTabsStore((s) => s.activate)
  const close = useTabsStore((s) => s.close)
  const openTab = useTabsStore((s) => s.open)
  const getRequest = useWorkspaceStore((s) => s.getRequest)
  const collections = useWorkspaceStore((s) => s.collections)
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

  return (
    <header className="topbar">
      <div className="tabs" role="tablist" aria-label={ui.topBar.tablist}>
        {openIds.map((id) => {
          const r = getRequest(id)
          if (!r) return null
          const active = id === activeId
          return (
            <div
              key={id}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              className={`tab${active ? ' is-active' : ''}`}
              onClick={() => activate(id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  activate(id)
                }
              }}
            >
              <span className={`method method--tab ${r.method}`}>
                {r.method === 'DELETE' ? 'DEL' : r.method}
              </span>
              <span className="tab__label">{r.name}</span>
              <button
                type="button"
                className="tab__close"
                onClick={(e) => {
                  e.stopPropagation()
                  close(id)
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
    </header>
  )
}
