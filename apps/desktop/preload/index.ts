import { contextBridge, ipcRenderer } from 'electron'
import {
  appCloseRequestedChannel,
  httpStreamPushChannel,
  ipcChannels,
  updaterPushChannel,
  type HttpStreamPushPayload,
  type SendHttpStreamInvokeResult,
  type UpdaterPushPayload,
} from '@api-tester/shared'

const api = {
  sendHttp: (payload: unknown) => ipcRenderer.invoke(ipcChannels.sendHttp, payload),
  saveResponseBody: (downloadId: string, suggestedName: string) =>
    ipcRenderer.invoke(ipcChannels.saveResponseBody, { downloadId, suggestedName }),
  sendHttpStream: (payload: unknown, onEvent: (evt: HttpStreamPushPayload) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, evt: HttpStreamPushPayload) => {
      onEvent(evt)
    }
    ipcRenderer.on(httpStreamPushChannel, listener)
    return ipcRenderer
      .invoke(ipcChannels.sendHttpStream, payload)
      .finally(() => {
        /** Let any pushes delivered in the same tick run before unregistering (extra safety). */
        queueMicrotask(() => {
          ipcRenderer.removeListener(httpStreamPushChannel, listener)
        })
      }) as Promise<SendHttpStreamInvokeResult>
  },
  dbHealth: () => ipcRenderer.invoke(ipcChannels.dbHealth),
  historyList: () => ipcRenderer.invoke(ipcChannels.historyList),
  historyAdd: (entry: unknown) => ipcRenderer.invoke(ipcChannels.historyAdd, entry),
  historyClear: () => ipcRenderer.invoke(ipcChannels.historyClear),
  workspaceGet: () => ipcRenderer.invoke(ipcChannels.workspaceGet),
  workspaceSaveMeta: (meta: unknown) =>
    ipcRenderer.invoke(ipcChannels.workspaceSaveMeta, meta),
  settingsGet: () => ipcRenderer.invoke(ipcChannels.settingsGet),
  settingsSet: (settings: unknown) => ipcRenderer.invoke(ipcChannels.settingsSet, settings),
  settingsReset: () => ipcRenderer.invoke(ipcChannels.settingsReset),
  themeGet: () => ipcRenderer.invoke(ipcChannels.themeGet),
  themeSet: (themeId: string) => ipcRenderer.invoke(ipcChannels.themeSet, themeId),
  collectionsList: () => ipcRenderer.invoke(ipcChannels.collectionsList),
  collectionsGetAll: () => ipcRenderer.invoke(ipcChannels.collectionsGetAll),
  collectionsSaveAll: (cols: unknown) =>
    ipcRenderer.invoke(ipcChannels.collectionsSaveAll, cols),
  collectionSave: (col: unknown) => ipcRenderer.invoke(ipcChannels.collectionSave, col),
  collectionDelete: (id: string) => ipcRenderer.invoke(ipcChannels.collectionDelete, id),
  collectionGet: (id: string) => ipcRenderer.invoke(ipcChannels.collectionGet, id),
  environmentsList: () => ipcRenderer.invoke(ipcChannels.environmentsList),
  environmentSave: (env: unknown) => ipcRenderer.invoke(ipcChannels.environmentSave, env),
  environmentDelete: (id: string) =>
    ipcRenderer.invoke(ipcChannels.environmentDelete, id),
  runCollection: (args: unknown) => ipcRenderer.invoke(ipcChannels.runCollection, args),
  mockStart: (payload: unknown) => ipcRenderer.invoke(ipcChannels.mockStart, payload),
  mockStop: () => ipcRenderer.invoke(ipcChannels.mockStop),
  mockStatus: () => ipcRenderer.invoke(ipcChannels.mockStatus),
  exportWorkspace: () => ipcRenderer.invoke(ipcChannels.exportWorkspace),
  importWorkspace: (jsonText: string) =>
    ipcRenderer.invoke(ipcChannels.importWorkspace, jsonText),
  importWorkspaceMerge: (jsonText: string) =>
    ipcRenderer.invoke(ipcChannels.importWorkspaceMerge, jsonText),
  importPostman: (jsonText: string) =>
    ipcRenderer.invoke(ipcChannels.importPostman, jsonText),
  updaterCheck: () => ipcRenderer.invoke(ipcChannels.updaterCheck),
  updaterDownload: () => ipcRenderer.invoke(ipcChannels.updaterDownload),
  updaterQuitAndInstall: () => ipcRenderer.invoke(ipcChannels.updaterQuitAndInstall),
  appInfo: () => ipcRenderer.invoke(ipcChannels.appInfo),
  appShowDataDirectory: () => ipcRenderer.invoke(ipcChannels.appShowDataDirectory),
  appFinishClose: () => ipcRenderer.invoke(ipcChannels.appFinishClose),
  onCloseRequested: (callback: () => void) => {
    const listener = (): void => {
      callback()
    }
    ipcRenderer.on(appCloseRequestedChannel, listener)
    return () => {
      ipcRenderer.removeListener(appCloseRequestedChannel, listener)
    }
  },
  updaterSubscribe: (callback: (payload: UpdaterPushPayload) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: UpdaterPushPayload) =>
      callback(payload)
    ipcRenderer.on(updaterPushChannel, listener)
    return () => {
      ipcRenderer.removeListener(updaterPushChannel, listener)
    }
  },
}

contextBridge.exposeInMainWorld('apiTester', api)

declare global {
  interface Window {
    apiTester: typeof api
  }
}
