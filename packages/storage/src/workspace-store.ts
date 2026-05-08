import fs from 'node:fs'
import type {
  Collection,
  Environment,
  HistoryEntry,
  WorkspaceMeta,
} from '@api-tester/shared'
import type { StorageContext } from './db'

interface WorkspaceData {
  meta: WorkspaceMeta
  environments: Environment[]
  collections: Collection[]
  history: HistoryEntry[]
}

const DEFAULT_WS_ID = 'default'

export class WorkspaceStore {
  constructor(private readonly ctx: StorageContext) {
    this.ensureDefaultWorkspace()
  }

  private ensureDefaultWorkspace(): void {
    const data = this.readData()
    if (!data.meta?.id) {
      data.meta = { id: DEFAULT_WS_ID, name: 'Default' }
      this.writeData(data)
    }
  }

  private readData(): WorkspaceData {
    const text = fs.readFileSync(this.ctx.filePath, 'utf-8')
    const parsed = JSON.parse(text) as Partial<WorkspaceData>
    return {
      meta: parsed.meta ?? { id: DEFAULT_WS_ID, name: 'Default' },
      environments: parsed.environments ?? [],
      collections: parsed.collections ?? [],
      history: parsed.history ?? [],
    }
  }

  private writeData(data: WorkspaceData): void {
    fs.writeFileSync(this.ctx.filePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  getWorkspaceMeta(): WorkspaceMeta {
    return this.readData().meta
  }

  saveWorkspaceMeta(partial: Partial<Pick<WorkspaceMeta, 'name' | 'activeEnvironmentId' | 'mockPort'>>): void {
    const data = this.readData()
    data.meta = { ...data.meta, ...partial }
    this.writeData(data)
  }

  listEnvironments(): Environment[] {
    return this.readData().environments
  }

  saveEnvironment(env: Environment): void {
    const data = this.readData()
    const idx = data.environments.findIndex((e) => e.id === env.id)
    if (idx >= 0) data.environments[idx] = env
    else data.environments.push(env)
    this.writeData(data)
  }

  deleteEnvironment(id: string): void {
    const data = this.readData()
    data.environments = data.environments.filter((e) => e.id !== id)
    this.writeData(data)
  }

  listCollections(): Array<{ id: string; name: string }> {
    return this.readData().collections.map((c) => ({ id: c.id, name: c.name }))
  }

  getAllCollections(): Collection[] {
    return this.readData().collections.map((c) => structuredClone(c))
  }

  saveAllCollections(collections: Collection[]): void {
    const data = this.readData()
    data.collections = collections.map((c) => structuredClone(c))
    this.writeData(data)
  }

  getCollection(id: string): Collection | undefined {
    return this.readData().collections.find((c) => c.id === id)
  }

  saveCollection(col: Collection): void {
    const data = this.readData()
    const idx = data.collections.findIndex((c) => c.id === col.id)
    if (idx >= 0) data.collections[idx] = col
    else data.collections.push(col)
    this.writeData(data)
  }

  deleteCollection(id: string): void {
    const data = this.readData()
    data.collections = data.collections.filter((c) => c.id !== id)
    this.writeData(data)
  }

  addHistory(entry: HistoryEntry): void {
    const data = this.readData()
    data.history.unshift(entry)
    data.history = data.history.slice(0, 500)
    this.writeData(data)
  }

  listHistory(limit = 100): HistoryEntry[] {
    return this.readData().history.slice(0, limit)
  }

  exportAll(): {
    meta: WorkspaceMeta
    environments: Environment[]
    collections: Collection[]
    history: HistoryEntry[]
  } {
    return this.readData()
  }

  importBundle(dataIn: {
    meta: WorkspaceMeta
    environments: Environment[]
    collections: Collection[]
  }): void {
    const cur = this.readData()
    const next: WorkspaceData = {
      meta: dataIn.meta,
      environments: dataIn.environments,
      collections: dataIn.collections,
      history: cur.history,
    }
    this.writeData(next)
  }
}