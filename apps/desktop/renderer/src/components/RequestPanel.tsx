import { useCallback, useMemo, useState } from 'react'
import type {
  AssertionRule,
  Collection,
  FolderNode,
  HttpMethod,
  RequestWithTests,
} from '@api-tester/shared'
import type { AssertionContext } from '@api-tester/domain'
import { evaluateAssertions } from '@api-tester/domain'
import { ui } from '../locale/ui'
import { useTabsStore } from '../store/tabs'
import { useWorkspaceStore } from '../store/workspace'
import { sendHttp } from '../lib/api'
import { uid } from '../lib/ids'
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

function normalizeHeaderKeys(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    out[k.toLowerCase()] = v
  }
  return out
}

export function RequestPanel({ request }: { request: RequestWithTests }) {
  const collections = useWorkspaceStore((s) => s.collections)
  const update = useWorkspaceStore((s) => s.updateRequest)
  const renameNode = useWorkspaceStore((s) => s.renameNode)
  const setKv = useWorkspaceStore((s) => s.setKv)
  const setResponse = useTabsStore((s) => s.setResponse)
  const [active, setActive] = useState<SubtabId>('params')
  const [saveHint, setSaveHint] = useState<string | null>(null)

  const enabledParams = request.params.filter((p) => p.enabled && p.key)
  const enabledHeaders = request.headers.filter((h) => h.enabled && h.key)
  const dirty = useMemo(
    () => ({
      params: enabledParams.length > 0,
      headers: enabledHeaders.length > 0,
      body:
        request.bodyMode === 'none'
          ? false
          : request.bodyMode === 'json' || request.bodyMode === 'text'
            ? request.bodyText.trim().length > 0
            : request.bodyFields.some((f) => f.enabled && f.key),
      auth: request.headers.some((h) => h.enabled && h.key.toLowerCase() === 'authorization'),
      tests: request.tests.length > 0,
    }),
    [
      enabledParams.length,
      enabledHeaders.length,
      request.bodyFields,
      request.bodyMode,
      request.bodyText,
      request.headers,
      request.tests.length,
    ]
  )

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

  const onRenameClick = useCallback(() => {
    const next = window.prompt(ui.request.renamePrompt, request.name)
    if (next == null) return
    const trimmed = next.trim()
    if (trimmed && trimmed !== request.name) renameNode(request.id, trimmed)
  }, [renameNode, request.id, request.name])

  const onSend = async () => {
    setResponse(request.id, { loading: true })
    try {
      const out = await sendHttp(request)
      let ctx: AssertionContext
      if (out.error) {
        ctx = { status: 0, headers: {}, bodyText: '' }
      } else {
        ctx = {
          status: out.response.status,
          headers: normalizeHeaderKeys(out.response.headers),
          bodyText: out.response.bodyText,
        }
      }
      const assertionResults =
        request.tests.length > 0 ? evaluateAssertions(request.tests, ctx) : undefined

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
        assertionResults,
      })
    } catch (e) {
      const ctx: AssertionContext = { status: 0, headers: {}, bodyText: '' }
      const assertionResults =
        request.tests.length > 0 ? evaluateAssertions(request.tests, ctx) : undefined
      setResponse(request.id, {
        loading: false,
        error: e instanceof Error ? e.message : String(e),
        receivedAt: Date.now(),
        assertionResults,
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
          <button type="button" className="btn btn--split" title={saveHint ?? undefined} onClick={() => void onSaveNow()}>
            <IconSave /> {ui.request.save} <IconChevDown width={14} height={14} />
          </button>
          {saveHint && <span className="request__hint muted">{saveHint}</span>}
          <button type="button" className="btn" title={ui.request.viewCode}>
            <IconCode />
          </button>
          <button type="button" className="btn" title={ui.request.rename} onClick={onRenameClick}>
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
            : tab.id === 'body' ? dirty.body
              : tab.id === 'auth' ? dirty.auth
                : tab.id === 'tests' ? dirty.tests
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

function AuthPlaceholder() {
  return (
    <div className="dim">
      <h4>{ui.request.authTitle}</h4>
      <p>{ui.request.authHint}</p>
    </div>
  )
}

const ASSERTION_TYPES: AssertionRule['type'][] = ['status', 'header', 'body_contains', 'json_path']
const OPS_EQ_EXISTS: NonNullable<AssertionRule['operator']>[] = ['eq', 'exists']

function defaultRule(kind: AssertionRule['type']): AssertionRule {
  switch (kind) {
    case 'status':
      return { id: uid('a'), type: 'status', operator: 'eq', expected: 200 }
    case 'header':
      return {
        id: uid('a'),
        type: 'header',
        target: 'content-type',
        operator: 'exists',
      }
    case 'body_contains':
      return { id: uid('a'), type: 'body_contains', operator: 'contains', expected: '' }
    case 'json_path':
      return {
        id: uid('a'),
        type: 'json_path',
        target: '$',
        operator: 'exists',
      }
    default:
      return { id: uid('a'), type: 'status', operator: 'eq', expected: 200 }
  }
}

function TestsPanel({ request }: { request: RequestWithTests }) {
  const update = useWorkspaceStore((s) => s.updateRequest)

  const setTests = (next: AssertionRule[]) => update(request.id, { tests: next })

  const patchRule = (id: string, patch: Partial<AssertionRule>) => {
    setTests(request.tests.map((t) => (t.id === id ? ({ ...t, ...patch } as AssertionRule) : t)))
  }

  return (
    <div className="tests-editor">
      <div className="kv__title-row">
        <h4 style={{ margin: 0 }}>{ui.request.testsTitle}</h4>
        <button
          type="button"
          className="kv__bulk"
          onClick={() => setTests([...request.tests, defaultRule('status')])}
        >
          {ui.request.testsAdd}
        </button>
      </div>
      <p className="dim" style={{ margin: '0 0 14px', fontSize: 12 }}>
        {ui.request.testsHint}
      </p>
      {request.tests.length === 0 && <p className="dim">{ui.request.noTests}</p>}
      <ul className="tests-editor__list">
        {request.tests.map((t) => (
          <li key={t.id} className="tests-editor__row">
            <div className="tests-editor__grid">
              <label className="tests-editor__field">
                <span className="tests-editor__label">{ui.request.testsType}</span>
                <select
                  value={t.type}
                  onChange={(e) => {
                    const kind = e.target.value as AssertionRule['type']
                    setTests(request.tests.map((x) => (x.id === t.id ? defaultRule(kind) : x)))
                  }}
                >
                  {ASSERTION_TYPES.map((kind) => (
                    <option key={kind} value={kind}>
                      {ui.request.testTypes[kind]}
                    </option>
                  ))}
                </select>
              </label>
              {(t.type === 'header' || t.type === 'json_path') && (
                <label className="tests-editor__field">
                  <span className="tests-editor__label">{ui.request.testsTarget}</span>
                  <input
                    type="text"
                    value={t.target ?? ''}
                    onChange={(e) => patchRule(t.id, { target: e.target.value })}
                    placeholder={t.type === 'json_path' ? '$.path' : 'Header-Name'}
                    spellCheck={false}
                  />
                </label>
              )}
              {(t.type === 'header' || t.type === 'json_path') && (
                <label className="tests-editor__field">
                  <span className="tests-editor__label">{ui.request.testsOperator}</span>
                  <select
                    value={t.operator ?? 'eq'}
                    onChange={(e) =>
                      patchRule(t.id, { operator: e.target.value as AssertionRule['operator'] })
                    }
                  >
                    {OPS_EQ_EXISTS.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(t.type === 'status' ||
                t.type === 'body_contains' ||
                ((t.type === 'header' || t.type === 'json_path') && t.operator !== 'exists')) &&
                (t.type === 'status' ? (
                  <label className="tests-editor__field tests-editor__field--grow">
                    <span className="tests-editor__label">{ui.request.testsExpected}</span>
                    <input
                      type="number"
                      value={
                        typeof t.expected === 'number' && Number.isFinite(t.expected)
                          ? t.expected
                          : 200
                      }
                      min={100}
                      max={599}
                      onChange={(e) => {
                        const n = Number.parseInt(e.target.value, 10)
                        patchRule(t.id, {
                          expected: Number.isFinite(n) ? n : 200,
                        })
                      }}
                    />
                  </label>
                ) : (
                  <label className="tests-editor__field tests-editor__field--grow">
                    <span className="tests-editor__label">{ui.request.testsExpected}</span>
                    <input
                      type="text"
                      value={t.expected === undefined ? '' : String(t.expected)}
                      onChange={(e) => patchRule(t.id, { expected: e.target.value })}
                      spellCheck={false}
                    />
                  </label>
                ))}
              <div className="tests-editor__field tests-editor__actions">
                <button
                  type="button"
                  className="kv__bulk"
                  onClick={() => setTests(request.tests.filter((x) => x.id !== t.id))}
                >
                  {ui.request.testsRemoveRow}
                </button>
              </div>
            </div>
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
