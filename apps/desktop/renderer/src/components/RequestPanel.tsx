import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Collection, FolderNode, RequestWithTests } from '@api-tester/shared'
import { defaultSendSettings } from '@api-tester/shared'
import { ui } from '../locale/ui'
import { useTabsStore } from '../store/tabs'
import { useWorkspaceStore } from '../store/workspace'
import { sendHttp } from '../lib/api'
import { KeyValueEditor } from './KeyValueEditor'
import { MethodPick } from './MethodPick'
import { IconChevDown, IconSave, IconSend } from './icons'

const SUBTABS = [
  { id: 'params' as const, label: ui.request.subtabs.params },
  { id: 'headers' as const, label: ui.request.subtabs.headers },
  { id: 'body' as const, label: ui.request.subtabs.body },
  { id: 'pre' as const, label: ui.request.subtabs.pre },
  { id: 'settings' as const, label: ui.request.subtabs.settings },
] as const
type SubtabId = (typeof SUBTABS)[number]['id']

const BODY_MODES = [
  { id: 'none' as const, label: ui.request.bodyModes.none },
  { id: 'json' as const, label: ui.request.bodyModes.json },
  { id: 'text' as const, label: ui.request.bodyModes.text },
  { id: 'form-urlencoded' as const, label: ui.request.bodyModes['form-urlencoded'] },
  { id: 'form-data' as const, label: ui.request.bodyModes['form-data'] },
] as const

function isRequestNode(n: FolderNode | RequestWithTests): n is RequestWithTests {
  return 'method' in n
}

function breadcrumbForRequest(collections: Collection[], request: RequestWithTests): string[] {
  for (const col of collections) {
    function walk(folder: FolderNode, segments: string[]): string[] | null {
      for (const child of folder.children) {
        if (isRequestNode(child)) {
          if (child.id === request.id) return [...segments, child.name]
        } else {
          const hit = walk(child, [...segments, child.name])
          if (hit) return hit
        }
      }
      return null
    }
    const tail = walk(col.root, [])
    if (tail) return [col.name, ...tail]
  }
  return [request.name]
}

export function RequestPanel({ request }: { request: RequestWithTests }) {
  const collections = useWorkspaceStore((s) => s.collections)
  const update = useWorkspaceStore((s) => s.updateRequest)
  const setKv = useWorkspaceStore((s) => s.setKv)
  const setResponse = useTabsStore((s) => s.setResponse)
  const [active, setActive] = useState<SubtabId>('params')
  const [saveHint, setSaveHint] = useState<string | null>(null)

  const enabledHeaders = request.headers.filter((h) => h.enabled && h.key)

  const breadcrumbParts = useMemo(
    () => breadcrumbForRequest(collections, request),
    [collections, request]
  )

  const onSaveNow = useCallback(async () => {
    const bridge = window.apiTester
    if (!bridge?.collectionsSaveAll) {
      setSaveHint(ui.request.saveNoBridge)
      window.setTimeout(() => setSaveHint(null), 3200)
      return
    }
    try {
      await bridge.collectionsSaveAll(collections)
      setSaveHint(ui.request.saveDone)
      window.setTimeout(() => setSaveHint(null), 2200)
    } catch {
      setSaveHint(ui.request.saveFail)
      window.setTimeout(() => setSaveHint(null), 3200)
    }
  }, [collections])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 's') return
      e.preventDefault()
      void onSaveNow()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSaveNow])

  const onSend = async () => {
    setResponse(request.id, { loading: true })
    try {
      const out = await sendHttp(request)
      setResponse(request.id, {
        loading: false,
        response: {
          status: out.response.status,
          statusText: out.response.statusText,
          headers: out.response.headers,
          bodyText: out.response.bodyText,
          durationMs: out.response.durationMs,
          sizeBytes: out.response.sizeBytes,
        },
        error: out.error,
        receivedAt: Date.now(),
      })
    } catch (e) {
      setResponse(request.id, {
        loading: false,
        error: e instanceof Error ? e.message : String(e),
        receivedAt: Date.now(),
      })
    }
  }

  return (
    <section className="request">
      <div className="request__header">
        <div className="breadcrumb">
          {breadcrumbParts.flatMap((part, i) => {
            const node =
              i === breadcrumbParts.length - 1 ? (
                <b key={`bc-${i}`}>{part}</b>
              ) : (
                <span key={`bc-${i}`}>{part}</span>
              )
            return i === 0 ? [node] : [<span key={`bc-sep-${i}`}>/</span>, node]
          })}
        </div>
        <div className="header-actions">
          <button type="button" className="btn" title={saveHint ?? undefined} onClick={() => void onSaveNow()}>
            <IconSave /> {ui.request.save}
          </button>
          {saveHint && <span className="request__hint muted">{saveHint}</span>}
        </div>
      </div>

      <div className="url-bar">
        <MethodPick value={request.method} onChange={(m) => update(request.id, { method: m })} />
        <input
          className="url-input"
          value={request.url}
          onChange={(e) => update(request.id, { url: e.target.value })}
          placeholder={ui.request.urlPlaceholder}
          spellCheck={false}
        />
        <div className="send-group">
          <button type="button" className="btn btn--primary" onClick={onSend}>
            <IconSend /> {ui.request.send}
          </button>
          <button type="button" className="send-group__more" title={ui.request.sendOptions}>
            <IconChevDown width={16} height={16} />
          </button>
        </div>
      </div>

      <nav className="subtabs">
        {SUBTABS.map((tab) => {
          const count = tab.id === 'headers' ? enabledHeaders.length : 0
          return (
            <button
              key={tab.id}
              type="button"
              className={`subtab${active === tab.id ? ' is-active' : ''}`}
              onClick={() => setActive(tab.id)}
            >
              <span>{tab.label}</span>
              {count > 0 && <span className="subtab__badge">{count}</span>}
            </button>
          )
        })}
        <div className="subtabs__spacer" />
        <button type="button" className="subtabs__link">{ui.request.cookiesLink}</button>
      </nav>

      <div className="subpanel">
        {active === 'params' && (
          <>
            <div className="kv__title-row">
              <h4 style={{ margin: 0 }}>{ui.request.queryParams}</h4>
              <button type="button" className="kv__bulk">{ui.request.bulkEdit}</button>
            </div>
            <KeyValueEditor
              rows={request.params}
              onChange={(rows) => setKv(request.id, 'params', rows)}
            />
          </>
        )}
        {active === 'headers' && (
          <>
            <div className="kv__title-row">
              <h4 style={{ margin: 0 }}>{ui.request.headersTitle}</h4>
            </div>
            <KeyValueEditor
              rows={request.headers}
              onChange={(rows) => setKv(request.id, 'headers', rows)}
              collapseHidden
            />
          </>
        )}
        {active === 'body' && <BodyEditor request={request} />}
        {active === 'pre' && <ScriptPlaceholder />}
        {active === 'settings' && <RequestSendSettingsPanel request={request} />}
      </div>
    </section>
  )
}

