import type {
  AppSettings,
  Collection,
  Environment,
  HistoryEntry,
  WorkspaceMeta,
} from '@api-tester/shared'
import { defaultAppSettings } from '@api-tester/shared'
import type { StorageContext } from './db'
import {
  allocateUniqueDisplayName,
  remapCollectionIds,
  remapEnvironmentIds,
  stringifyWorkspaceBundle,
} from './workspace-bundle'

const THEME_KEY = 'theme_id'
const APP_SETTINGS_KEY = 'app_settings_v1'
const DEFAULT_WS_ID = 'default'

export class WorkspaceStore {
  constructor(private readonly ctx: StorageContext) {
    this.ensureDefaultWorkspace()
  }

  close(): void {
    this.ctx.db.close()
  }

  private ensureDefaultWorkspace(): void {
    const meta = this.readMeta()
    if (!meta?.id) {
      this.writeMetaRow({ id: DEFAULT_WS_ID, name: 'Default' })
    }
  }

  private readMeta(): WorkspaceMeta {
    const row = this.ctx.db.prepare(`SELECT json FROM workspace_meta LIMIT 1`).get() as
      | { json: string }
      | undefined
    if (!row) return { id: DEFAULT_WS_ID, name: 'Default' }
    try {
      const m = JSON.parse(row.json) as WorkspaceMeta
      return m?.id ? m : { id: DEFAULT_WS_ID, name: 'Default' }
    } catch {
      return { id: DEFAULT_WS_ID, name: 'Default' }
    }
  }

  private writeMetaRow(meta: WorkspaceMeta): void {
    this.ctx.db.prepare(`DELETE FROM workspace_meta`).run()
    this.ctx.db.prepare(`INSERT INTO workspace_meta (id, json) VALUES (?, ?)`).run(
      meta.id,
      JSON.stringify(meta)
    )
  }

  getThemeId(): string | undefined {
    return this.getAppSettings().themeId
  }

  getAppSettings(): AppSettings {
    const defaults = defaultAppSettings()
    const settingsRow = this.ctx.db
      .prepare(`SELECT value FROM kv_settings WHERE key = ?`)
      .get(APP_SETTINGS_KEY) as { value: string } | undefined
    if (settingsRow?.value) {
      try {
        const saved = JSON.parse(settingsRow.value) as Partial<AppSettings>
        return {
          ...defaults,
          ...saved,
          requestDefaults: {
            ...defaults.requestDefaults,
            ...(saved.requestDefaults ?? {}),
          },
        }
      } catch {
        // Fall through to the legacy theme preference.
      }
    }

    const legacyTheme = this.ctx.db
      .prepare(`SELECT value FROM kv_settings WHERE key = ?`)
      .get(THEME_KEY) as
      | { value: string }
      | undefined
    const themeId = legacyTheme?.value?.trim()
    return themeId ? { ...defaults, themeId } : defaults
  }

