/// <reference types="vite/client" />

type ApiTesterApi = {
  sendHttp: (payload: unknown) => Promise<unknown>
  dbHealth: () => Promise<unknown>
  historyList: () => Promise<unknown>
  historyAdd: (entry: unknown) => Promise<unknown>
  workspaceGet: () => Promise<unknown>
  workspaceSaveMeta: (meta: unknown) => Promise<unknown>
  collectionsList: () => Promise<unknown>
  collectionSave: (col: unknown) => Promise<unknown>
  collectionDelete: (id: string) => Promise<unknown>
  collectionGet: (id: string) => Promise<unknown>
  environmentsList: () => Promise<unknown>
  environmentSave: (env: unknown) => Promise<unknown>
  environmentDelete: (id: string) => Promise<unknown>
  runCollection: (args: unknown) => Promise<unknown>
  mockStart: (payload: unknown) => Promise<unknown>
  mockStop: () => Promise<unknown>
  mockStatus: () => Promise<unknown>
  exportWorkspace: () => Promise<unknown>
  importWorkspace: (jsonText: string) => Promise<unknown>
  importPostman: (jsonText: string) => Promise<unknown>
}

declare global {
  interface Window {
    apiTester: ApiTesterApi
  }
}

export {}
