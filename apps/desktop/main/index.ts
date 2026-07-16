import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

if (!app.isPackaged) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
  app.commandLine.appendSwitch('remote-allow-origins', '*')
}
import {
  appCloseRequestedChannel,
  httpStreamPushChannel,
  ipcChannels,
  mockStartSchema,
  sendHttpRequestSchema,
  sendHttpStreamRequestSchema,
} from '@api-tester/shared'
import type { Collection, Environment, RequestWithTests, WorkspaceMeta } from '@api-tester/shared'
import { sendRequest, sendRequestStream } from '@api-tester/http-client'
import { openDatabase, tryParseWorkspaceBundle, WorkspaceStore } from '@api-tester/storage'
import { importPostmanCollectionV21, runCollection } from '@api-tester/domain'
import { resolveRequestForSend } from '@api-tester/domain/pre-request-script'
import { MockServerController } from '@api-tester/mock-server'
import { setupAutoUpdater } from './updater'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Portable / NSIS layout: `<parent>/API-Tester/app/<exe>` + `<parent>/API-Tester/data` (updates only touch `app/`). */
const LAYOUT_ROOT_DIR = 'API-Tester'
const LAYOUT_APP_DIR = 'app'
const LAYOUT_DATA_DIR = 'data'

/** Workspace root: SQLite + Electron Chromium profile (otherwise Electron creates %APPDATA%\<name>). */
function resolveWorkspaceDataRoot(): string {
  const override = process.env.API_TESTER_DATA_DIR?.trim()
  if (override) return path.resolve(override)
  if (!app.isPackaged) {
    return path.join(app.getAppPath(), 'api-tester-data')
  }
  const exeDir = path.dirname(app.getPath('exe'))
  const legacyDir = path.join(exeDir, 'api-tester-data')
  if (path.basename(exeDir).toLowerCase() !== LAYOUT_APP_DIR.toLowerCase()) {
    return legacyDir
  }
  const layoutRoot = path.dirname(exeDir)
  if (path.basename(layoutRoot).toLowerCase() !== LAYOUT_ROOT_DIR.toLowerCase()) {
    return legacyDir
  }
  return path.join(layoutRoot, LAYOUT_DATA_DIR)
}

// Must run before ready — otherwise Roaming keeps getting a folder for caches / storage.
const workspaceDataRoot = resolveWorkspaceDataRoot()
app.setPath('userData', workspaceDataRoot)
// Remote debugging writes DevToolsActivePort under userData before whenReady / openDatabase mkdir.
fs.mkdirSync(workspaceDataRoot, { recursive: true })

let mainWindow: BrowserWindow | null = null
/** When false, the renderer handles close (unsaved prompt); renderer invokes `appFinishClose` to allow quit. */
let allowMainWindowClose = false
let store: WorkspaceStore | null = null
const mockCtl = new MockServerController()

const RESPONSE_DOWNLOAD_TTL_MS = 30 * 60_000
const RESPONSE_DOWNLOAD_MAX_ENTRIES = 20
const responseDownloads = new Map<string, { bytes: Uint8Array; createdAt: number }>()

async function resolveSystemProxy(url: string): Promise<string | null> {
  const decision = await session.defaultSession.resolveProxy(url)
  let unsupportedSocks = false
  for (const entry of decision.split(';')) {
    const [kindRaw, endpoint] = entry.trim().split(/\s+/, 2)
    const kind = kindRaw.toUpperCase()
    if (kind === 'DIRECT') return null
    if ((kind === 'PROXY' || kind === 'HTTP') && endpoint) return `http://${endpoint}`
    if (kind === 'HTTPS' && endpoint) return `https://${endpoint}`
    if (kind.startsWith('SOCKS')) {
      unsupportedSocks = true
    }
  }
  if (unsupportedSocks) {
    throw new Error('The system selected a SOCKS-only proxy, which is not supported yet')
  }
  throw new Error(`Could not resolve a supported system proxy (${decision || 'empty result'})`)
}

const desktopSendOptions = { resolveSystemProxy }

