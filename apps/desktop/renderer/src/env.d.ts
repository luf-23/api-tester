/// <reference types="vite/client" />

import type { RequestDraft } from '@api-tester/shared'

declare global {
  interface Window {
    apiTester: {
      sendHttp: (payload: { request: RequestDraft; environmentVariables?: Record<string, string> }) => Promise<{
        response: {
          status: number
          statusText: string
          headers: Record<string, string>
          bodyText: string
          durationMs: number
          sizeBytes: number
        }
        error?: string
      }>
      dbHealth: () => Promise<{ ok: boolean }>
      historyList: () => Promise<unknown[]>
      historyAdd: (entry: unknown) => Promise<{ ok: boolean }>
      workspaceGet: () => Promise<unknown>
      workspaceSaveMeta: (meta: unknown) => Promise<{ ok: boolean }>
      collectionsList: () => Promise<unknown[]>
      collectionGet: (id: string) => Promise<unknown>
      collectionSave: (col: unknown) => Promise<{ ok: boolean }>
      collectionDelete: (id: string) => Promise<{ ok: boolean }>
      environmentsList: () => Promise<unknown[]>
      environmentSave: (env: unknown) => Promise<{ ok: boolean }>
      environmentDelete: (id: string) => Promise<{ ok: boolean }>
      runCollection: (args: unknown) => Promise<unknown>
      mockStart: (payload: unknown) => Promise<{ port: number }>
      mockStop: () => Promise<{ ok: boolean }>
      mockStatus: () => Promise<{ running: boolean; port: number }>
      exportWorkspace: () => Promise<string>
      importWorkspace: (jsonText: string) => Promise<{ ok: boolean }>
      importPostman: (jsonText: string) => Promise<{ id: string }>
    }
  }
}

export {}
