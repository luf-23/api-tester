import { create } from 'zustand'
import type {
  Collection,
  Environment,
  HistoryEntry,
  HttpMethod,
  HttpResponseView,
  KeyValue,
  RequestWithTests,
  WorkspaceMeta,
} from '@api-tester/shared'
import { defaultSendSettings } from '@api-tester/shared'

export type TabId = 'params' | 'headers' | 'body' | 'settings'

export interface AppState {
  workspace: WorkspaceMeta | null
  environments: Environment[]
  activeEnvironmentId: string | null
  collections: Array<{ id: string; name: string }>
  selectedCollectionId: string | null
  history: HistoryEntry[]
  draft: RequestWithTests
  requestTab: TabId
  responseTab: 'body' | 'headers'
  lastResponse?: HttpResponseView
  lastError?: string
  sending: boolean
  runReportJson: string | null
  mockPort: number
  mockRoutesJson: string
  setMockPort: (n: number) => void
  setMockRoutesJson: (s: string) => void

  loadBootstrap: () => Promise<void>
  setDraft: (patch: Partial<RequestWithTests>) => void
  setDraftFull: (draft: RequestWithTests) => void
  newDraft: () => void
  setRequestTab: (t: TabId) => void
  setResponseTab: (t: 'body' | 'headers') => void
  setActiveEnvironmentId: (id: string | null) => void
  upsertEnvironment: (env: Environment) => Promise<void>
  saveWorkspaceMeta: (partial: Partial<WorkspaceMeta>) => Promise<void>
  refreshHistory: () => Promise<void>
  sendRequest: () => Promise<void>
  saveCurrentAsCollection: (name: string) => Promise<void>
  selectCollection: (id: string | null) => Promise<void>
  runSelectedCollection: (stopOnFailure: boolean) => Promise<void>
  exportWorkspace: () => Promise<void>
  importWorkspace: (text: string) => Promise<void>
  importPostman: (text: string) => Promise<void>
  startMock: () => Promise<void>
  stopMock: () => Promise<void>
}

function newId(): string {
  return globalThis.crypto.randomUUID()
}

function blankKeyValue(): KeyValue {
  return { id: newId(), key: '', value: '', enabled: true }
}

export function createBlankDraft(): RequestWithTests {
  return {
    id: newId(),
    name: 'Untitled',
    method: 'GET',
    url: 'https://httpbin.org/get',
    params: [blankKeyValue()],
    headers: [blankKeyValue()],
    bodyMode: 'none',
    bodyText: '',
    bodyFields: [blankKeyValue()],
    sendSettings: defaultSendSettings(),
  }
}

function kvToRecord(rows: KeyValue[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of rows) {
    if (r.enabled && r.key) out[r.key] = r.value
  }
  return out
}

