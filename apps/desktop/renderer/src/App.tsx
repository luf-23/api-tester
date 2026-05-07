import { useEffect, useMemo, useRef, useState } from 'react'
import { mapDraftMethod, newAssertionRule, useAppStore } from './store'
import type { AssertionRule, BodyMode, KeyValue } from '@api-tester/shared'

function newId(): string {
  return globalThis.crypto.randomUUID()
}

function KeyValueEditor(props: {
  title: string
  rows: KeyValue[]
  onChange: (rows: KeyValue[]) => void
}): React.ReactElement {
  return (
    <div className="stack">
      <div className="titleSm">{props.title}</div>
      <table className="gridTable">
        <thead>
          <tr>
            <th style={{ width: 40 }} />
            <th>Key</th>
            <th>Value</th>
            <th style={{ width: 90 }} />
          </tr>
        </thead>
        <tbody>
          {props.rows.map((r, idx) => (
            <tr key={r.id}>
              <td>
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => {
                    const next = [...props.rows]
                    next[idx] = { ...r, enabled: e.target.checked }
                    props.onChange(next)
                  }}
                />
              </td>
              <td>
                <input
                  className="smallInput mono"
                  value={r.key}
                  onChange={(e) => {
                    const next = [...props.rows]
                    next[idx] = { ...r, key: e.target.value }
                    props.onChange(next)
                  }}
                />
              </td>
              <td>
                <input
                  className="smallInput mono"
                  value={r.value}
                  onChange={(e) => {
                    const next = [...props.rows]
                    next[idx] = { ...r, value: e.target.value }
                    props.onChange(next)
                  }}
                />
              </td>
              <td>
                <button
                  type="button"
                  className="btn"
                  onClick={() => props.onChange(props.rows.filter((x) => x.id !== r.id))}
                >
                  删除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        className="btn"
        onClick={() =>
          props.onChange([
            ...props.rows,
            { id: newId(), key: '', value: '', enabled: true },
          ])
        }
      >
        添加行
      </button>
    </div>
  )
}

export function App(): React.ReactElement {
  const store = useAppStore()
  const [collectionName, setCollectionName] = useState('My Collection')
  const [envName, setEnvName] = useState('dev')
  const importWsRef = useRef<HTMLInputElement>(null)
  const importPmRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void store.loadBootstrap()
  }, [store])

  const activeEnvLabel = useMemo(() => {
    const e = store.environments.find((x) => x.id === store.activeEnvironmentId)
    return e?.name ?? '（未选择）'
  }, [store.environments, store.activeEnvironmentId])

  const testsPanel = (
    <div className="stack">
      <div className="hint">
        断言在「集合运行」与后置校验中使用；单请求发送暂只做网络调用（可在集合运行中批量断言）。
      </div>
      <button
        type="button"
        className="btn"
        onClick={() =>
          store.setDraft({ tests: [...store.draft.tests, newAssertionRule()] })
        }
      >
        添加断言
      </button>
      {store.draft.tests.map((t, idx) => (
        <div key={t.id} className="stack" style={{ border: '1px solid var(--border)', padding: 10, borderRadius: 8 }}>
          <div className="row">
            <select
              className="smallInput"
              style={{ width: 160 }}
              value={t.type}
              onChange={(e) => {
                const next = [...store.draft.tests]
                const nt = e.target.value as AssertionRule['type']
                next[idx] = {
                  ...t,
                  type: nt,
                  expected: nt === 'status' ? 200 : t.expected,
                }
                store.setDraft({ tests: next })
              }}
            >
              <option value="status">status</option>
              <option value="header">header</option>
              <option value="body_contains">body_contains</option>
              <option value="json_path">json_path</option>
            </select>
            <button
              type="button"
              className="btn danger"
              onClick={() =>
                store.setDraft({
                  tests: store.draft.tests.filter((x) => x.id !== t.id),
                })
              }
            >
              删除
            </button>
          </div>
          {(t.type === 'header' || t.type === 'json_path') && (
            <input
              className="smallInput mono"
              placeholder={t.type === 'header' ? 'Header 名称，如 Authorization' : 'JSONPath，如 $.data.id'}
              value={t.target ?? ''}
              onChange={(e) => {
                const next = [...store.draft.tests]
                next[idx] = { ...t, target: e.target.value }
                store.setDraft({ tests: next })
              }}
            />
          )}
          <div className="row">
            <select
              className="smallInput"
              style={{ width: 140 }}
              value={t.operator ?? 'eq'}
              onChange={(e) => {
                const next = [...store.draft.tests]
                next[idx] = {
                  ...t,
                  operator: e.target.value as AssertionRule['operator'],
                }
                store.setDraft({ tests: next })
              }}
            >
              <option value="eq">eq</option>
              <option value="contains">contains</option>
              <option value="exists">exists</option>
            </select>
            <input
              className="smallInput mono"
              placeholder="期望值（exists 可留空）"
              value={t.expected === undefined ? '' : String(t.expected)}
              onChange={(e) => {
                const next = [...store.draft.tests]
                const raw = e.target.value
                if (t.type === 'status') {
                  next[idx] = { ...t, expected: Number(raw) }
                } else {
                  next[idx] = { ...t, expected: raw }
                }
                store.setDraft({ tests: next })
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )

  const bodyPanel = (
    <div className="stack">
      <div className="row">
        <span className="pill">Body 模式</span>
        <select
          className="smallInput"
          style={{ width: 220 }}
          value={store.draft.bodyMode}
          onChange={(e) =>
            store.setDraft({ bodyMode: e.target.value as BodyMode })
          }
        >
          <option value="none">none</option>
          <option value="json">json</option>
          <option value="text">text</option>
          <option value="form-urlencoded">x-www-form-urlencoded</option>
          <option value="form-data">form-data（文本字段）</option>
        </select>
      </div>
      {(store.draft.bodyMode === 'json' || store.draft.bodyMode === 'text') && (
        <textarea
          className="smallInput mono"
          style={{ minHeight: 220, width: '100%' }}
          value={store.draft.bodyText}
          onChange={(e) => store.setDraft({ bodyText: e.target.value })}
        />
      )}
      {(store.draft.bodyMode === 'form-urlencoded' ||
        store.draft.bodyMode === 'form-data') && (
        <KeyValueEditor
          title="字段"
          rows={store.draft.bodyFields}
          onChange={(rows) => store.setDraft({ bodyFields: rows })}
        />
      )}
    </div>
  )

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="sidebarHeader">工作区</div>
        <div className="sidebarSection stack">
          <div className="hint">环境：{activeEnvLabel}</div>
          <select
            className="smallInput"
            value={store.activeEnvironmentId ?? ''}
            onChange={(e) => {
              const id = e.target.value || null
              store.setActiveEnvironmentId(id)
              void store.saveWorkspaceMeta({ activeEnvironmentId: id ?? undefined })
            }}
          >
            <option value="">（未选择）</option>
            {store.environments.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </select>

          <div className="titleSm">快速创建环境</div>
          <div className="row">
            <input
              className="smallInput"
              placeholder="环境名称"
              value={envName}
              onChange={(e) => setEnvName(e.target.value)}
            />
            <button
              type="button"
              className="btn"
              onClick={() =>
                void store.upsertEnvironment({
                  id: newId(),
                  name: envName || 'env',
                  variables: [
                    {
                      id: newId(),
                      key: 'baseUrl',
                      value: 'https://httpbin.org',
                      enabled: true,
                    },
                  ],
                })
              }
            >
              保存环境
            </button>
          </div>

          <div className="titleSm">集合</div>
          <select
            className="smallInput"
            value={store.selectedCollectionId ?? ''}
            onChange={(e) => void store.selectCollection(e.target.value || null)}
          >
            <option value="">（未选择）</option>
            {store.collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="row">
            <input
              className="smallInput"
              placeholder="集合名称"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
            />
            <button
              type="button"
              className="btn primary"
              onClick={() => void store.saveCurrentAsCollection(collectionName)}
            >
              保存当前请求为集合
            </button>
          </div>
          <div className="row">
            <button
              type="button"
              className="btn"
              onClick={() => void store.runSelectedCollection(false)}
            >
              运行集合
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => void store.runSelectedCollection(true)}
            >
              运行（遇错即停）
            </button>
          </div>

          <div className="titleSm">导入 / 导出</div>
          <div className="row">
            <button type="button" className="btn" onClick={() => void store.exportWorkspace()}>
              导出工作区 JSON
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => importWsRef.current?.click()}
            >
              导入工作区
            </button>
            <input
              ref={importWsRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                const text = await f.text()
                await store.importWorkspace(text)
                e.target.value = ''
              }}
            />
          </div>
          <div className="row">
            <button
              type="button"
              className="btn"
              onClick={() => importPmRef.current?.click()}
            >
              导入 Postman Collection (v2.1)
            </button>
            <input
              ref={importPmRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                const text = await f.text()
                await store.importPostman(text)
                e.target.value = ''
              }}
            />
          </div>
        </div>

        <div className="sidebarHeader">历史</div>
        <div className="sidebarSection">
          {store.history.slice(0, 50).map((h) => (
            <button
              key={h.id}
              type="button"
              className="btn"
              style={{
                width: '100%',
                marginBottom: 6,
                textAlign: 'left',
                opacity: 0.95,
              }}
              onClick={() =>
                store.setDraftFull({
                  ...h.request,
                  tests: (h.request as { tests?: AssertionRule[] }).tests ?? [],
                })
              }
            >
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {new Date(h.createdAt).toLocaleString()}
              </div>
              <div className="mono" style={{ fontSize: 12 }}>
                {h.request.method} {h.request.url}
              </div>
            </button>
          ))}
        </div>
      </aside>

      <main className="main">
        <div className="toolbar">
          <input
            className="smallInput"
            style={{ width: 260 }}
            placeholder="请求名称"
            value={store.draft.name}
            onChange={(e) => store.setDraft({ name: e.target.value })}
          />
          <span className="pill">变量：{'{{name}}'}</span>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn" onClick={() => store.newDraft()}>
            新建请求
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={store.sending}
            onClick={() => void store.sendRequest()}
          >
            {store.sending ? '发送中…' : '发送'}
          </button>
        </div>

        <div className="row" style={{ padding: '10px 12px', gap: 10 }}>
          <select
            className="methodSelect smallInput"
            value={store.draft.method}
            onChange={(e) =>
              store.setDraft({ method: mapDraftMethod(e.target.value) })
            }
          >
            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            className="urlInput mono"
            value={store.draft.url}
            onChange={(e) => store.setDraft({ url: e.target.value })}
          />
        </div>

        <div className="tabs">
          {(
            [
              ['params', 'Params'],
              ['headers', 'Headers'],
              ['body', 'Body'],
              ['tests', 'Tests'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`tab ${store.requestTab === id ? 'active' : ''}`}
              onClick={() => store.setRequestTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="panel stack">
          {store.requestTab === 'params' && (
            <KeyValueEditor
              title="Query Params"
              rows={store.draft.params}
              onChange={(rows) => store.setDraft({ params: rows })}
            />
          )}
          {store.requestTab === 'headers' && (
            <KeyValueEditor
              title="Headers"
              rows={store.draft.headers}
              onChange={(rows) => store.setDraft({ headers: rows })}
            />
          )}
          {store.requestTab === 'body' && bodyPanel}
          {store.requestTab === 'tests' && testsPanel}
        </div>

        <div className="tabs">
          <button
            type="button"
            className={`tab ${store.responseTab === 'body' ? 'active' : ''}`}
            onClick={() => store.setResponseTab('body')}
          >
            Response
          </button>
          <button
            type="button"
            className={`tab ${store.responseTab === 'headers' ? 'active' : ''}`}
            onClick={() => store.setResponseTab('headers')}
          >
            Response Headers
          </button>
        </div>

        <div className="panel stack">
          {store.lastError && (
            <div style={{ color: 'var(--danger)' }} className="mono">
              {store.lastError}
            </div>
          )}
          {store.responseTab === 'body' && (
            <div className="stack">
              {store.lastResponse && (
                <div className="row">
                  <span className="pill">HTTP {store.lastResponse.status}</span>
                  <span className="pill">{store.lastResponse.durationMs} ms</span>
                  <span className="pill">{store.lastResponse.sizeBytes} bytes</span>
                </div>
              )}
              <pre className="mono" style={{ margin: 0 }}>
                {store.lastResponse?.bodyText ?? '（尚无响应）'}
              </pre>

              <div className="titleSm">集合运行报告（最近一次）</div>
              <pre className="mono" style={{ margin: 0 }}>
                {store.runReportJson ?? '（尚未运行）'}
              </pre>
            </div>
          )}
          {store.responseTab === 'headers' && (
            <pre className="mono" style={{ margin: 0 }}>
              {store.lastResponse
                ? JSON.stringify(store.lastResponse.headers, null, 2)
                : '（尚无响应）'}
            </pre>
          )}
        </div>

        <div className="tabs">
          <button type="button" className="tab active">
            Mock Server
          </button>
        </div>
        <div className="panel stack">
          <div className="row">
            <span className="pill">端口</span>
            <input
              className="smallInput"
              style={{ width: 120 }}
              type="number"
              value={store.mockPort}
              onChange={(e) => store.setMockPort(Number(e.target.value))}
            />
            <button type="button" className="btn primary" onClick={() => void store.startMock()}>
              启动 Mock
            </button>
            <button type="button" className="btn danger" onClick={() => void store.stopMock()}>
              停止 Mock
            </button>
          </div>
          <div className="hint">
            routes JSON 需匹配后端校验格式（method/path/status/body/headers/delayMs）。
          </div>
          <textarea
            className="smallInput mono"
            style={{ minHeight: 220, width: '100%' }}
            value={store.mockRoutesJson}
            onChange={(e) => store.setMockRoutesJson(e.target.value)}
          />
        </div>
      </main>
    </div>
  )
}
