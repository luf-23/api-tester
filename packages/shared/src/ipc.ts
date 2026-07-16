import { z } from 'zod'
import type { HttpResponseView } from './models'

export const keyValueSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.string(),
  enabled: z.boolean(),
  hidden: z.boolean().optional(),
  preset: z.boolean().optional(),
  partType: z.enum(['text', 'file']).optional(),
  fileName: z.string().optional(),
  fileMime: z.string().optional(),
  fileBase64: z.string().optional(),
})

export const requestSendSettingsSchema = z.object({
  timeoutMs: z.number().nonnegative().max(3_600_000),
  maxRedirects: z.number().int().min(0).max(100),
  validateTls: z.boolean(),
  streamResponse: z.boolean().optional(),
  proxyMode: z.enum(['direct', 'system', 'custom']).optional(),
  proxyUrl: z.string().max(2048).optional(),
})

export const requestDraftSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
    url: z.string(),
    params: z.array(keyValueSchema),
    headers: z.array(keyValueSchema),
    bodyMode: z.enum(['none', 'json', 'text', 'form-urlencoded', 'form-data']),
    bodyText: z.string(),
    bodyFields: z.array(keyValueSchema),
    sendSettings: requestSendSettingsSchema.optional(),
  })
  .passthrough()

export const sendHttpRequestSchema = z.object({
  request: requestDraftSchema,
  /** Resolved URL after variables (optional — main can resolve too) */
  environmentVariables: z.record(z.string()).optional(),
})

export type SendHttpRequestInput = z.infer<typeof sendHttpRequestSchema>

export const sendHttpStreamRequestSchema = sendHttpRequestSchema.extend({
  streamSessionId: z.string().min(1),
})

export type SendHttpStreamRequestInput = z.infer<typeof sendHttpStreamRequestSchema>

/** Main → renderer while a streamed HTTP response is in progress (preload listens). */
export type HttpStreamPushPayload =
  | {
      streamSessionId: string
      phase: 'headers'
      status: number
      statusText: string
      headers: Record<string, string>
    }
  | { streamSessionId: string; phase: 'chunk'; text: string }

/** Final body/meta must come from the invoke result — avoids races with preload removing the push listener. */
export type SendHttpStreamInvokeResult =
  | { ok: true; response: HttpResponseView }
  | { ok: false; error: string }

export const requestWithTestsSchema = requestDraftSchema.extend({
  preRequestScript: z.string().optional(),
})

export const collectionRunSchema = z.object({
  collectionId: z.string(),
  environmentId: z.string().optional(),
  stopOnFailure: z.boolean().optional(),
})

export const mockStartSchema = z.object({
  port: z.number().int().min(1024).max(65535),
  routes: z.array(
    z.object({
      id: z.string(),
      method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
      path: z.string(),
      status: z.number(),
      body: z.string(),
      headers: z.array(keyValueSchema),
      delayMs: z.number().nonnegative(),
    })
  ),
})

export const ipcChannels = {
  sendHttp: 'http:send',
  sendHttpStream: 'http:sendStream',
  saveResponseBody: 'http:saveResponseBody',
  dbHealth: 'db:health',
  historyList: 'history:list',
  historyAdd: 'history:add',
  workspaceGet: 'workspace:get',
  workspaceSaveMeta: 'workspace:saveMeta',
  themeGet: 'theme:get',
  themeSet: 'theme:set',
  collectionsList: 'collections:list',
  collectionsGetAll: 'collections:getAll',
  collectionsSaveAll: 'collections:saveAll',
  collectionGet: 'collection:get',
  collectionSave: 'collection:save',
  collectionDelete: 'collection:delete',
  environmentsList: 'env:list',
  environmentSave: 'env:save',
  environmentDelete: 'env:delete',
  runCollection: 'collection:run',
  mockStart: 'mock:start',
  mockStop: 'mock:stop',
  mockStatus: 'mock:status',
  exportWorkspace: 'workspace:export',
  importWorkspace: 'workspace:import',
  importWorkspaceMerge: 'workspace:importMerge',
  importPostman: 'import:postman',
  updaterCheck: 'updater:check',
  updaterDownload: 'updater:download',
  updaterQuitAndInstall: 'updater:quitAndInstall',
  /** Renderer invokes after user confirms window close (save/discard/no dirty). */
  appFinishClose: 'app:finishClose',
} as const

/** Main → renderer: user clicked window close; renderer may prompt for unsaved work. */
export const appCloseRequestedChannel = 'app:closeRequested' as const

/** Main → renderer (preload listens on this channel). */
export const updaterPushChannel = 'updater:event' as const

/** Main → renderer: incremental HTTP response body while streaming is enabled. */
export const httpStreamPushChannel = 'http:streamEvent' as const

export type UpdaterPushPayload =
  | { type: 'checking' }
  | { type: 'available'; version: string; releaseNotes?: string }
  | { type: 'not-available' }
  | { type: 'download-progress'; percent: number; transferred: number; total: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }
