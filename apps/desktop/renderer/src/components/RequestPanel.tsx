import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  Collection,
  Environment,
  FolderNode,
  HttpStreamPushPayload,
  RequestWithTests,
  SendHttpStreamInvokeResult,
  WorkspaceMeta,
} from '@api-tester/shared'
import { defaultSendSettings } from '@api-tester/shared'
import { mergeVariables } from '@api-tester/domain'
import { ui } from '../locale/ui'
import { saveCollectionsToDisk } from '../lib/persistWorkspace'
import { useTabsStore } from '../store/tabs'
import { useWorkspaceStore } from '../store/workspace'
import { useSettingsStore } from '../store/settings'
import { sendHttp } from '../lib/api'
import { useWheelHorizontalScroll } from '../lib/useWheelHorizontalScroll'
import { tryFormatJson } from '../lib/format'
import { BulkKvModal } from './BulkKvModal'
import { JsonBodyEditor } from './JsonBodyEditor'
import { FormDataFieldsEditor } from './FormDataFieldsEditor'
import { KeyValueEditor } from './KeyValueEditor'
import { MethodPick } from './MethodPick'
import { IconClock, IconRouting, IconSave, IconSend, IconShield } from './icons'
import { LoadingButton } from './ui/LoadingButton'
import { RequestCodeModal } from './RequestCodeModal'

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