export const useAppStore = create<AppState>((set, get) => ({
  workspace: null,
  environments: [],
  activeEnvironmentId: null,
  collections: [],
  selectedCollectionId: null,
  history: [],
  draft: createBlankDraft(),
  requestTab: 'params',
  responseTab: 'body',
  lastResponse: undefined,
  lastError: undefined,
  sending: false,
  runReportJson: null,
  mockPort: 5055,
  mockRoutesJson: JSON.stringify(
    [
      {
        id: newId(),
        method: 'GET',
        path: '/health',
        status: 200,
        body: '{"ok":true}',
        headers: [{ id: newId(), key: 'Content-Type', value: 'application/json', enabled: true }],
        delayMs: 0,
      },
    ],
    null,
    2
  ),

  loadBootstrap: async () => {
    const ws = await window.apiTester.workspaceGet()
    const envs = await window.apiTester.environmentsList()
    const cols = await window.apiTester.collectionsList()
    const hist = await window.apiTester.historyList()
    set({
      workspace: ws,
      environments: envs,
      activeEnvironmentId: ws.activeEnvironmentId ?? envs[0]?.id ?? null,
      collections: cols,
      selectedCollectionId: cols[0]?.id ?? null,
      history: hist,
      mockPort: ws.mockPort ?? 5055,
    })
  },

  setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  setDraftFull: (draft) => set({ draft }),
  newDraft: () =>
    set({
      draft: createBlankDraft(),
      lastResponse: undefined,
      lastError: undefined,
      requestTab: 'params',
    }),
  setRequestTab: (t) => set({ requestTab: t }),
  setResponseTab: (t) => set({ responseTab: t }),
  setActiveEnvironmentId: (id) => set({ activeEnvironmentId: id }),

  upsertEnvironment: async (env) => {
    await window.apiTester.environmentSave(env)
    const envs = await window.apiTester.environmentsList()
    set({ environments: envs })
  },

  saveWorkspaceMeta: async (partial) => {
    await window.apiTester.workspaceSaveMeta(partial)
    const ws = await window.apiTester.workspaceGet()
    set({ workspace: ws })
  },

  refreshHistory: async () => {
    const hist = await window.apiTester.historyList()
    set({ history: hist })
  },

  sendRequest: async () => {
    const s = get()
    set({ sending: true, lastError: undefined })
    try {
      const active = s.environments.find((e) => e.id === s.activeEnvironmentId)
      const merged = {
        ...kvToRecord(active?.variables ?? []),
      }
      const payload = {
        request: {
          ...s.draft,
          bodyMode: s.draft.bodyMode,
        },
        environmentVariables: merged,
      }
      const result = (await window.apiTester.sendHttp(payload)) as {
        response?: HttpResponseView
        error?: string
      }
      if (result.error) {
        set({ lastError: result.error, lastResponse: result.response })
      } else {
        set({ lastResponse: result.response, lastError: undefined })
      }
      const entry: HistoryEntry = {
        id: newId(),
        createdAt: Date.now(),
        request: { ...s.draft },
        response: result.response,
        error: result.error,
      }
      await window.apiTester.historyAdd(entry)
      await get().refreshHistory()
    } finally {
      set({ sending: false })
    }
  },

  saveCurrentAsCollection: async (name) => {
    const s = get()
    const col: Collection = {
      id: newId(),
      name,
      root: {
        id: newId(),
        name: 'root',
        children: [{ ...s.draft }],
      },
    }
    await window.apiTester.collectionSave(col)
    const cols = await window.apiTester.collectionsList()
    set({ collections: cols, selectedCollectionId: col.id })
  },

  selectCollection: async (id) => {
    set({ selectedCollectionId: id })
    if (!id) return
    const col = (await window.apiTester.collectionGet(id)) as Collection | null
    if (!col) return
    const first = findFirstRequest(col.root)
    if (first) {
      set({ draft: { ...first }, requestTab: 'params' })
    }
  },

  runSelectedCollection: async (stopOnFailure) => {
    const s = get()
    if (!s.selectedCollectionId) return
    const rep = await window.apiTester.runCollection({
      collectionId: s.selectedCollectionId,
      environmentId: s.activeEnvironmentId ?? undefined,
      stopOnFailure,
    })
    set({ runReportJson: JSON.stringify(rep, null, 2) })
  },

  exportWorkspace: async () => {
    const json = (await window.apiTester.exportWorkspace()) as string
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'api-tester-workspace.json'
    a.click()
    URL.revokeObjectURL(url)
  },

  importWorkspace: async (text) => {
    await window.apiTester.importWorkspace(text)
    await get().loadBootstrap()
  },

  importPostman: async (text) => {
    await window.apiTester.importPostman(text)
    const cols = await window.apiTester.collectionsList()
    set({ collections: cols })
  },

  startMock: async () => {
    const s = get()
    const routes = JSON.parse(s.mockRoutesJson) as unknown
    await window.apiTester.mockStart({ port: s.mockPort, routes: routes as never })
    await get().saveWorkspaceMeta({ mockPort: s.mockPort })
  },

  stopMock: async () => {
    await window.apiTester.mockStop()
  },

  setMockPort: (n) => set({ mockPort: n }),
  setMockRoutesJson: (s) => set({ mockRoutesJson: s }),
}))

function findFirstRequest(node: Collection['root']): RequestWithTests | null {
  for (const c of node.children) {
    if ('children' in c) {
      const hit = findFirstRequest(c)
      if (hit) return hit
    } else {
      return c as RequestWithTests
    }
  }
  return null
}

export function mapDraftMethod(m: string): HttpMethod {
  const upper = m.toUpperCase()
  const allowed: HttpMethod[] = [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'HEAD',
    'OPTIONS',
  ]
  return (allowed.includes(upper as HttpMethod) ? upper : 'GET') as HttpMethod
}
