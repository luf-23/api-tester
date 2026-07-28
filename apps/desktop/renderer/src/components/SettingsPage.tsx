import { useEffect, useRef, useState } from 'react'
import type { AppInfo, AppSettings, RequestSendSettings } from '@api-tester/shared'
import { ThemeCard } from './ThemeCard'
import { ConfirmDialog } from './ConfirmDialog'
import {
  IconClose,
  IconCopy,
  IconExport,
  IconEye,
  IconGlobe,
  IconImport,
  IconRefresh,
  IconRouting,
  IconSettings,
  IconTrash,
  IconWorkspace,
} from './icons'
import { useSettingsStore } from '../store/settings'
import { useThemeStore } from '../store/theme'

type SectionId = 'general' | 'appearance' | 'request' | 'data' | 'updates'
type PendingConfirm =
  | { kind: 'reset' }
  | { kind: 'replace'; file: File }
  | { kind: 'history' }

const SECTIONS = [
  { id: 'general' as const, label: '通用', icon: IconSettings },
  { id: 'appearance' as const, label: '外观', icon: IconEye },
  { id: 'request' as const, label: '请求与网络', icon: IconRouting },
  { id: 'data' as const, label: '数据与存储', icon: IconWorkspace },
  { id: 'updates' as const, label: '更新与关于', icon: IconRefresh },
]

const REPOSITORY_URL = 'https://github.com/luf-23/api-tester'
const RELEASES_URL = 'https://github.com/luf-23/api-tester/releases'