async function loadMergedEnvironmentVariables(): Promise<Record<string, string>> {
  const bridge = window.apiTester
  if (!bridge?.environmentsList || !bridge?.workspaceGet) return {}
  const [ws, envList] = await Promise.all([
    bridge.workspaceGet() as Promise<WorkspaceMeta>,
    bridge.environmentsList() as Promise<Environment[]>,
  ])
  const globalEnv = envList.find((e) => e.name.trim().toLowerCase() === 'global')
  const active = ws.activeEnvironmentId
    ? envList.find((e) => e.id === ws.activeEnvironmentId)
    : undefined
  return mergeVariables(globalEnv?.variables ?? [], active?.variables ?? [])
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
  const subtabsScrollRef = useRef<HTMLElement>(null)
  useWheelHorizontalScroll(subtabsScrollRef)
  const collections = useWorkspaceStore((s) => s.collections)
  const dirty = useWorkspaceStore((s) => Boolean(s.dirtyRequestIds[request.id]))
  const update = useWorkspaceStore((s) => s.updateRequest)
  const setKv = useWorkspaceStore((s) => s.setKv)
  const setResponse = useTabsStore((s) => s.setResponse)
  const [active, setActive] = useState<SubtabId>('params')
  const [saveHint, setSaveHint] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [paramsBulkOpen, setParamsBulkOpen] = useState(false)
  const [codeOpen, setCodeOpen] = useState(false)
  const responseState = useTabsStore((s) => s.responses[request.id])
  const sending = Boolean(responseState?.loading)

  const enabledHeaders = request.headers.filter((h) => h.enabled && h.key)
  const enabledParams = request.params.filter((p) => p.enabled && p.key)
  const enabledBodyFields = request.bodyFields.filter((f) => f.enabled && f.key)
  const hasUrl = request.url.trim().length > 0

  const breadcrumbParts = useMemo(
    () => breadcrumbForRequest(collections, request),
    [collections, request]
  )

  const onSaveNow = useCallback(async () => {
    setSaving(true)
    try {
      const r = await saveCollectionsToDisk({ onlyRequestId: request.id })
      if (!r.ok) {
        if (r.message === 'no-bridge') {
          setSaveHint(ui.request.saveNoBridge)
          window.setTimeout(() => setSaveHint(null), 3200)
          return
        }
        setSaveHint(ui.request.saveFail)
        window.setTimeout(() => setSaveHint(null), 3200)
        return
      }
      setSaveHint(ui.request.saveDone)
      window.setTimeout(() => setSaveHint(null), 2200)
    } finally {
      setSaving(false)
    }
  }, [request.id])

  const sendModKey =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
      ? '⌘'
      : 'Ctrl'

  const onSend = useCallback(async () => {
    if (!request.url.trim()) return
    // Sending is also an explicit save point: persist this request without
    // blocking the network operation or clearing dirty state from other tabs.
    void onSaveNow()
    const sendOpts = { ...defaultSendSettings(), ...request.sendSettings }
    const wantStream = sendOpts.streamResponse !== false
    const canStream = typeof window.apiTester?.sendHttpStream === 'function'
    if (wantStream && canStream) {
      const streamSessionId = globalThis.crypto.randomUUID()
      setResponse(request.id, { loading: true, streaming: true })
      try {
        const envVars = await loadMergedEnvironmentVariables()
        const streamResult = (await window.apiTester.sendHttpStream(
          { request, environmentVariables: envVars, streamSessionId },
          (evt: HttpStreamPushPayload) => {
            if (evt.streamSessionId !== streamSessionId) return
            if (evt.phase === 'headers') {
              setResponse(request.id, {
                loading: true,
                streaming: true,
                response: {
                  status: evt.status,
                  statusText: evt.statusText,
                  headers: evt.headers,
                  bodyText: '',
                  durationMs: 0,
                  sizeBytes: 0,
                },
              })
            } else if (evt.phase === 'chunk') {
              const prev = useTabsStore.getState().responses[request.id]
              const r = prev?.response
              if (!r) return
              const chunk = evt.text
              const delta = new TextEncoder().encode(chunk).length
              setResponse(request.id, {
                ...prev,
                loading: true,
                streaming: true,
                response: {
                  ...r,
                  bodyText: r.bodyText + chunk,
                  sizeBytes: r.sizeBytes + delta,
                },
              })
            }
          }
        )) as SendHttpStreamInvokeResult

        if (!streamResult.ok) {
          setResponse(request.id, {
            loading: false,
            streaming: false,
            error: streamResult.error,
            receivedAt: Date.now(),
          })
        } else {
          setResponse(request.id, {
            loading: false,
            streaming: false,
            response: streamResult.response,
            error: undefined,
            receivedAt: Date.now(),
          })
        }
      } catch (e) {
        setResponse(request.id, {
          loading: false,
          streaming: false,
          error: e instanceof Error ? e.message : String(e),
          receivedAt: Date.now(),
        })
      }
      return
    }

    if (wantStream && !canStream) {
      console.warn(
        '[api-tester] Preload has no sendHttpStream — using buffered send. Restart the desktop app after build, or run `pnpm dev` from apps/desktop so preload is rebuilt.'
      )
    }

    setResponse(request.id, { loading: true, streaming: false })
    try {
      const envVars = await loadMergedEnvironmentVariables()
      const out = await sendHttp(request, envVars)
      setResponse(request.id, {
        loading: false,
        streaming: false,
        response: { ...out.response },
        error: out.error,
        receivedAt: Date.now(),
      })
    } catch (e) {
      setResponse(request.id, {
        loading: false,
        streaming: false,
        error: e instanceof Error ? e.message : String(e),
        receivedAt: Date.now(),
      })
    }
  }, [request, setResponse, onSaveNow])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key === 's') {
        e.preventDefault()
        void onSaveNow()
        return
      }
      if (e.key !== 'Enter' || e.shiftKey) return
      if (sending || saving || paramsBulkOpen) return
      e.preventDefault()
      void onSend()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSaveNow, onSend, sending, saving, paramsBulkOpen])

  return (
    <section className="request">
      <div className="request__header">
        <div className="request__identity">
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
          {dirty && (
            <span className="request__save-state is-dirty">Unsaved changes</span>
          )}
        </div>
        <div className="header-actions">
          <button type="button" className="btn" onClick={() => setCodeOpen(true)}>
            {'</>'} {ui.request.viewCode}
          </button>
          <LoadingButton
            className="btn"
            loading={saving}
            loadingContent={
              <>
                <IconSave /> {ui.request.saving}
              </>
            }
            title={saveHint ?? undefined}
            onClick={() => void onSaveNow()}
          >
            <IconSave /> {ui.request.save}
          </LoadingButton>
          {saveHint && <span className="request__hint muted">{saveHint}</span>}
        </div>
      </div>
      {codeOpen && (
        <RequestCodeModal
          request={request}
          onClose={() => setCodeOpen(false)}
          onImport={(patch) => update(request.id, patch)}
        />
      )}

      <div className="url-bar">
        <MethodPick value={request.method} onChange={(m) => update(request.id, { method: m })} />
        <input
          className="url-input"
          value={request.url}
          onChange={(e) => update(request.id, { url: e.target.value })}
          placeholder={ui.request.urlPlaceholder}
          spellCheck={false}
          aria-invalid={!hasUrl}
        />
        <LoadingButton
          className="btn btn--primary url-bar__send"
          loading={sending}
          disabled={!hasUrl}
          title={ui.request.sendTitle(sendModKey)}
          loadingContent={
            <>
              <IconSend /> {ui.request.sending}
            </>
          }
          onClick={() => void onSend()}
        >
          <IconSend /> {ui.request.send}
        </LoadingButton>
      </div>

      <nav ref={subtabsScrollRef} className="subtabs">
        {SUBTABS.map((tab) => {
          const count =
            tab.id === 'params'
              ? enabledParams.length
              : tab.id === 'headers'
                ? enabledHeaders.length
                : tab.id === 'body' && request.bodyMode !== 'none'
                  ? Math.max(enabledBodyFields.length, 1)
                  : 0
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
        <span className="subtabs__shortcut">{sendModKey}+Enter to send</span>
      </nav>

      <div className={`subpanel${active === 'body' ? ' subpanel--body' : ''}`}>
        {active === 'params' && (
          <>
            <div className="kv__title-row">
              <h4 className="request-subpanel__title">{ui.request.queryParams}</h4>
              <button
                type="button"
                className="kv__bulk"
                onClick={() => setParamsBulkOpen(true)}
              >
                {ui.request.bulkEdit}
              </button>
            </div>
            <KeyValueEditor
              rows={request.params}
              onChange={(rows) => setKv(request.id, 'params', rows)}
            />
            {paramsBulkOpen && (
              <BulkKvModal
                rows={request.params}
                onClose={() => setParamsBulkOpen(false)}
                onApply={(next) => {
                  setKv(request.id, 'params', next)
                  setParamsBulkOpen(false)
                }}
              />
            )}
          </>
        )}
        {active === 'headers' && (
          <>
            <div className="kv__title-row">
              <h4 className="request-subpanel__title">{ui.request.headersTitle}</h4>
            </div>
            <KeyValueEditor
              rows={request.headers}
              onChange={(rows) => setKv(request.id, 'headers', rows)}
              collapseHidden
            />
          </>
        )}
        {active === 'body' && <BodyEditor request={request} />}
        {active === 'pre' && <PreRequestScriptPanel request={request} />}
        {active === 'settings' && <RequestSendSettingsPanel request={request} />}
      </div>
    </section>
  )
}

function BodyEditor({ request }: { request: RequestWithTests }) {
  const update = useWorkspaceStore((s) => s.updateRequest)
  const setKv = useWorkspaceStore((s) => s.setKv)
  const [jsonHint, setJsonHint] = useState<string | null>(null)

  const formatJsonBody = () => {
    const { pretty, ok } = tryFormatJson(request.bodyText)
    if (ok) {
      update(request.id, { bodyText: pretty })
      setJsonHint(null)
    } else {
      setJsonHint(ui.request.formatJsonInvalid)
      window.setTimeout(() => setJsonHint(null), 4200)
    }
  }

  return (
    <div className="body-editor">
      <div className="body-editor__toolbar">
        <div className="body-editor__modes">
          {BODY_MODES.map(({ id: mode, label }) => (
            <label key={mode} className="body-editor__mode">
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
        <div className="body-editor__toolbar-end">
          {request.bodyMode === 'json' && jsonHint && (
            <span className="body-editor__json-hint" title={jsonHint}>
              {jsonHint}
            </span>
          )}
          {request.bodyMode === 'json' && (
            <button type="button" className="body-editor__format-btn" onClick={formatJsonBody}>
              {ui.request.formatJson}
            </button>
          )}
        </div>
      </div>

      <div className="body-editor__main">
        {request.bodyMode === 'form-urlencoded' && (
          <>
            <div className="kv__title-row body-editor__kv-head">
              <h4 className="request-subpanel__title">{ui.request.bodyModes['form-urlencoded']}</h4>
            </div>
            <div className="body-editor__kv-scroll">
              <KeyValueEditor
                rows={request.bodyFields}
                onChange={(rows) => setKv(request.id, 'bodyFields', rows)}
                withDescription={false}
              />
            </div>
          </>
        )}
        {request.bodyMode === 'form-data' && (
          <>
            <div className="kv__title-row body-editor__kv-head">
              <h4 className="request-subpanel__title">{ui.request.bodyModes['form-data']}</h4>
            </div>
            <div className="body-editor__kv-scroll">
              <FormDataFieldsEditor
                rows={request.bodyFields}
                onChange={(rows) => setKv(request.id, 'bodyFields', rows)}
              />
            </div>
          </>
        )}
        {request.bodyMode === 'json' && (
          <JsonBodyEditor
            value={request.bodyText}
            placeholder={ui.request.bodyPlaceholderJson}
            onChange={(bodyText) => update(request.id, { bodyText })}
          />
        )}
        {request.bodyMode === 'text' && (
          <textarea
            className="body-editor__textarea"
            value={request.bodyText}
            onChange={(e) => update(request.id, { bodyText: e.target.value })}
            placeholder={ui.request.bodyPlaceholderText}
            spellCheck={false}
          />
        )}
        {request.bodyMode === 'none' && (
          <p className="body-editor__empty dim">{ui.request.noBody}</p>
        )}
      </div>
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
      <div className="request-settings__global-defaults">
        <span>此请求使用独立设置。</span>
        <button
          type="button"
          onClick={() =>
            update(request.id, {
              sendSettings: structuredClone(
                useSettingsStore.getState().settings.requestDefaults
              ),
            })
          }
        >
          重置为应用默认值
        </button>
      </div>
      <div className="request-settings__layout">
        <section className="request-settings__section">
          <div className="request-settings__section-head">
            <IconClock aria-hidden />
            <h5>Request limits</h5>
          </div>
          <div className="request-settings__compact-grid">
            <label className="request-settings__field">
              <span className="request-settings__label">{ui.request.settingsTimeout}</span>
              <div className="request-settings__number-wrap">
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
                <span>sec</span>
              </div>
              <span className="request-settings__hint muted">{ui.request.settingsTimeoutHint}</span>
            </label>

            <label className="request-settings__field">
              <span className="request-settings__label">{ui.request.settingsRedirects}</span>
              <div className="request-settings__number-wrap">
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
                <span>max</span>
              </div>
              <span className="request-settings__hint muted">{ui.request.settingsRedirectsHint}</span>
            </label>
          </div>
        </section>

        <section className="request-settings__section">
          <div className="request-settings__section-head">
            <IconRouting aria-hidden />
            <h5>Proxy routing</h5>
          </div>
          <label className="request-settings__field">
            <span className="request-settings__label">{ui.request.settingsProxy}</span>
            <select
              value={merged.proxyMode ?? 'system'}
              onChange={(e) =>
                patch({ proxyMode: e.target.value as 'direct' | 'system' | 'custom' })
              }
              className="request-settings__input request-settings__input--wide"
            >
              <option value="system">{ui.request.settingsProxySystem}</option>
              <option value="custom">{ui.request.settingsProxyCustom}</option>
              <option value="direct">{ui.request.settingsProxyDirect}</option>
            </select>
            <span className="request-settings__hint muted">{ui.request.settingsProxyHint}</span>
          </label>

          {(merged.proxyMode ?? 'system') === 'custom' && (
            <label className="request-settings__field request-settings__proxy-url">
              <span className="request-settings__label">{ui.request.settingsProxyUrl}</span>
              <input
                type="text"
                value={merged.proxyUrl ?? ''}
                onChange={(e) => patch({ proxyUrl: e.target.value })}
                placeholder="http://127.0.0.1:7890"
                className="request-settings__input request-settings__input--wide"
                spellCheck={false}
              />
              <span className="request-settings__hint muted">{ui.request.settingsProxyUrlHint}</span>
            </label>
          )}
        </section>

        <section className="request-settings__section">
          <div className="request-settings__section-head">
            <IconShield aria-hidden />
            <h5>Security &amp; response</h5>
          </div>
          <div className="request-settings__toggles">
            <label className="request-settings__toggle">
              <span className="request-settings__toggle-copy">
                <strong>{ui.request.settingsTls}</strong>
                <small>{ui.request.settingsTlsHint}</small>
              </span>
              <input
                type="checkbox"
                checked={merged.validateTls}
                onChange={(e) => patch({ validateTls: e.target.checked })}
              />
              <span className="request-settings__switch" aria-hidden />
            </label>

            <label className="request-settings__toggle">
              <span className="request-settings__toggle-copy">
                <strong>{ui.request.settingsBufferFullResponse}</strong>
                <small>{ui.request.settingsBufferFullResponseHint}</small>
              </span>
              <input
                type="checkbox"
                checked={merged.streamResponse === false}
                onChange={(e) => patch({ streamResponse: e.target.checked ? false : true })}
              />
              <span className="request-settings__switch" aria-hidden />
            </label>
          </div>
        </section>
      </div>
    </div>
  )
}

function PreRequestScriptPanel({ request }: { request: RequestWithTests }) {
  const update = useWorkspaceStore((s) => s.updateRequest)
  return (
    <div className="pre-script-editor">
      <h4 className="request-subpanel__title">{ui.request.scriptPre}</h4>
      <p className="pre-script-editor__hint dim">{ui.request.scriptHint}</p>
      <textarea
        className="body-editor__textarea pre-script-editor__textarea"
        value={request.preRequestScript ?? ''}
        onChange={(e) => update(request.id, { preRequestScript: e.target.value })}
        spellCheck={false}
        placeholder={'// pm.environment.set("ts", Date.now().toString())'}
        rows={16}
      />
    </div>
  )
}
