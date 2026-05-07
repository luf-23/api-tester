/** Shared domain types (serializable). */

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS'

export type BodyMode = 'none' | 'json' | 'text' | 'form-urlencoded' | 'form-data'

export interface KeyValue {
  id: string
  key: string
  value: string
  enabled: boolean
}

export interface RequestDraft {
  id: string
  name: string
  method: HttpMethod
  url: string
  params: KeyValue[]
  headers: KeyValue[]
  bodyMode: BodyMode
  /** JSON / raw text */
  bodyText: string
  /** x-www-form-urlencoded & form-data store same shape */
  bodyFields: KeyValue[]
}

export interface HttpResponseView {
  status: number
  statusText: string
  headers: Record<string, string>
  bodyText: string
  durationMs: number
  sizeBytes: number
}

export interface HistoryEntry {
  id: string
  createdAt: number
  request: RequestDraft
  response?: HttpResponseView
  error?: string
}

export interface AssertionRule {
  id: string
  type: 'status' | 'header' | 'body_contains' | 'json_path'
  /** status: exact code; header: key match; body_contains: substring; json_path: path */
  target?: string
  expected?: string | number
  operator?: 'eq' | 'contains' | 'exists'
}

export interface RequestWithTests extends RequestDraft {
  preRequestScript?: string
  tests: AssertionRule[]
}

export interface FolderNode {
  id: string
  name: string
  children: Array<FolderNode | RequestWithTests>
}

export interface Collection {
  id: string
  name: string
  root: FolderNode
}

export interface Environment {
  id: string
  name: string
  variables: KeyValue[]
}

export interface WorkspaceMeta {
  id: string
  name: string
  activeEnvironmentId?: string
  mockPort?: number
}

export interface MockRoute {
  id: string
  method: HttpMethod
  path: string
  status: number
  /** JSON or plain text */
  body: string
  headers: KeyValue[]
  delayMs: number
}

export interface RunResultItem {
  requestId: string
  requestName: string
  ok: boolean
  durationMs: number
  error?: string
  assertionFailures?: string[]
}

export interface CollectionRunReport {
  id: string
  startedAt: number
  finishedAt: number
  items: RunResultItem[]
}
