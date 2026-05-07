import { contextBridge, ipcRenderer } from 'electron'
import { ipcChannels } from '@api-tester/shared'

const api = {
  sendHttp: (payload: unknown) => ipcRenderer.invoke(ipcChannels.sendHttp, payload),
  dbHealth: () => ipcRenderer.invoke(ipcChannels.dbHealth),
  historyList: () => ipcRenderer.invoke(ipcChannels.historyList),
  historyAdd: (entry: unknown) => ipcRenderer.invoke(ipcChannels.historyAdd, entry),
  workspaceGet: () => ipcRenderer.invoke(ipcChannels.workspaceGet),
  workspaceSaveMeta: (meta: unknown) =>
    ipcRenderer.invoke(ipcChannels.workspaceSaveMeta, meta),
  collectionsList: () => ipcRenderer.invoke(ipcChannels.collectionsList),
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
}

contextBridge.exposeInMainWorld('apiTester', api)

declare global {
  interface Window {
    apiTester: typeof api
  }
}
