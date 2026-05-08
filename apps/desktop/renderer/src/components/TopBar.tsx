import { useEffect, useRef, useState } from 'react'
import { useTabsStore } from '../store/tabs'
import { useWorkspaceStore } from '../store/workspace'
import { ThemeCard } from './ThemeCard'
import { IconChevDown, IconClose, IconEye, IconPlus, IconSettings } from './icons'

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
  const getRequest = useWorkspaceStore((s) => s.getRequest)

  return (
    <header className="topbar">
      <div className="tabs">
        {openIds.map((id) => {
          const r = getRequest(id)
          if (!r) return null
          const active = id === activeId
          return (
            <button
              key={id}
              className={`tab${active ? ' is-active' : ''}`}
              onClick={() => activate(id)}
            >
              <span className={`method ${r.method}`}>
                {r.method === 'DELETE' ? 'DEL' : r.method}
              </span>
              <span>{r.name}</span>
              {active && <span className="tab__dot" />}
              <button
                className="tab__close"
                onClick={(e) => {
                  e.stopPropagation()
                  close(id)
                }}
                aria-label={`Close ${r.name}`}
              >
                <IconClose width={12} height={12} />
              </button>
            </button>
          )
        })}
        <button className="tab--add" title="New tab">
          <IconPlus width={14} height={14} />
        </button>
      </div>
      <div className="env-cluster">
        <div className="env-pick">
          <span className="env-pick__dot" />
          <select defaultValue="none">
            <option value="none">No Environment</option>
            <option value="dev">Development</option>
            <option value="staging">Staging</option>
            <option value="prod">Production</option>
          </select>
          <IconChevDown width={14} height={14} />
        </div>
        <button className="icon-btn" title="Variable preview">
          <IconEye />
        </button>
        <div className="topbar-settings" ref={settingsWrapRef}>
          <button
            type="button"
            className={`icon-btn${settingsOpen ? ' is-active' : ''}`}
            title="Workspace settings"
            aria-expanded={settingsOpen}
            aria-haspopup="dialog"
            onClick={() => setSettingsOpen((o) => !o)}
          >
            <IconSettings />
          </button>
          {settingsOpen && (
            <div className="topbar-settings__panel" role="dialog" aria-label="Workspace settings">
              <ThemeCard />
            </div>
          )}
        </div>
        <div className="avatar" title="Account">AK</div>
      </div>
    </header>
  )
}
