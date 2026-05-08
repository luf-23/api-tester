import path from 'node:path'
import fs from 'node:fs'
import Database from 'better-sqlite3'
import type {
  Collection,
  Environment,
  HistoryEntry,
  WorkspaceMeta,
} from '@api-tester/shared'

export interface StorageContext {
  db: Database.Database
}

const DB_FILENAME = 'api-tester.sqlite'
const LEGACY_JSON = 'api-tester.workspace.json'
const LEGACY_MIGRATE_KEY = 'legacy_json_migrated_v1'

interface LegacyWorkspaceFile {
  meta?: WorkspaceMeta
  environments?: Environment[]
  collections?: Collection[]
  history?: HistoryEntry[]
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_meta (
      id TEXT PRIMARY KEY NOT NULL,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS kv_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY NOT NULL,
      json TEXT NOT NULL,
      sort_index INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS environments (
      id TEXT PRIMARY KEY NOT NULL,
      json TEXT NOT NULL,
      sort_index INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY NOT NULL,
      created_at INTEGER NOT NULL,
      json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_history_created_at ON history (created_at DESC);
  `)
}

function migrateFromLegacyJson(db: Database.Database, userDataPath: string): void {
  const done = db
    .prepare(`SELECT 1 AS ok FROM kv_settings WHERE key = ?`)
    .get(LEGACY_MIGRATE_KEY) as { ok: number } | undefined
  if (done) return

  const jsonPath = path.join(userDataPath, LEGACY_JSON)
  if (!fs.existsSync(jsonPath)) {
    db.prepare(`INSERT OR IGNORE INTO kv_settings (key, value) VALUES (?, '1')`).run(LEGACY_MIGRATE_KEY)
    return
  }

  let raw: string
  try {
    raw = fs.readFileSync(jsonPath, 'utf-8')
  } catch {
    return
  }

  let data: LegacyWorkspaceFile
  try {
    data = JSON.parse(raw) as LegacyWorkspaceFile
  } catch {
    try {
      fs.renameSync(jsonPath, `${jsonPath}.invalid.bak`)
    } catch {
      /* ignore */
    }
    db.prepare(`INSERT OR IGNORE INTO kv_settings (key, value) VALUES (?, '1')`).run(LEGACY_MIGRATE_KEY)
    return
  }

  const meta = data.meta ?? { id: 'default', name: 'Default' }
  const environments = data.environments ?? []
  const collections = data.collections ?? []
  const history = data.history ?? []

  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM workspace_meta`).run()
    db.prepare(`INSERT INTO workspace_meta (id, json) VALUES (?, ?)`).run(meta.id, JSON.stringify(meta))

    db.prepare(`DELETE FROM environments`).run()
    const insEnv = db.prepare(
      `INSERT INTO environments (id, json, sort_index) VALUES (?, ?, ?)`
    )
    environments.forEach((e, i) => insEnv.run(e.id, JSON.stringify(e), i))

    db.prepare(`DELETE FROM collections`).run()
    const insCol = db.prepare(
      `INSERT INTO collections (id, json, sort_index) VALUES (?, ?, ?)`
    )
    collections.forEach((c, i) => insCol.run(c.id, JSON.stringify(c), i))

    db.prepare(`DELETE FROM history`).run()
    const insHist = db.prepare(`INSERT INTO history (id, created_at, json) VALUES (?, ?, ?)`)
    for (const h of history) {
      insHist.run(h.id, h.createdAt, JSON.stringify(h))
    }

    db.prepare(`INSERT OR REPLACE INTO kv_settings (key, value) VALUES (?, '1')`).run(LEGACY_MIGRATE_KEY)
  })
  tx()

  try {
    fs.renameSync(jsonPath, `${jsonPath}.migrated.bak`)
  } catch {
    /* leave original if rename fails */
  }
}

export function openDatabase(userDataPath: string): StorageContext {
  fs.mkdirSync(userDataPath, { recursive: true })
  const dbPath = path.join(userDataPath, DB_FILENAME)
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  migrateFromLegacyJson(db, userDataPath)

  const row = db.prepare(`SELECT COUNT(*) AS c FROM workspace_meta`).get() as { c: number }
  if (row.c === 0) {
    const defaultMeta: WorkspaceMeta = { id: 'default', name: 'Default' }
    db.prepare(`INSERT INTO workspace_meta (id, json) VALUES (?, ?)`).run(
      defaultMeta.id,
      JSON.stringify(defaultMeta)
    )
  }

  return { db }
}
