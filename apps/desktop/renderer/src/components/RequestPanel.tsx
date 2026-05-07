import { useEffect, useMemo, useState } from 'react'
import type { HttpMethod, RequestWithTests } from '@api-tester/shared'
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
  { id: 'params', label: 'Params' },
  { id: 'headers', label: 'Headers' },
  { id: 'auth', label: 'Auth' },
  { id: 'body', label: 'Body' },
  { id: 'tests', label: 'Tests' },
  { id: 'pre', label: 'Pre-request Script' },
  { id: 'settings', label: 'Settings' },
] as const
type SubtabId = (typeof SUBTABS)[number]['id']

export function RequestPanel({ request }: { request: RequestWithTests }) {
  const update = useWorkspaceStore((s) => s.updateRequest)
  const setKv = useWorkspaceStore((s) => s.setKv)
  const setResponse = useTabsStore((s) => s.setResponse)
  const [active, setActive] = useState<SubtabId>('params')

  // Keep URL string in sync with enabled params (UI niceness).
  useEffect(() => {
    /* no-op; users may edit either side independently. */
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
          <span>Acme API</span>
          <span>/</span>
          <span>Users</span>
          <span>/</span>
          <b>{request.name}</b>
        </div>
        <div className="header-actions">
          <button className="btn btn--split">
            <IconSave /> Save <IconChevDown width={12} height={12} />
          </button>
          <button className="btn" title="View code">
            <IconCode />
          </button>
          <button className="btn" title="Rename">
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
          <IconChevDown width={14} height={14} />
        </div>
        <input
          className="url-input"
          value={request.url}
          onChange={(e) => update(request.id, { url: e.target.value })}
          placeholder="https://api.example.com/v1/resource"
          spellCheck={false}
        />
        <div className="send-group">
          <button className="btn btn--primary" onClick={onSend}>
            <IconSend /> Send
          </button>
          <button className="send-group__more" title="Send options">
            <IconChevDown width={14} height={14} />
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
        <button className="subtabs__link">Cookies</button>
      </nav>

      <div className="subpanel">
        {active === 'params' && (
          <>
            <div className="kv__title-row">
              <h4 style={{ margin: 0 }}>Query Params</h4>
              <button className="kv__bulk">··· Bulk Edit</button>
            </div>
            <KeyValueEditor
              rows={request.params}
              onChange={(rows) => setKv(request.id, 'params', rows)}
            />
          </>
        )}
        {active === 'headers' && (
          <KeyValueEditor
            rows={request.headers}
            onChange={(rows) => setKv(request.id, 'headers', rows)}
          />
        )}
        {active === 'body' && <BodyEditor request={request} />}
        {active === 'auth' && <AuthPlaceholder />}
        {active === 'tests' && <TestsPanel request={request} />}
        {active === 'pre' && <ScriptPlaceholder name="Pre-request Script" />}
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
        {(['none', 'json', 'text', 'form-urlencoded', 'form-data'] as const).map((mode) => (
          <label key={mode} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
            <input
              type="radio"
              name={`bodymode-${request.id}`}
              checked={request.bodyMode === mode}
              onChange={() => update(request.id, { bodyMode: mode })}
            />
            <span>{mode}</span>
          </label>
        ))}
      </div>
      {(request.bodyMode === 'json' || request.bodyMode === 'text') && (
        <textarea
          value={request.bodyText}
          onChange={(e) => update(request.id, { bodyText: e.target.value })}
          placeholder={request.bodyMode === 'json' ? '{\n  "key": "value"\n}' : 'plain text body'}
          style={{
            width: '100%',
            minHeight: 240,
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            color: 'var(--text-primary)',
            padding: 12,
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 12.5,
            outline: 0,
            resize: 'vertical',
          }}
          spellCheck={false}
        />
      )}
      {request.bodyMode === 'none' && <p className="dim">This request does not have a body.</p>}
    </div>
  )
}

function AuthPlaceholder() {
  return (
    <div className="dim">
      <h4>Authorization</h4>
      <p>Inherit from parent collection or override with Bearer / Basic / API Key presets.</p>
    </div>
  )
}

function TestsPanel({ request }: { request: RequestWithTests }) {
  return (
    <div>
      <h4>Test Assertions</h4>
      {request.tests.length === 0 && <p className="dim">No tests defined yet.</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {request.tests.map((t) => (
          <li
            key={t.id}
            style={{
              padding: '10px 12px',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              fontFamily: '"JetBrains Mono", monospace',
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

function ScriptPlaceholder({ name }: { name: string }) {
  return (
    <div className="dim">
      <h4>{name}</h4>
      <p>Run JavaScript before the request is dispatched. Edit in the next iteration.</p>
    </div>
  )
}

function SettingsPlaceholder() {
  return (
    <div className="dim">
      <h4>Request Settings</h4>
      <p>Timeouts, redirects and SSL verification overrides will live here.</p>
    </div>
  )
}
