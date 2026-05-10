import { app, BrowserWindow, ipcMain } from 'electron'
import electronUpdater from 'electron-updater'
import path from 'node:path'
import { ipcChannels, updaterPushChannel, type UpdaterPushPayload } from '@api-tester/shared'

const { autoUpdater } = electronUpdater

type NsisAutoUpdater = typeof autoUpdater & { installDirectory?: string }

export function setupAutoUpdater(
  getWindow: () => BrowserWindow | null,
  options?: { prepareForInstall?: () => void | Promise<void> }
): void {
  function push(payload: UpdaterPushPayload): void {
    const w = getWindow()
    try {
      w?.webContents.send(updaterPushChannel, payload)
    } catch {
      /* window destroyed */
    }
  }

  function formatReleaseNotes(raw: unknown): string | undefined {
    if (raw == null) return undefined
    if (typeof raw === 'string') return raw.trim() || undefined
    if (Array.isArray(raw)) {
      const lines = raw
        .map((x) => {
          if (typeof x === 'object' && x !== null && 'note' in x) {
            const n = (x as { note?: string }).note
            return typeof n === 'string' ? n : ''
          }
          return ''
        })
        .filter(Boolean)
      const s = lines.join('\n').trim()
      return s || undefined
    }
    return undefined
  }

  if (!app.isPackaged) {
    ipcMain.handle(ipcChannels.updaterCheck, async () => ({ ok: false as const, reason: 'dev' }))
    ipcMain.handle(ipcChannels.updaterDownload, async () => ({ ok: false as const, reason: 'dev' }))
    ipcMain.handle(ipcChannels.updaterQuitAndInstall, async () => ({ ok: false as const, reason: 'dev' }))
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.allowPrerelease = false

  // NSIS: pass /D=<real install dir>. Otherwise our preInit writes InstallLocation=$EXEDIR; during
  // auto-update EXEDIR is the temp folder for the downloaded Setup exe and the installer targets the wrong path.
  if (process.platform === 'win32') {
    ;(autoUpdater as NsisAutoUpdater).installDirectory = path.dirname(app.getPath('exe'))
  }

  autoUpdater.on('checking-for-update', () => push({ type: 'checking' }))
  autoUpdater.on('update-not-available', () => push({ type: 'not-available' }))
  autoUpdater.on('update-available', (info) => {
    push({
      type: 'available',
      version: info.version,
      releaseNotes: formatReleaseNotes(info.releaseNotes),
    })
  })
  autoUpdater.on('download-progress', (p) => {
    push({
      type: 'download-progress',
      percent: p.percent,
      transferred: p.transferred,
      total: p.total,
    })
  })
  autoUpdater.on('update-downloaded', (info) => {
    push({ type: 'downloaded', version: info.version })
  })
  autoUpdater.on('error', (err) => {
    push({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  })

  ipcMain.handle(ipcChannels.updaterCheck, async () => {
    try {
      await autoUpdater.checkForUpdates()
      return { ok: true as const }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      push({ type: 'error', message })
      return { ok: false as const, message }
    }
  })

  ipcMain.handle(ipcChannels.updaterDownload, async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { ok: true as const }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      push({ type: 'error', message })
      return { ok: false as const, message }
    }
  })

  ipcMain.handle(ipcChannels.updaterQuitAndInstall, async () => {
    if (process.platform === 'win32') {
      app.removeAllListeners('window-all-closed')
    }
    for (const w of BrowserWindow.getAllWindows()) {
      w.removeAllListeners('close')
      w.destroy()
    }
    try {
      await options?.prepareForInstall?.()
    } catch {
      /* still attempt install */
    }
    setImmediate(() => {
      setTimeout(() => autoUpdater.quitAndInstall(false, true), 450)
    })
    return { ok: true as const }
  })

  setTimeout(() => {
    if (!getWindow()) return
    void autoUpdater.checkForUpdates().catch((e) => {
      const message = e instanceof Error ? e.message : String(e)
      push({ type: 'error', message })
    })
  }, 8_000)
}
