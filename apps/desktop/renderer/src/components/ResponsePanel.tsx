import { useEffect, useMemo, useRef, useState } from 'react'
import type { HttpResponseView } from '@api-tester/shared'
import { ui } from '../locale/ui'
import { useTabsStore } from '../store/tabs'
import { formatBytes, formatDuration, safeParseJson, statusClass, tryFormatJson } from '../lib/format'
import { JsonView } from './JsonView'
import { IconChevDown, IconSearch } from './icons'

const SECTIONS = [
  ui.response.sections.body,
  ui.response.sections.cookies,
  ui.response.sections.headers,
] as const
type Section = (typeof SECTIONS)[number]

const VIEW_TABS = [
  ui.response.views.json,
  ui.response.views.raw,
  ui.response.views.preview,
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

/** Avoid showing "0 OK" when status is 0 and statusText is empty; only use OK fallback for 2xx. */
function formatStatusLine(r: { status: number; statusText: string }): string {
  const phrase =
    (r.statusText ?? '').trim() ||
    (r.status >= 200 && r.status < 300 ? ui.response.okFallback : '')
  return phrase ? `${r.status} ${phrase}` : String(r.status)
}

function emptySectionCounts(): Record<Section, number> {
  return {
    [SECTIONS[0]]: 0,
    [SECTIONS[1]]: 0,
    [SECTIONS[2]]: 0,
  }
}

function contentTypeFromHeaders(headers: Record<string, string>): string {
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === 'content-type' && typeof v === 'string') {
      return v.split(';')[0].trim().toLowerCase()
    }
  }
  return ''
}

function responseImagePreview(r: HttpResponseView): { src: string; mime: string } | undefined {
  if (!r.bodyBase64) return undefined
  let mime = r.bodyMime?.trim() ?? ''
  if (!mime.startsWith('image/')) mime = contentTypeFromHeaders(r.headers)
  if (!mime.startsWith('image/')) return undefined
  return { src: `data:${mime};base64,${r.bodyBase64}`, mime }
}

const PREVIEW_MAX_MB = 15
const PREVIEW_MAX_BYTES = PREVIEW_MAX_MB * 1024 * 1024

/** True only when server claims image/* and body is too large to embed (not other bugs/missing fields). */
function responseImageTooLargeForPreview(r: HttpResponseView): boolean {
  const ct = contentTypeFromHeaders(r.headers)
  return ct.startsWith('image/') && !r.bodyBase64 && r.sizeBytes > PREVIEW_MAX_BYTES
}

/** image/* and small body but no base64 preview — wrong generic message otherwise. */
function responseImagePreviewMissing(r: HttpResponseView): boolean {
  const ct = contentTypeFromHeaders(r.headers)
  return (
    ct.startsWith('image/') &&
    !r.bodyBase64 &&
    r.sizeBytes > 0 &&
    r.sizeBytes <= PREVIEW_MAX_BYTES
  )
}

/** Image/* (or sniffed image with bodyMime) — body is not JSON; skip parse/highlight on huge decoded text. */
function isImageLikeResponse(r: HttpResponseView): boolean {
  const ct = contentTypeFromHeaders(r.headers)
  if (ct.startsWith('image/')) return true
  const mime = r.bodyMime?.trim().toLowerCase() ?? ''
  return mime.startsWith('image/')
}

/** Max chars rendered in Raw / JSON fallback for image bodies — avoids multi‑MB DOM and tokenizer stalls. */
const IMAGE_BODY_DISPLAY_CHAR_CAP = 96 * 1024