function downloadJson(text: string): void {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `jadeapi-workspace-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  hint: string
}) {
  return (
    <label className="settings-switch">
      <span className="settings-switch__copy">
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="settings-switch__control" aria-hidden />
    </label>
  )
}

export function SettingsPage({ onClose }: { onClose: () => void }) {
  const [section, setSection] = useState<SectionId>('general')
  const settings = useSettingsStore((s) => s.settings)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null)
  const importInput = useRef<HTMLInputElement>(null)
  const importMode = useRef<'replace' | 'merge'>('replace')

  useEffect(() => {
    void window.apiTester.appInfo().then(setAppInfo)
  }, [])

  const showMessage = (value: string) => {
    setMessage(value)
    window.setTimeout(() => setMessage(null), 3200)
  }

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      showMessage(`${label}已复制`)
    } catch {
      showMessage(`无法复制${label}`)
    }
  }

  const persist = async (next: AppSettings) => {
    useSettingsStore.getState().load(next)
    try {
      await window.apiTester.settingsSet(next)
    } catch {
      showMessage('设置保存失败')
    }
  }

  const patchSettings = (partial: Partial<AppSettings>) => {
    const next = useSettingsStore.getState().update(partial)
    void persist(next)
  }

  const patchRequestDefaults = (partial: Partial<RequestSendSettings>) => {
    const next = useSettingsStore.getState().updateRequestDefaults(partial)
    void persist(next)
  }

  const resetSettings = async () => {
    setBusy('reset')
    try {
      const next = await window.apiTester.settingsReset()
      useSettingsStore.getState().load(next)
      useThemeStore.getState().setTheme(next.themeId)
      showMessage('已恢复默认设置')
    } finally {
      setBusy(null)
    }
  }

  const exportWorkspace = async () => {
    setBusy('export')
    try {
      downloadJson(await window.apiTester.exportWorkspace())
      showMessage('工作区备份已导出')
    } catch {
      showMessage('导出失败')
    } finally {
      setBusy(null)
    }
  }

  const chooseImport = (mode: 'replace' | 'merge') => {
    importMode.current = mode
    importInput.current?.click()
  }

  const importWorkspace = async (file: File) => {
    const mode = importMode.current
    if (mode === 'replace') {
      setPendingConfirm({ kind: 'replace', file })
      return
    }
    setBusy('merge')
    try {
      const text = await file.text()
      const result = await window.apiTester.importWorkspaceMerge(text)
      showMessage(
        `已合并 ${result.importedCollections} 个集合、${result.importedEnvironments} 个环境`
      )
      window.location.reload()
    } catch {
      showMessage('导入失败：文件格式无效或内容不兼容')
    } finally {
      setBusy(null)
      if (importInput.current) importInput.current.value = ''
    }
  }

  const replaceWorkspace = async (file: File) => {
    setBusy('replace')
    try {
      await window.apiTester.importWorkspace(await file.text())
      window.location.reload()
    } catch {
      showMessage('恢复失败：文件格式无效或内容不兼容')
      throw new Error('restore-failed')
    } finally {
      setBusy(null)
      if (importInput.current) importInput.current.value = ''
    }
  }

  const clearHistory = async () => {
    setBusy('history')
    try {
      await window.apiTester.historyClear()
      showMessage('请求历史已清空')
    } finally {
      setBusy(null)
    }
  }

  const requestDefaults = settings.requestDefaults

  return (
    <section className="settings-page" aria-label="应用设置">
      <aside className="settings-nav">
        <div className="settings-nav__title">
          <IconSettings />
          <span>设置</span>
        </div>
        <nav>
          {SECTIONS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                className={section === item.id ? 'is-active' : ''}
                onClick={() => setSection(item.id)}
              >
                <Icon />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
        <button
          type="button"
          className="settings-nav__reset"
          onClick={() => setPendingConfirm({ kind: 'reset' })}
          disabled={busy === 'reset'}
        >
          <IconRefresh />
          恢复默认设置
        </button>
      </aside>

      <div className="settings-content">
        <header className="settings-content__header">
          <div>
            <p>JADEAPI STUDIO</p>
            <h1>{SECTIONS.find((item) => item.id === section)?.label}</h1>
          </div>
          <button
            type="button"
            className="icon-btn settings-content__close"
            aria-label="关闭设置"
            title="关闭设置"
            onClick={onClose}
          >
            <IconClose width={14} height={14} />
          </button>
        </header>

        <div className="settings-content__body">
          {section === 'general' && (
            <>
              <SettingsGroup title="启动与工作区" description="控制应用启动后的基础行为。">
                <div className="settings-info-row">
                  <div>
                    <strong>恢复编辑标签页</strong>
                    <small>应用会自动恢复上次打开的请求标签页和活动标签。</small>
                  </div>
                  <span className="settings-badge">已启用</span>
                </div>
              </SettingsGroup>
              <SettingsGroup title="设置管理" description="设置保存在本机，不会上传到云端。">
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => setPendingConfirm({ kind: 'reset' })}
                >
                  <IconRefresh /> 恢复全部默认设置
                </button>
              </SettingsGroup>
            </>
          )}

          {section === 'appearance' && (
            <SettingsGroup title="主题" description="选择应用界面的配色方案，修改后立即生效。">
              <ThemeCard
                onChange={(themeId) => {
                  patchSettings({ themeId })
                }}
              />
            </SettingsGroup>
          )}

          {section === 'request' && (
            <>
              <SettingsGroup
                title="请求限制"
                description="以下值会应用于之后新建的请求，单个请求仍可在其 Settings 页覆盖。"
              >
                <div className="settings-grid">
                  <label className="settings-field">
                    <span>请求超时</span>
                    <div>
                      <input
                        type="number"
                        min={0}
                        max={3600}
                        value={Math.round(requestDefaults.timeoutMs / 1000)}
                        onChange={(e) => {
                          const seconds = Math.max(0, Math.min(3600, Number(e.target.value) || 0))
                          patchRequestDefaults({ timeoutMs: seconds * 1000 })
                        }}
                      />
                      <em>秒</em>
                    </div>
                    <small>0 表示不限制请求时间。</small>
                  </label>
                  <label className="settings-field">
                    <span>最大重定向次数</span>
                    <div>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={requestDefaults.maxRedirects}
                        onChange={(e) => {
                          const value = Math.max(0, Math.min(100, Number(e.target.value) || 0))
                          patchRequestDefaults({ maxRedirects: value })
                        }}
                      />
                      <em>次</em>
                    </div>
                    <small>0 表示不跟随重定向。</small>
                  </label>
                </div>
              </SettingsGroup>
              <SettingsGroup title="代理" description="系统代理会遵循操作系统及 PAC 配置。">
                <div className="settings-choice-row">
                  {[
                    ['system', '使用系统代理'],
                    ['direct', '直接连接'],
                    ['custom', '自定义代理'],
                  ].map(([value, label]) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="default-proxy"
                        checked={(requestDefaults.proxyMode ?? 'system') === value}
                        onChange={() => patchRequestDefaults({ proxyMode: value as RequestSendSettings['proxyMode'] })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                {(requestDefaults.proxyMode ?? 'system') === 'custom' && (
                  <label className="settings-field settings-field--wide">
                    <span>代理 URL</span>
                    <input
                      type="text"
                      value={requestDefaults.proxyUrl ?? ''}
                      placeholder="http://host:port"
                      onChange={(e) => patchRequestDefaults({ proxyUrl: e.target.value })}
                    />
                    <small>支持 HTTP(S) 代理。凭据如写入 URL，会随本机设置保存。</small>
                  </label>
                )}
              </SettingsGroup>
              <SettingsGroup title="安全与响应" description="用于控制证书校验和响应接收方式。">
                <Switch
                  checked={requestDefaults.validateTls}
                  onChange={(validateTls) => patchRequestDefaults({ validateTls })}
                  label="验证 TLS 证书"
                  hint="仅在调试自签名证书服务时关闭。"
                />
                <Switch
                  checked={requestDefaults.streamResponse !== false}
                  onChange={(streamResponse) => patchRequestDefaults({ streamResponse })}
                  label="流式接收响应"
                  hint="适用于 SSE 和分块响应；关闭后等待完整响应再展示。"
                />
              </SettingsGroup>
            </>
          )}

          {section === 'data' && (
            <>
              <SettingsGroup title="本地数据目录" description="工作区、历史和应用设置均保存在此目录。">
                <div className="settings-path">
                  <code>{appInfo?.dataDirectory ?? '正在读取…'}</code>
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() => void window.apiTester.appShowDataDirectory()}
                  >
                    打开目录
                  </button>
                </div>
              </SettingsGroup>
              <SettingsGroup title="备份与恢复" description="备份包含集合、环境、工作区元数据和请求历史。">
                <div className="settings-actions">
                  <button type="button" className="btn" onClick={exportWorkspace} disabled={busy === 'export'}>
                    <IconExport /> 导出完整备份
                  </button>
                  <button type="button" className="btn" onClick={() => chooseImport('replace')}>
                    <IconImport /> 覆盖恢复
                  </button>
                  <button type="button" className="btn" onClick={() => chooseImport('merge')}>
                    <IconImport /> 合并导入
                  </button>
                </div>
                <input
                  ref={importInput}
                  hidden
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void importWorkspace(file)
                  }}
                />
              </SettingsGroup>
              <SettingsGroup title="请求历史" description="清理历史不会删除集合中的请求。">
                <button
                  type="button"
                  className="btn settings-danger"
                  onClick={() => setPendingConfirm({ kind: 'history' })}
                >
                  <IconTrash /> 清空请求历史
                </button>
              </SettingsGroup>
            </>
          )}

          {section === 'updates' && (
            <>
              <SettingsGroup title="应用更新" description="发布版本通过 GitHub Releases 获取。">
                <Switch
                  checked={settings.autoCheckUpdates}
                  onChange={(autoCheckUpdates) => patchSettings({ autoCheckUpdates })}
                  label="启动后自动检查更新"
                  hint="仅检查稳定版本，不会在未确认时自动安装。"
                />
                <button
                  type="button"
                  className="btn btn--sm settings-check-update"
                  onClick={async () => {
                    setBusy('update')
                    const result = await window.apiTester.updaterCheck()
                    setBusy(null)
                    showMessage(result.ok ? '正在检查更新' : result.reason === 'dev' ? '开发模式下不可检查更新' : '检查更新失败')
                  }}
                  disabled={busy === 'update'}
                >
                  <IconRefresh /> {busy === 'update' ? '检查中…' : '立即检查更新'}
                </button>
              </SettingsGroup>
              <SettingsGroup title="关于 JadeAPI Studio" description="轻量、本地优先的桌面 API 测试工具。">
                <div className="settings-about">
                  <p className="settings-about__intro">
                    JadeAPI Studio 由 <strong>luf-23</strong> 创建并维护，致力于提供轻量、
                    本地优先、专注核心工作流的桌面 API 测试体验。
                  </p>

                  <div className="settings-about__meta">
                    <span>当前版本</span>
                    <strong>{appInfo?.version ?? '—'}</strong>
                    <span>运行模式</span>
                    <strong>{appInfo?.isPackaged ? '正式版本' : '开发模式'}</strong>
                  </div>

                  <div className="settings-about__links">
                    <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
                      <IconGlobe />
                      <span>
                        <strong>源代码仓库</strong>
                        <small>{REPOSITORY_URL}</small>
                      </span>
                      <em>↗</em>
                    </a>
                    <a href={RELEASES_URL} target="_blank" rel="noreferrer">
                      <IconRefresh />
                      <span>
                        <strong>发行版本列表</strong>
                        <small>{RELEASES_URL}</small>
                      </span>
                      <em>↗</em>
                    </a>
                  </div>

                  <div className="settings-about__contacts">
                    <ContactRow
                      label="邮箱"
                      value="luf-23@foxmail.com"
                      onCopy={() => void copyText('邮箱', 'luf-23@foxmail.com')}
                    />
                    <ContactRow
                      label="QQ"
                      value="3162794813"
                      onCopy={() => void copyText('QQ', '3162794813')}
                    />
                  </div>
                </div>
              </SettingsGroup>
            </>
          )}
        </div>
      </div>
      {message && <div className="settings-toast">{message}</div>}
      <ConfirmDialog
        open={pendingConfirm !== null}
        title={
          pendingConfirm?.kind === 'reset'
            ? '恢复默认设置'
            : pendingConfirm?.kind === 'replace'
              ? '覆盖恢复工作区'
              : '清空请求历史'
        }
        body={
          pendingConfirm?.kind === 'reset'
            ? '确定恢复全部应用设置吗？工作区数据不会被删除。'
            : pendingConfirm?.kind === 'replace'
              ? '当前集合、环境和请求历史将被备份文件替换。此操作不可撤销。'
              : '确定清空全部请求历史吗？集合中的请求不会受到影响。'
        }
        confirmLabel={
          pendingConfirm?.kind === 'reset'
            ? '恢复默认'
            : pendingConfirm?.kind === 'replace'
              ? '覆盖恢复'
              : '清空历史'
        }
        danger={pendingConfirm?.kind === 'replace' || pendingConfirm?.kind === 'history'}
        onCancel={() => {
          setPendingConfirm(null)
          if (importInput.current) importInput.current.value = ''
        }}
        onConfirm={async () => {
          const pending = pendingConfirm
          if (!pending) return
          if (pending.kind === 'reset') await resetSettings()
          else if (pending.kind === 'replace') await replaceWorkspace(pending.file)
          else await clearHistory()
        }}
      />
    </section>
  )
}

function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="settings-group">
      <header>
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      <div className="settings-group__body">{children}</div>
    </section>
  )
}

function ContactRow({
  label,
  value,
  onCopy,
}: {
  label: string
  value: string
  onCopy: () => void
}) {
  return (
    <div className="settings-contact">
      <span>{label}</span>
      <code>{value}</code>
      <button type="button" aria-label={`复制${label}`} title={`复制${label}`} onClick={onCopy}>
        <IconCopy />
      </button>
    </div>
  )
}
