import { z } from 'zod'

export const keyValueSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.string(),
  enabled: z.boolean(),
  hidden: z.boolean().optional(),
  preset: z.boolean().optional(),
})

export const requestSendSettingsSchema = z.object({
  timeoutMs: z.number().nonnegative().max(3_600_000),
  maxRedirects: z.number().int().min(0).max(100),
  validateTls: z.boolean(),
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
  importPostman: 'import:postman',
} as const
