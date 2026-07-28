/// <reference types="vite/client" />

import type {
  AppInfo,
  AppSettings,
  Collection,
  HttpStreamPushPayload,
  RequestDraft,
  SendHttpStreamInvokeResult,
  UpdaterPushPayload,
} from '@api-tester/shared'

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
          bodyBase64?: string
          bodyMime?: string
          downloadId?: string
        }
        error?: string
      }>
      saveResponseBody: (
        downloadId: string,
        suggestedName: string
      ) => Promise<{ ok: true; canceled: boolean; filePath?: string } | { ok: false; error: string }>
      sendHttpStream: (
        payload: {
          request: RequestDraft
          environmentVariables?: Record<string, string>
          streamSessionId: string
        },
        onEvent: (evt: HttpStreamPushPayload) => void
      ) => Promise<SendHttpStreamInvokeResult>
      dbHealth: () => Promise<{ ok: boolean }>
      historyList: () => Promise<unknown[]>
      historyAdd: (entry: unknown) => Promise<{ ok: boolean }>
      historyClear: () => Promise<{ ok: boolean }>
      workspaceGet: () => Promise<unknown>
      workspaceSaveMeta: (meta: unknown) => Promise<{ ok: boolean }>
      settingsGet: () => Promise<AppSettings>
      settingsSet: (settings: AppSettings) => Promise<{ ok: boolean }>
      settingsReset: () => Promise<AppSettings>
      themeGet: () => Promise<string | null>
      themeSet: (themeId: string) => Promise<{ ok: boolean }>
      collectionsList: () => Promise<unknown[]>
      collectionsGetAll: () => Promise<Collection[]>
      collectionsSaveAll: (cols: Collection[]) => Promise<{ ok: boolean }>
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
      importWorkspaceMerge: (jsonText: string) => Promise<{
        ok: true
        importedCollections: number
        importedEnvironments: number
        renamedCollections: Array<{ from: string; to: string }>
        renamedEnvironments: Array<{ from: string; to: string }>
      }>
      importPostman: (jsonText: string) => Promise<{ id: string }>
      updaterCheck: () => Promise<{ ok: true } | { ok: false; reason?: string; message?: string }>
      updaterDownload: () => Promise<{ ok: true } | { ok: false; reason?: string; message?: string }>
      updaterQuitAndInstall: () => Promise<{ ok: true } | { ok: false; reason?: string }>
      appInfo: () => Promise<AppInfo>
      appShowDataDirectory: () => Promise<{ ok: true } | { ok: false; error: string }>
      updaterSubscribe: (callback: (payload: UpdaterPushPayload) => void) => () => void
      appFinishClose?: () => Promise<{ ok: boolean }>
      onCloseRequested?: (callback: () => void) => () => void
    }
  }
}

export {}