function BodyEditor({ request }: { request: RequestWithTests }) {
  const update = useWorkspaceStore((s) => s.updateRequest)
  const setKv = useWorkspaceStore((s) => s.setKv)
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 10, color: 'var(--text-secondary)' }}>
        {BODY_MODES.map(({ id: mode, label }) => (
          <label key={mode} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
            <input
              type="radio"
              name={`bodymode-${request.id}`}
              checked={request.bodyMode === mode}
              onChange={() => update(request.id, { bodyMode: mode })}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      {(request.bodyMode === 'form-urlencoded' || request.bodyMode === 'form-data') && (
        <>
          <div className="kv__title-row">
            <h4 style={{ margin: 0 }}>
              {request.bodyMode === 'form-urlencoded'
                ? ui.request.bodyModes['form-urlencoded']
                : ui.request.bodyModes['form-data']}
            </h4>
          </div>
          <KeyValueEditor
            rows={request.bodyFields}
            onChange={(rows) => setKv(request.id, 'bodyFields', rows)}
            withDescription={false}
          />
        </>
      )}
      {(request.bodyMode === 'json' || request.bodyMode === 'text') && (
        <textarea
          value={request.bodyText}
          onChange={(e) => update(request.id, { bodyText: e.target.value })}
          placeholder={request.bodyMode === 'json' ? ui.request.bodyPlaceholderJson : ui.request.bodyPlaceholderText}
          style={{
            width: '100%',
            minHeight: 240,
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 4,
            color: 'var(--text-primary)',
            padding: 12,
            fontFamily: 'var(--font-code)',
            fontSize: 12.5,
            outline: 0,
            resize: 'vertical',
          }}
          spellCheck={false}
        />
      )}
      {request.bodyMode === 'none' && <p className="dim">{ui.request.noBody}</p>}
    </div>
  )
}

function RequestSendSettingsPanel({ request }: { request: RequestWithTests }) {
  const update = useWorkspaceStore((s) => s.updateRequest)
  const merged = { ...defaultSendSettings(), ...request.sendSettings }
  const patch = (partial: Partial<typeof merged>) => {
    update(request.id, { sendSettings: { ...merged, ...partial } })
  }
  const timeoutSeconds =
    merged.timeoutMs === 0 ? 0 : Math.min(3600, Math.round(merged.timeoutMs / 1000))

  return (
    <div className="request-settings">
      <h4 className="request-settings__title">{ui.request.settingsTitle}</h4>
      <p className="request-settings__intro dim">{ui.request.settingsSendIntro}</p>

      <div className="request-settings__grid">
        <label className="request-settings__field">
          <span className="request-settings__label">{ui.request.settingsTimeout}</span>
          <input
            type="number"
            min={0}
            max={3600}
            step={1}
            value={timeoutSeconds}
            onChange={(e) => {
              const sec = Number.parseInt(e.target.value, 10)
              const v = Number.isFinite(sec) ? Math.max(0, Math.min(3600, sec)) : 0
              patch({ timeoutMs: v * 1000 })
            }}
            className="request-settings__input"
          />
          <span className="request-settings__hint muted">{ui.request.settingsTimeoutHint}</span>
        </label>

        <label className="request-settings__field">
          <span className="request-settings__label">{ui.request.settingsRedirects}</span>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={merged.maxRedirects}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10)
              patch({
                maxRedirects: Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0,
              })
            }}
            className="request-settings__input"
          />
          <span className="request-settings__hint muted">{ui.request.settingsRedirectsHint}</span>
        </label>

        <label className="request-settings__field request-settings__field--check">
          <input
            type="checkbox"
            checked={merged.validateTls}
            onChange={(e) => patch({ validateTls: e.target.checked })}
          />
          <span className="request-settings__check-label">{ui.request.settingsTls}</span>
        </label>
        <p className="request-settings__hint muted request-settings__tls-hint">{ui.request.settingsTlsHint}</p>
      </div>
    </div>
  )
}

function ScriptPlaceholder() {
  return (
    <div className="dim">
      <h4>{ui.request.scriptPre}</h4>
      <p>{ui.request.scriptHint}</p>
    </div>
  )
}