function exposeResponseDownload(result: Awaited<ReturnType<typeof sendRequest>>) {
  const { rawBody, ...rendererResult } = result
  if (!rawBody) return rendererResult

  const now = Date.now()
  for (const [id, item] of responseDownloads) {
    if (now - item.createdAt > RESPONSE_DOWNLOAD_TTL_MS) responseDownloads.delete(id)
  }
  while (responseDownloads.size >= RESPONSE_DOWNLOAD_MAX_ENTRIES) {
    const oldestId = responseDownloads.keys().next().value as string | undefined
    if (!oldestId) break
    responseDownloads.delete(oldestId)
  }

  const downloadId = randomUUID()
  responseDownloads.set(downloadId, { bytes: rawBody, createdAt: now })
  return {
    ...rendererResult,
    response: { ...rendererResult.response, downloadId },
  }
}

function safeSuggestedFileName(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  const base = path.basename(raw || 'response.bin').replace(/[<>:"/\\|?*]/g, '_')
  const cleaned = Array.from(base, (char) => (char.charCodeAt(0) < 32 ? '_' : char)).join('')
  return cleaned && cleaned !== '.' ? cleaned : 'response.bin'
}

/** Prefer path next to main bundle; fall back to package `out/preload` (pnpm / cwd quirks). */
function resolvePreloadPath(): string {
  const names = ['index.mjs', 'index.js', 'index.cjs'] as const
  const dirs = [
    path.join(__dirname, '..', 'preload'),
    path.join(app.getAppPath(), 'out', 'preload'),
  ]
  const tried: string[] = []
  for (const dir of dirs) {
    for (const name of names) {
      const full = path.join(dir, name)
      tried.push(full)
      if (fs.existsSync(full)) return full
    }
  }
  console.error('[main] Preload not found; window.apiTester will be missing. Checked:\n', tried.join('\n'))
  return path.join(__dirname, '..', 'preload', 'index.mjs')
}

function createWindow(): void {
  const preload = resolvePreloadPath()
  console.info('[main] Preload script:', preload)
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    autoHideMenuBar: true,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox + native ipc/preload is flaky on some Windows/dev setups; keeps preload exposing apiTester
      sandbox: false,
      /** API 表单多为 URL/JSON/Header 名等非自然语言，关闭内置拼写检查以避免红色波浪线 */
      spellcheck: false,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.setMenu(null)

  allowMainWindowClose = false
  mainWindow.on('close', (e) => {
    if (allowMainWindowClose) return
    e.preventDefault()
    mainWindow?.webContents.send(appCloseRequestedChannel)
  })
  mainWindow.on('closed', () => {
    allowMainWindowClose = false
    mainWindow = null
  })
}

app.whenReady().then(() => {
  const dbPath = resolveWorkspaceDataRoot()
  console.info('[main] Workspace data directory:', dbPath)
  const db = openDatabase(dbPath)
  store = new WorkspaceStore(db)

  ipcMain.handle(ipcChannels.dbHealth, async () => ({ ok: true }))

  ipcMain.handle(ipcChannels.sendHttp, async (_e, payload: unknown) => {
    const parsed = sendHttpRequestSchema.safeParse(payload)
    if (!parsed.success) throw new Error('Invalid request payload')
    const { request } = parsed.data
    const vars = { ...(parsed.data.environmentVariables ?? {}) }
    const prep = resolveRequestForSend(request, vars)
    if (!prep.ok) {
      return {
        response: {
          status: 0,
          statusText: 'Pre-request Error',
          headers: {},
          bodyText: '',
          durationMs: 0,
          sizeBytes: 0,
        },
        error: prep.error,
      }
    }
    const result = await sendRequest(prep.request, desktopSendOptions)
    return exposeResponseDownload(result)
  })

  ipcMain.handle(ipcChannels.sendHttpStream, async (event, payload: unknown) => {
    const parsed = sendHttpStreamRequestSchema.safeParse(payload)
    if (!parsed.success) throw new Error('Invalid stream request payload')
    const { request, streamSessionId } = parsed.data
    const vars = { ...(parsed.data.environmentVariables ?? {}) }
    const wc = event.sender

    const prep = resolveRequestForSend(request, vars)
    if (!prep.ok) {
      return { ok: false as const, error: prep.error }
    }

    const result = await sendRequestStream(
      prep.request,
      {
        onHeaders: (info) =>
          wc.send(httpStreamPushChannel, {
            streamSessionId,
            phase: 'headers',
            ...info,
          }),
        onChunk: (text) =>
          wc.send(httpStreamPushChannel, {
            streamSessionId,
            phase: 'chunk',
            text,
          }),
      },
      desktopSendOptions
    )

    if (result.error) {
      return { ok: false as const, error: result.error }
    }

    const exposed = exposeResponseDownload(result)
    return { ok: true as const, response: exposed.response }
  })

  ipcMain.handle(ipcChannels.saveResponseBody, async (event, payload: unknown) => {
    const args = payload as { downloadId?: unknown; suggestedName?: unknown } | null
    if (!args || typeof args.downloadId !== 'string') {
      return { ok: false as const, error: 'Invalid download request' }
    }
    const cached = responseDownloads.get(args.downloadId)
    if (!cached || Date.now() - cached.createdAt > RESPONSE_DOWNLOAD_TTL_MS) {
      responseDownloads.delete(args.downloadId)
      return { ok: false as const, error: 'Response data expired; send the request again.' }
    }

    const owner = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.SaveDialogOptions = {
      title: 'Save response',
      defaultPath: safeSuggestedFileName(args.suggestedName),
      properties: ['createDirectory', 'showOverwriteConfirmation'],
    }
    const choice = owner
      ? await dialog.showSaveDialog(owner, options)
      : await dialog.showSaveDialog(options)
    if (choice.canceled || !choice.filePath) {
      return { ok: true as const, canceled: true }
    }
    await fs.promises.writeFile(choice.filePath, cached.bytes)
    return { ok: true as const, canceled: false, filePath: choice.filePath }
  })

  ipcMain.handle(ipcChannels.historyList, async () => store!.listHistory())
  ipcMain.handle(ipcChannels.historyAdd, async (_e, entry: unknown) => {
    store!.addHistory(entry as Parameters<WorkspaceStore['addHistory']>[0])
    return { ok: true }
  })

  ipcMain.handle(ipcChannels.workspaceGet, async () => store!.getWorkspaceMeta())
  ipcMain.handle(ipcChannels.workspaceSaveMeta, async (_e, meta: unknown) => {
    store!.saveWorkspaceMeta(
      meta as Partial<
        Pick<WorkspaceMeta, 'name' | 'activeEnvironmentId' | 'mockPort' | 'editorTabState'>
      >
    )
    return { ok: true }
  })

  ipcMain.handle(ipcChannels.appFinishClose, async () => {
    const win = mainWindow
    if (!win || win.isDestroyed()) return { ok: false as const }
    allowMainWindowClose = true
    win.close()
    return { ok: true as const }
  })

  ipcMain.handle(ipcChannels.themeGet, async () => store!.getThemeId() ?? null)
  ipcMain.handle(ipcChannels.themeSet, async (_e, themeId: unknown) => {
    if (typeof themeId !== 'string' || !themeId.trim()) throw new Error('Invalid theme id')
    store!.setThemeId(themeId.trim())
    return { ok: true }
  })

  ipcMain.handle(ipcChannels.collectionsList, async () => store!.listCollections())
  ipcMain.handle(ipcChannels.collectionsGetAll, async () => store!.getAllCollections())
  ipcMain.handle(ipcChannels.collectionsSaveAll, async (_e, cols: unknown) => {
    store!.saveAllCollections(cols as Collection[])
    return { ok: true }
  })
  ipcMain.handle(ipcChannels.collectionGet, async (_e, id: string) => store!.getCollection(id))
  ipcMain.handle(ipcChannels.collectionSave, async (_e, col: unknown) => {
    store!.saveCollection(col as Collection)
    return { ok: true }
  })
  ipcMain.handle(ipcChannels.collectionDelete, async (_e, id: string) => {
    store!.deleteCollection(id)
    return { ok: true }
  })

  ipcMain.handle(ipcChannels.environmentsList, async () => store!.listEnvironments())
  ipcMain.handle(ipcChannels.environmentSave, async (_e, env: unknown) => {
    store!.saveEnvironment(env as Environment)
    return { ok: true }
  })
  ipcMain.handle(ipcChannels.environmentDelete, async (_e, id: string) => {
    store!.deleteEnvironment(id)
    return { ok: true }
  })

  ipcMain.handle(
    ipcChannels.runCollection,
    async (
      _e,
      args: { collectionId: string; environmentId?: string; stopOnFailure?: boolean }
    ) => {
      const col = store!.getCollection(args.collectionId)
      if (!col) throw new Error('Collection not found')
      const envs = store!.listEnvironments()
      const activeEnv = args.environmentId
        ? envs.find((e) => e.id === args.environmentId)
        : envs.find((e) => e.id === store!.getWorkspaceMeta().activeEnvironmentId)
      const globalEnv = envs.find((e) => e.name.toLowerCase() === 'global')

      const stopOnFailure = args.stopOnFailure ?? false
      const startedAt = Date.now()
      const items = await runCollection({
        collection: col,
        globalVars: globalEnv,
        activeEnv,
        stopOnFailure,
        prepareRequest: (req, vars) => resolveRequestForSend(req, vars),
        execute: async (req: RequestWithTests) => {
          const out = await sendRequest(req, desktopSendOptions)
          if (out.error) {
            return {
              status: 0,
              headers: {},
              bodyText: '',
              durationMs: out.response.durationMs,
              error: out.error,
            }
          }
          const norm: Record<string, string> = {}
          for (const [k, v] of Object.entries(out.response.headers)) {
            norm[k.toLowerCase()] = v
          }
          return {
            status: out.response.status,
            headers: norm,
            bodyText: out.response.bodyText,
            durationMs: out.response.durationMs,
          }
        },
      })
      return {
        id: crypto.randomUUID(),
        startedAt,
        finishedAt: Date.now(),
        items,
      }
    }
  )

  ipcMain.handle(ipcChannels.mockStart, async (_e, payload: unknown) => {
    const parsed = mockStartSchema.safeParse(payload)
    if (!parsed.success) throw new Error('Invalid mock payload')
    await mockCtl.start(parsed.data.port, parsed.data.routes)
    return { port: mockCtl.listenPort }
  })
  ipcMain.handle(ipcChannels.mockStop, async () => {
    await mockCtl.stop()
    return { ok: true }
  })
  ipcMain.handle(ipcChannels.mockStatus, async () => ({
    running: mockCtl.running,
    port: mockCtl.listenPort,
  }))

  ipcMain.handle(ipcChannels.exportWorkspace, async () => store!.exportBundleJson())

  ipcMain.handle(ipcChannels.importWorkspace, async (_e, jsonText: string) => {
    const parsed = tryParseWorkspaceBundle(jsonText)
    if (!parsed) throw new Error('Invalid workspace backup JSON')
    store!.importBundle({
      meta: parsed.meta ?? store!.getWorkspaceMeta(),
      environments: parsed.environments,
      collections: parsed.collections,
    })
    return { ok: true }
  })

  ipcMain.handle(ipcChannels.importWorkspaceMerge, async (_e, jsonText: string) => {
    const parsed = tryParseWorkspaceBundle(jsonText)
    if (!parsed) throw new Error('Not an api-tester workspace export JSON')
    const summary = store!.mergeImportBundle({
      collections: parsed.collections,
      environments: parsed.environments,
    })
    return { ok: true as const, ...summary }
  })

  ipcMain.handle(ipcChannels.importPostman, async (_e, jsonText: string) => {
    const parsed = JSON.parse(jsonText) as unknown
    const col = importPostmanCollectionV21(parsed)
    if (!col) throw new Error('Unsupported Postman collection format')
    store!.saveCollection(col)
    return { id: col.id }
  })

  createWindow()
  setupAutoUpdater(() => mainWindow, {
    prepareForInstall: async () => {
      await mockCtl.stop()
      store?.close()
      store = null
    },
  })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  store?.close()
  store = null
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('web-contents-created', (_event, contents) => {
  contents.on('preload-error', (_e, preloadPath, err) => {
    console.error('[main] preload-error', preloadPath, err)
  })
  contents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })
})
