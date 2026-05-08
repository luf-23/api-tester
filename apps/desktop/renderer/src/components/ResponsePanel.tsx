import type { AssertionResultItem } from '@api-tester/domain'
import { useMemo, useState } from 'react'
import { ui } from '../locale/ui'
import { useWorkspaceStore } from '../store/workspace'
import { useTabsStore } from '../store/tabs'
import { formatBytes, formatDuration, safeParseJson, statusClass, tryFormatJson } from '../lib/format'
import { JsonView } from './JsonView'
import { IconChevDown, IconSearch } from './icons'

const SECTIONS = [
  ui.response.sections.body,
  ui.response.sections.cookies,
  ui.response.sections.headers,
  ui.response.sections.tests,
] as const
type Section = (typeof SECTIONS)[number]

const VIEW_TABS = [
  ui.response.views.pretty,
  ui.response.views.raw,
  ui.response.views.preview,
  ui.response.views.visualize,
] as const
type ViewTab = (typeof VIEW_TABS)[number]

interface Props {
  requestId: string
}

function relativeTime(ts?: number): string {
  if (!ts) return ui.response.relativeNever
  const diff = Date.now() - ts
  if (diff < 60_000) return ui.response.relativeJustNow
  return ui.response.relativeMinutesAgo(Math.round(diff / 60_000))
}

function emptySectionCounts(): Record<Section, number> {
  return {
    [SECTIONS[0]]: 0,
    [SECTIONS[1]]: 0,
    [SECTIONS[2]]: 0,
    [SECTIONS[3]]: 0,
  }
}

export function ResponsePanel({ requestId }: Props) {
  const state = useTabsStore((s) => s.responses[requestId])
  const testRuleCount = useWorkspaceStore((s) => s.getRequest(requestId)?.tests.length ?? 0)
  const [section, setSection] = useState<Section>(SECTIONS[0])
  const [view, setView] = useState<ViewTab>(VIEW_TABS[0])

  const response = state?.response
  const sectionCounts = useMemo(() => {
    if (!response) return emptySectionCounts()
    const headerCount = Object.keys(response.headers).length
    const cookies = (response.headers['set-cookie'] ?? '').split(',').filter(Boolean).length
    const testsCount = state?.assertionResults?.length ?? 0
    return {
      [SECTIONS[0]]: 0,
      [SECTIONS[1]]: cookies || (headerCount ? 2 : 0),
      [SECTIONS[2]]: headerCount,
      [SECTIONS[3]]: testsCount,
    } satisfies Record<Section, number>
  }, [response, state?.assertionResults?.length])

  if (!response && !state?.loading) {
    if (state?.error) {
      return (
        <section className="response">
          <div className="response__head">
            <span className="status-pill s-5xx">{ui.response.errorSending}</span>
            <span className="muted">{state.error}</span>
          </div>
        </section>
      )
    }
    return (
      <section className="response">
        <div className="response__head">
          <span className="muted">{ui.response.noResponse}</span>
        </div>
      </section>
    )
  }

  if (state?.loading) {
    return (
      <section className="response">
        <div className="response__head">
          <span className="muted">{ui.response.sending}</span>
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
            type="button"
            className={`subtab${section === s ? ' is-active' : ''}`}
            onClick={() => setSection(s)}
            style={{ height: '100%' }}
          >
            <span>{s}</span>
            {s !== SECTIONS[0] && (
              <span className="subtab__badge">{sectionCounts[s]}</span>
            )}
          </button>
        ))}
        <div className="response__meta">
          <span className={`status-pill ${statusClass(r.status)}`}>
            {r.status} {r.statusText || ui.response.okFallback}
          </span>
          <span>{formatDuration(r.durationMs)}</span>
          <span>{formatBytes(r.sizeBytes)}</span>
          <span>{relativeTime(state?.receivedAt)}</span>
        </div>
      </div>

      <div className="response__body">
        <div className="response__view">
          <div className="response__viewbar">
            {section === SECTIONS[0] && VIEW_TABS.map((v) => (
              <button
                key={v}
                type="button"
                className={`viewbar-tab${view === v ? ' is-active' : ''}`}
                onClick={() => setView(v)}
              >{v}</button>
            ))}
            {section === SECTIONS[0] && <div className="viewbar__spacer" />}
            {section === SECTIONS[0] && (
              <select className="viewbar-pick" defaultValue="JSON">
                <option>JSON</option>
                <option>HTML</option>
                <option>XML</option>
                <option>Text</option>
              </select>
            )}
          </div>
          {section === SECTIONS[0] && (
            view === VIEW_TABS[1] ? (
              <pre className="response__raw-pre">{r.bodyText}</pre>
            ) : (
              <JsonView text={formatted.pretty} />
            )
          )}
          {section === SECTIONS[2] && <HeadersList headers={r.headers} />}
          {section === SECTIONS[1] && <CookiesList headers={r.headers} />}
          {section === SECTIONS[3] && (
            <TestResultsList
              assertionResults={state?.assertionResults}
              testRuleCount={testRuleCount}
            />
          )}
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

function TestResultsList({
  assertionResults,
  testRuleCount,
}: {
  assertionResults?: AssertionResultItem[]
  testRuleCount: number
}) {
  if (testRuleCount === 0) {
    return (
      <div className="response__mono-scroll dim" style={{ padding: 16 }}>
        {ui.response.testsNoneDefined}
      </div>
    )
  }
  if (!assertionResults || assertionResults.length === 0) {
    return (
      <div className="response__mono-scroll dim" style={{ padding: 16 }}>
        {ui.response.testsNoRunYet}
      </div>
    )
  }
  return (
    <ul className="response__tests-list">
      {assertionResults.map((it) => (
        <li key={it.ruleId} className="response__test-item">
          <span
            className="response__test-dot"
            style={{
              background: it.ok ? 'var(--status-2xx)' : 'var(--status-5xx)',
            }}
          />
          <span className="response__test-pass">{it.ok ? ui.response.pass : ui.response.fail}</span>
          <span className="muted response__test-detail">
            {it.message ?? (it.ok ? '—' : '')}
          </span>
        </li>
      ))}
    </ul>
  )
}

function describeType(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return ui.response.types.array(v.length)
  switch (typeof v) {
    case 'number':
      return ui.response.types.number
    case 'string':
      return ui.response.types.string
    case 'boolean':
      return ui.response.types.boolean
    case 'object':
      return ui.response.types.object
    case 'undefined':
      return ui.response.types.undefined
    case 'symbol':
      return ui.response.types.symbol
    case 'function':
      return ui.response.types.function
    case 'bigint':
      return ui.response.types.bigint
    default:
      return typeof v
  }
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
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded((s) => !s)
          }
        }}
        role="button"
        tabIndex={0}
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
        <span>{ui.response.explorerTitle}</span>
        <IconChevDown width={14} height={14} />
      </div>
      <div className="explorer__search">
        <IconSearch width={16} height={16} />
        <input placeholder={ui.response.searchResponse} />
      </div>
      <div className="explorer__tree">
        {json === undefined ? (
          <div className="dim" style={{ padding: 8 }}>{ui.response.notJson}</div>
        ) : Array.isArray(json) || typeof json === 'object' ? (
          Object.entries(json as Record<string, unknown>).map(([k, v]) => (
            <ExplorerNode key={k} name={k} value={v} depth={0} />
          ))
        ) : (
          <ExplorerNode name={ui.response.explorerValueKey} value={json} depth={0} />
        )}
      </div>
    </aside>
  )
}
