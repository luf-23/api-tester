import { contextBridge, ipcRenderer } from 'electron'
import { ipcChannels, updaterPushChannel, type UpdaterPushPayload } from '@api-tester/shared'

const api = {
  sendHttp: (payload: unknown) => ipcRenderer.invoke(ipcChannels.sendHttp, payload),
  dbHealth: () => ipcRenderer.invoke(ipcChannels.dbHealth),
  historyList: () => ipcRenderer.invoke(ipcChannels.historyList),
  historyAdd: (entry: unknown) => ipcRenderer.invoke(ipcChannels.historyAdd, entry),
  workspaceGet: () => ipcRenderer.invoke(ipcChannels.workspaceGet),
  workspaceSaveMeta: (meta: unknown) =>
    ipcRenderer.invoke(ipcChannels.workspaceSaveMeta, meta),
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
  importPostman: (jsonText: string) =>
    ipcRenderer.invoke(ipcChannels.importPostman, jsonText),
  updaterCheck: () => ipcRenderer.invoke(ipcChannels.updaterCheck),
  updaterDownload: () => ipcRenderer.invoke(ipcChannels.updaterDownload),
  updaterQuitAndInstall: () => ipcRenderer.invoke(ipcChannels.updaterQuitAndInstall),
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
