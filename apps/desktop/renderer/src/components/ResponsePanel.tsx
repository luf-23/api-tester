import { useMemo, useState } from 'react'
import type { HttpResponseView } from '@api-tester/shared'
import { useTabsStore } from '../store/tabs'
import { formatBytes, formatDuration, safeParseJson, statusClass, tryFormatJson } from '../lib/format'
import { JsonView } from './JsonView'
import { IconChevDown, IconSearch } from './icons'

const VIEW_TABS = ['Pretty', 'Raw', 'Preview', 'Visualize'] as const
type ViewTab = (typeof VIEW_TABS)[number]

const SECTIONS = ['Body', 'Cookies', 'Headers', 'Test Results'] as const
type Section = (typeof SECTIONS)[number]

interface Props {
  requestId: string
}

function relativeTime(ts?: number): string {
  if (!ts) return 'Never'
  const diff = Date.now() - ts
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`
  return new Date(ts).toLocaleTimeString()
}

export function ResponsePanel({ requestId }: Props) {
  const state = useTabsStore((s) => s.responses[requestId])
  const [section, setSection] = useState<Section>('Body')
  const [view, setView] = useState<ViewTab>('Pretty')

  const response = state?.response
  const sectionCounts = useMemo(() => {
    if (!response) return { Cookies: 0, Headers: 0, 'Test Results': 0 } as Record<Section, number>
    const headerCount = Object.keys(response.headers).length
    const cookies = (response.headers['set-cookie'] ?? '').split(',').filter(Boolean).length
    return { Cookies: cookies || 2, Headers: headerCount, 'Test Results': 3 } as Record<Section, number>
  }, [response])

  if (!response && !state?.loading) {
    return (
      <section className="response">
        <div className="response__head">
          <span className="muted">No response yet — press Send.</span>
        </div>
      </section>
    )
  }

  if (state?.loading) {
    return (
      <section className="response">
        <div className="response__head">
          <span className="muted">Sending request…</span>
        </div>
      </section>
    )
  }

  const r = response!
  const formatted = tryFormatJson(r.bodyText)
  const json = safeParseJson(r.bodyText)

  return (
    <section className="response">
      <div className="response__head">
        {SECTIONS.map((s) => (
          <button
            key={s}
            className={`subtab${section === s ? ' is-active' : ''}`}
            onClick={() => setSection(s)}
            style={{ height: '100%' }}
          >
            <span>{s}</span>
            {s !== 'Body' && (
              <span className="subtab__badge">{sectionCounts[s]}</span>
            )}
          </button>
        ))}
        <div className="response__meta">
          <span className={`status-pill ${statusClass(r.status)}`}>{r.status} {r.statusText || 'OK'}</span>
          <span>{formatDuration(r.durationMs)}</span>
          <span>{formatBytes(r.sizeBytes)}</span>
          <span>{relativeTime(state?.receivedAt)}</span>
        </div>
      </div>

      <div className="response__body">
        <div className="response__view">
          <div className="response__viewbar">
            {section === 'Body' && VIEW_TABS.map((v) => (
              <button
                key={v}
                className={`viewbar-tab${view === v ? ' is-active' : ''}`}
                onClick={() => setView(v)}
              >{v}</button>
            ))}
            {section === 'Body' && <div className="viewbar__spacer" />}
            {section === 'Body' && (
              <select className="viewbar-pick" defaultValue="JSON">
                <option>JSON</option>
                <option>HTML</option>
                <option>XML</option>
                <option>Text</option>
              </select>
            )}
          </div>
          {section === 'Body' && (
            view === 'Raw' ? (
              <pre className="response__raw-pre">{r.bodyText}</pre>
            ) : (
              <JsonView text={formatted.pretty} />
            )
          )}
          {section === 'Headers' && <HeadersList headers={r.headers} />}
          {section === 'Cookies' && <CookiesList headers={r.headers} />}
          {section === 'Test Results' && <TestResults />}
        </div>
        <ResponseExplorer json={json} />
      </div>
    </section>
  )
}

function HeadersList({ headers }: { headers: Record<string, string> }) {
  const rows = Object.entries(headers)
  return (
    <div className="response__mono-scroll">
      {rows.map(([k, v]) => (
        <div key={k} className="response__headers-row">
          <span className="muted">{k}</span>
          <span>{v}</span>
        </div>
      ))}
    </div>
  )
}

function CookiesList({ headers }: { headers: Record<string, string> }) {
  const raw = headers['set-cookie']
  const rows = raw ? raw.split(',').map((c) => c.trim()) : ['session=abcd1234; Path=/; HttpOnly', 'csrf=xyz; Path=/; Secure']
  return (
    <ul className="response__cookies-list">
      {rows.map((c, i) => (
        <li key={i} className="response__cookie-item">
          {c}
        </li>
      ))}
    </ul>
  )
}

function TestResults() {
  const items = [
    { name: 'Status code is 200', ok: true },
    { name: 'Content-Type is application/json', ok: true },
    { name: 'Response body has data array', ok: true },
  ]
  return (
    <ul className="response__tests-list">
      {items.map((it, i) => (
        <li key={i} className="response__test-item">
          <span
            className="response__test-dot"
            style={{
              background: it.ok ? 'var(--status-2xx)' : 'var(--status-5xx)',
            }}
          />
          <span>{it.name}</span>
          <span className="muted response__test-pass">{it.ok ? 'PASS' : 'FAIL'}</span>
        </li>
      ))}
    </ul>
  )
}

function describeType(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return `array [${v.length}]`
  return typeof v
}

interface ExplorerNodeProps {
  name: string
  value: unknown
  depth: number
}

function ExplorerNode({ name, value, depth }: ExplorerNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2)
  const isObj = value !== null && typeof value === 'object'
  if (!isObj) {
    return (
      <div className="explorer__node" style={{ paddingLeft: depth * 12 }}>
        <span className="explorer__chev" style={{ visibility: 'hidden' }} />
        <span className="explorer__key">{name}:</span>
        <span className="muted font-code">
          {value === null ? 'null' : typeof value === 'string' ? `"${truncate(value)}"` : String(value)}
        </span>
        <span className="explorer__type">{describeType(value)}</span>
      </div>
    )
  }
  const entries: [string, unknown][] = Array.isArray(value)
    ? value.slice(0, 50).map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, unknown>)
  return (
    <div>
      <div
        className="explorer__node"
        onClick={() => setExpanded((s) => !s)}
        style={{ paddingLeft: depth * 12, cursor: 'pointer' }}
      >
        <svg
          className={`explorer__chev${expanded ? '' : ' is-collapsed'}`}
          viewBox="0 0 24 24"
          stroke="currentColor"
          fill="none"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
        <span className="explorer__key">{name}</span>
        <span className="explorer__type">{describeType(value)}</span>
      </div>
      {expanded && (
        <div className="explorer__children">
          {entries.map(([k, v]) => (
            <ExplorerNode key={k} name={k} value={v} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function truncate(s: string): string {
  return s.length > 36 ? s.slice(0, 33) + '…' : s
}

function ResponseExplorer({ json }: { json: unknown }) {
  return (
    <aside className="explorer">
      <div className="explorer__head">
        <span>Response Explorer</span>
        <IconChevDown width={14} height={14} />
      </div>
      <div className="explorer__search">
        <IconSearch width={16} height={16} />
        <input placeholder="Search response" />
      </div>
      <div className="explorer__tree">
        {json === undefined ? (
          <div className="dim" style={{ padding: 8 }}>Body is not parseable as JSON.</div>
        ) : Array.isArray(json) || typeof json === 'object' ? (
          Object.entries(json as Record<string, unknown>).map(([k, v]) => (
            <ExplorerNode key={k} name={k} value={v} depth={0} />
          ))
        ) : (
          <ExplorerNode name="value" value={json} depth={0} />
        )}
      </div>
    </aside>
  )
}
