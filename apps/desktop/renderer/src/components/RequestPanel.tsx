import { useEffect, useMemo, useState } from 'react'
import type { Collection, FolderNode, HttpMethod, RequestWithTests } from '@api-tester/shared'
import { ui } from '../locale/ui'
import { useTabsStore } from '../store/tabs'
import { useWorkspaceStore } from '../store/workspace'
import { sendHttp } from '../lib/api'
import { KeyValueEditor } from './KeyValueEditor'
import {
  IconChevDown,
  IconCode,
  IconEdit,
  IconSave,
  IconSend,
} from './icons'

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

const SUBTABS = [
  { id: 'params' as const, label: ui.request.subtabs.params },
  { id: 'headers' as const, label: ui.request.subtabs.headers },
  { id: 'auth' as const, label: ui.request.subtabs.auth },
  { id: 'body' as const, label: ui.request.subtabs.body },
  { id: 'tests' as const, label: ui.request.subtabs.tests },
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

  useEffect(() => {
    /* no-op */
  }, [])

  const enabledParams = request.params.filter((p) => p.enabled && p.key)
  const enabledHeaders = request.headers.filter((h) => h.enabled && h.key)
  const dirty = useMemo(
    () => ({
      params: enabledParams.length > 0,
      headers: enabledHeaders.length > 0,
      auth: request.headers.some((h) => h.enabled && h.key.toLowerCase() === 'authorization'),
      tests: request.tests.length > 0,
    }),
    [enabledParams.length, enabledHeaders.length, request.headers, request.tests.length]
  )

  const breadcrumbParts = useMemo(
    () => breadcrumbForRequest(collections, request),
    [collections, request]
  )

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
          <button type="button" className="btn btn--split">
            <IconSave /> {ui.request.save} <IconChevDown width={14} height={14} />
          </button>
          <button type="button" className="btn" title={ui.request.viewCode}>
            <IconCode />
          </button>
          <button type="button" className="btn" title={ui.request.rename}>
            <IconEdit />
          </button>
        </div>
      </div>

      <div className="url-bar">
        <div className="method-pick">
          <select
            value={request.method}
            onChange={(e) => update(request.id, { method: e.target.value as HttpMethod })}
            style={{ color: `var(--method-${request.method.toLowerCase()})` }}
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <IconChevDown width={16} height={16} />
        </div>
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
          const count = tab.id === 'headers'
            ? enabledHeaders.length
            : tab.id === 'tests'
              ? request.tests.length
              : 0
          const dot = tab.id === 'params' ? dirty.params
            : tab.id === 'auth' ? dirty.auth
              : false
          return (
            <button
              key={tab.id}
              type="button"
              className={`subtab${active === tab.id ? ' is-active' : ''}`}
              onClick={() => setActive(tab.id)}
            >
              <span>{tab.label}</span>
              {count > 0 && <span className="subtab__badge">{count}</span>}
              {dot && <span className="subtab__dot" />}
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
            />
          </>
        )}
        {active === 'body' && <BodyEditor request={request} />}
        {active === 'auth' && <AuthPlaceholder />}
        {active === 'tests' && <TestsPanel request={request} />}
        {active === 'pre' && <ScriptPlaceholder />}
        {active === 'settings' && <SettingsPlaceholder />}
      </div>
    </section>
  )
}

function BodyEditor({ request }: { request: RequestWithTests }) {
  const update = useWorkspaceStore((s) => s.updateRequest)
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

function AuthPlaceholder() {
  return (
    <div className="dim">
      <h4>{ui.request.authTitle}</h4>
      <p>{ui.request.authHint}</p>
    </div>
  )
}

function TestsPanel({ request }: { request: RequestWithTests }) {
  return (
    <div>
      <h4>{ui.request.testsTitle}</h4>
      {request.tests.length === 0 && <p className="dim">{ui.request.noTests}</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {request.tests.map((t) => (
          <li
            key={t.id}
            style={{
              padding: '10px 12px',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              fontFamily: 'var(--font-code)',
              fontSize: 12.5,
            }}
          >
            <span className="muted">{t.type}</span>{' '}
            {t.target && <span>· {t.target}</span>}{' '}
            {t.operator && <span className="muted">{t.operator}</span>}{' '}
            {t.expected !== undefined && <b style={{ color: 'var(--accent)' }}>{String(t.expected)}</b>}
          </li>
        ))}
      </ul>
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

function SettingsPlaceholder() {
  return (
    <div className="dim">
      <h4>{ui.request.settingsTitle}</h4>
      <p>{ui.request.settingsHint}</p>
    </div>
  )
}