  setAppSettings(settings: AppSettings): void {
    this.ctx.db
      .prepare(
        `INSERT INTO kv_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(APP_SETTINGS_KEY, JSON.stringify(settings))
  }

  resetAppSettings(): AppSettings {
    const defaults = defaultAppSettings()
    const tx = this.ctx.db.transaction(() => {
      this.ctx.db.prepare(`DELETE FROM kv_settings WHERE key IN (?, ?)`).run(
        APP_SETTINGS_KEY,
        THEME_KEY
      )
      this.setAppSettings(defaults)
    })
    tx()
    return defaults
  }

  setThemeId(themeId: string): void {
    this.setAppSettings({ ...this.getAppSettings(), themeId })
  }

  getWorkspaceMeta(): WorkspaceMeta {
    return structuredClone(this.readMeta())
  }

  saveWorkspaceMeta(
    partial: Partial<
      Pick<WorkspaceMeta, 'name' | 'activeEnvironmentId' | 'mockPort' | 'editorTabState'>
    >
  ): void {
    const meta = { ...this.readMeta(), ...partial }
    this.writeMetaRow(meta)
  }

  listEnvironments(): Environment[] {
    const rows = this.ctx.db
      .prepare(`SELECT json FROM environments ORDER BY sort_index ASC, id ASC`)
      .all() as { json: string }[]
    return rows.map((r) => structuredClone(JSON.parse(r.json) as Environment))
  }

  saveEnvironment(env: Environment): void {
    const envs = this.listEnvironments()
    const idx = envs.findIndex((e) => e.id === env.id)
    const next = idx >= 0 ? [...envs.slice(0, idx), env, ...envs.slice(idx + 1)] : [...envs, env]
    const tx = this.ctx.db.transaction(() => {
      this.ctx.db.prepare(`DELETE FROM environments`).run()
      const ins = this.ctx.db.prepare(
        `INSERT INTO environments (id, json, sort_index) VALUES (?, ?, ?)`
      )
      next.forEach((e, i) => ins.run(e.id, JSON.stringify(e), i))
    })
    tx()
  }

  deleteEnvironment(id: string): void {
    const next = this.listEnvironments().filter((e) => e.id !== id)
    const tx = this.ctx.db.transaction(() => {
      this.ctx.db.prepare(`DELETE FROM environments`).run()
      const ins = this.ctx.db.prepare(
        `INSERT INTO environments (id, json, sort_index) VALUES (?, ?, ?)`
      )
      next.forEach((e, i) => ins.run(e.id, JSON.stringify(e), i))
    })
    tx()
  }

  listCollections(): Array<{ id: string; name: string }> {
    const rows = this.ctx.db
      .prepare(`SELECT json FROM collections ORDER BY sort_index ASC, id ASC`)
      .all() as { json: string }[]
    return rows.map((r) => {
      const c = JSON.parse(r.json) as Collection
      return { id: c.id, name: c.name }
    })
  }

  getAllCollections(): Collection[] {
    const rows = this.ctx.db
      .prepare(`SELECT json FROM collections ORDER BY sort_index ASC, id ASC`)
      .all() as { json: string }[]
    return rows.map((r) => structuredClone(JSON.parse(r.json) as Collection))
  }

  saveAllCollections(collections: Collection[]): void {
    const tx = this.ctx.db.transaction(() => {
      this.ctx.db.prepare(`DELETE FROM collections`).run()
      const ins = this.ctx.db.prepare(
        `INSERT INTO collections (id, json, sort_index) VALUES (?, ?, ?)`
      )
      collections.forEach((c, i) => ins.run(c.id, JSON.stringify(structuredClone(c)), i))
    })
    tx()
  }

  getCollection(id: string): Collection | undefined {
    const row = this.ctx.db.prepare(`SELECT json FROM collections WHERE id = ?`).get(id) as
      | { json: string }
      | undefined
    if (!row) return undefined
    return structuredClone(JSON.parse(row.json) as Collection)
  }

  saveCollection(col: Collection): void {
    const cols = this.getAllCollections()
    const idx = cols.findIndex((c) => c.id === col.id)
    const next = idx >= 0 ? [...cols.slice(0, idx), col, ...cols.slice(idx + 1)] : [...cols, col]
    this.saveAllCollections(next)
  }

  deleteCollection(id: string): void {
    const next = this.getAllCollections().filter((c) => c.id !== id)
    this.saveAllCollections(next)
  }

  addHistory(entry: HistoryEntry): void {
    const rows = this.ctx.db
      .prepare(`SELECT json FROM history ORDER BY created_at DESC LIMIT 499`)
      .all() as { json: string }[]
    const tx = this.ctx.db.transaction(() => {
      this.ctx.db.prepare(`DELETE FROM history`).run()
      const ins = this.ctx.db.prepare(`INSERT INTO history (id, created_at, json) VALUES (?, ?, ?)`)
      ins.run(entry.id, entry.createdAt, JSON.stringify(entry))
      for (const r of rows) {
        const h = JSON.parse(r.json) as HistoryEntry
        ins.run(h.id, h.createdAt, r.json)
      }
    })
    tx()
  }

  listHistory(limit = 100): HistoryEntry[] {
    const rows = this.ctx.db
      .prepare(`SELECT json FROM history ORDER BY created_at DESC LIMIT ?`)
      .all(limit) as { json: string }[]
    return rows.map((r) => structuredClone(JSON.parse(r.json) as HistoryEntry))
  }

  clearHistory(): void {
    this.ctx.db.prepare(`DELETE FROM history`).run()
  }

  exportAll(): {
    meta: WorkspaceMeta
    environments: Environment[]
    collections: Collection[]
    history: HistoryEntry[]
  } {
    return {
      meta: this.getWorkspaceMeta(),
      environments: this.listEnvironments(),
      collections: this.getAllCollections(),
      history: this.listHistory(500),
    }
  }

  exportBundleJson(): string {
    const data = this.exportAll()
    return stringifyWorkspaceBundle(data)
  }

  private saveAllEnvironments(environments: Environment[]): void {
    const tx = this.ctx.db.transaction(() => {
      this.ctx.db.prepare(`DELETE FROM environments`).run()
      const ins = this.ctx.db.prepare(
        `INSERT INTO environments (id, json, sort_index) VALUES (?, ?, ?)`
      )
      environments.forEach((e, i) => ins.run(e.id, JSON.stringify(e), i))
    })
    tx()
  }

  /**
   * Append collections and environments from a foreign file. Remaps ids to avoid collisions.
   * Renames imports when a display name is already used (case-insensitive).
   */
  mergeImportBundle(dataIn: { collections: Collection[]; environments: Environment[] }): {
    importedCollections: number
    importedEnvironments: number
    renamedCollections: Array<{ from: string; to: string }>
    renamedEnvironments: Array<{ from: string; to: string }>
  } {
    const existingCols = this.getAllCollections()
    const existingEnvs = this.listEnvironments()

    const colNamesTaken = new Set(
      existingCols.map((c) => c.name.trim().toLowerCase()).filter(Boolean)
    )
    const renamedCols: Array<{ from: string; to: string }> = []
    const appendedCols: Collection[] = []

    for (const raw of dataIn.collections) {
      const remapped = remapCollectionIds(raw)
      const baseName = remapped.name.trim() || 'Untitled Collection'
      const unique = allocateUniqueDisplayName(colNamesTaken, baseName)
      if (unique !== baseName) renamedCols.push({ from: baseName, to: unique })
      appendedCols.push({
        ...remapped,
        name: unique,
        root: { ...remapped.root, name: unique },
      })
    }

    const envNamesTaken = new Set(
      existingEnvs.map((e) => e.name.trim().toLowerCase()).filter(Boolean)
    )
    const renamedEnvs: Array<{ from: string; to: string }> = []
    const appendedEnvs: Environment[] = []

    for (const raw of dataIn.environments) {
      const remapped = remapEnvironmentIds(raw)
      const baseName = remapped.name.trim() || 'Environment'
      const unique = allocateUniqueDisplayName(envNamesTaken, baseName)
      if (unique !== baseName) renamedEnvs.push({ from: baseName, to: unique })
      appendedEnvs.push({ ...remapped, name: unique })
    }

    this.saveAllCollections([...existingCols, ...appendedCols])
    this.saveAllEnvironments([...existingEnvs, ...appendedEnvs])

    return {
      importedCollections: appendedCols.length,
      importedEnvironments: appendedEnvs.length,
      renamedCollections: renamedCols,
      renamedEnvironments: renamedEnvs,
    }
  }

  importBundle(dataIn: {
    meta: WorkspaceMeta
    environments: Environment[]
    collections: Collection[]
    history?: HistoryEntry[]
  }): void {
    const historyRows = this.ctx.db
      .prepare(`SELECT json FROM history ORDER BY created_at DESC`)
      .all() as { json: string }[]

    const tx = this.ctx.db.transaction(() => {
      this.writeMetaRow(dataIn.meta)

      this.ctx.db.prepare(`DELETE FROM environments`).run()
      const insEnv = this.ctx.db.prepare(
        `INSERT INTO environments (id, json, sort_index) VALUES (?, ?, ?)`
      )
      dataIn.environments.forEach((e, i) => insEnv.run(e.id, JSON.stringify(e), i))

      this.ctx.db.prepare(`DELETE FROM collections`).run()
      const insCol = this.ctx.db.prepare(
        `INSERT INTO collections (id, json, sort_index) VALUES (?, ?, ?)`
      )
      dataIn.collections.forEach((c, i) => insCol.run(c.id, JSON.stringify(c), i))

      this.ctx.db.prepare(`DELETE FROM history`).run()
      const insHist = this.ctx.db.prepare(`INSERT INTO history (id, created_at, json) VALUES (?, ?, ?)`)
      if (dataIn.history) {
        for (const h of dataIn.history) {
          insHist.run(h.id, h.createdAt, JSON.stringify(h))
        }
      } else {
        for (const r of historyRows) {
          const h = JSON.parse(r.json) as HistoryEntry
          insHist.run(h.id, h.createdAt, r.json)
        }
      }
    })
    tx()
  }
}