export function ResponsePanel({ requestId }: Props) {
  const state = useTabsStore((s) => s.responses[requestId])
  const [section, setSection] = useState<Section>(SECTIONS[0])
  const [view, setView] = useState<ViewTab>(VIEW_TABS[0])
  const prevRequestId = useRef(requestId)

  const response = state?.response

  useEffect(() => {
    if (state?.loading) return
    const r = state?.response
    const switchedTab = prevRequestId.current !== requestId
    if (switchedTab) {
      prevRequestId.current = requestId
      if (r && responseImagePreview(r)) setView(VIEW_TABS[2])
      else setView(VIEW_TABS[0])
      return
    }
    if (state?.receivedAt && r && responseImagePreview(r)) setView(VIEW_TABS[2])
  }, [requestId, state?.response, state?.loading, state?.receivedAt])
  const sectionCounts = useMemo(() => {
    if (!response) return emptySectionCounts()
    const headerCount = Object.keys(response.headers).length
    const cookies = (response.headers['set-cookie'] ?? '').split(',').filter(Boolean).length
    return {
      [SECTIONS[0]]: 0,
      [SECTIONS[1]]: cookies || (headerCount ? 2 : 0),
      [SECTIONS[2]]: headerCount,
    } satisfies Record<Section, number>
  }, [response])

  const imageLike = useMemo(
    () => (response ? isImageLikeResponse(response) : false),
    [response]
  )

  const { formatted, json } = useMemo(() => {
    if (!response) {
      return { formatted: { pretty: '', ok: false as const }, json: undefined as unknown }
    }
    if (imageLike) {
      return { formatted: { pretty: '', ok: false as const }, json: undefined as unknown }
    }
    return {
      formatted: tryFormatJson(response.bodyText),
      json: safeParseJson(response.bodyText),
    }
  }, [response, imageLike])

  const rawDisplayText = useMemo(() => {
    if (!response) return ''
    if (!imageLike || response.bodyText.length <= IMAGE_BODY_DISPLAY_CHAR_CAP) {
      return response.bodyText
    }
    return `${response.bodyText.slice(0, IMAGE_BODY_DISPLAY_CHAR_CAP)}\n\n…\n${ui.response.rawImageTruncated}`
  }, [response, imageLike])

  if (state?.loading && !state?.streaming) {
    return (
      <section className="response">
        <div className="response__head">
          <span className="muted">{ui.response.sending}</span>
        </div>
      </section>
    )
  }

  if (state?.loading && state?.streaming && !state?.response) {
    return (
      <section className="response">
        <div className="response__head">
          <span className="muted">{ui.response.streaming}</span>
        </div>
      </section>
    )
  }

  /** sendRequest still returns an empty HttpResponseView on failure; error carries the real reason. */
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

  if (!response) {
    return (
      <section className="response">
        <div className="response__head">
          <span className="muted">{ui.response.noResponse}</span>
        </div>
      </section>
    )
  }

  const r = response
  const imgPreview = responseImagePreview(r)
  const imageTooLarge = responseImageTooLargeForPreview(r)
  const imagePreviewMissing = responseImagePreviewMissing(r)

  return (
    <section className="response">
      <div className="response__head">
        {SECTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className={`subtab${section === s ? ' is-active' : ''}`}
            onClick={() => setSection(s)}
          >
            <span>{s}</span>
            {s !== SECTIONS[0] && (
              <span className="subtab__badge">{sectionCounts[s]}</span>
            )}
          </button>
        ))}
        <div className="response__meta">
          <span className={`status-pill ${statusClass(r.status)}`}>
            {formatStatusLine(r)}
          </span>
          {state?.streaming ? (
            <span className="muted">{ui.response.streaming}</span>
          ) : (
            <>
              <span>{formatDuration(r.durationMs)}</span>
              <span>{formatBytes(r.sizeBytes)}</span>
              <span>{relativeTime(state?.receivedAt)}</span>
            </>
          )}
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
          </div>
          {section === SECTIONS[0] &&
            (view === VIEW_TABS[1] ? (
              <>
                {imgPreview && (
                  <p className="response__binary-hint muted">{ui.response.imageBinaryHint}</p>
                )}
                <pre className="response__raw-pre">{rawDisplayText}</pre>
              </>
            ) : view === VIEW_TABS[2] ? (
              imgPreview ? (
                <div className="response__image-preview">
                  <img src={imgPreview.src} alt="" draggable={false} />
                </div>
              ) : imageTooLarge ? (
                <div className="response__preview-empty dim">{ui.response.previewTooLarge(PREVIEW_MAX_MB)}</div>
              ) : imagePreviewMissing ? (
                <div className="response__preview-empty dim">{ui.response.previewImageMissing}</div>
              ) : (
                <div className="response__preview-empty dim">{ui.response.previewNoVisual}</div>
              )
            ) : imageLike ? (
              <div className="response__preview-empty dim" style={{ padding: 12 }}>
                {ui.response.imageNotJsonBody}
              </div>
            ) : (
              <JsonView text={formatted.pretty} />
            ))}
          {section === SECTIONS[2] && <HeadersList headers={r.headers} />}
          {section === SECTIONS[1] && <CookiesList headers={r.headers} />}
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
        <input placeholder={ui.response.searchResponse} spellCheck={false} />
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
