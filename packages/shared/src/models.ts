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
  /** When true (headers UI only), row is folded under “show hidden headers” until expanded. */
  hidden?: boolean
  /** Built-in header row: header name fixed; value still editable when enabling the row. */
  preset?: boolean
  /**
   * multipart/form-data only: `file` sends `fileBase64` as the part body (filename / MIME optional).
   * Omitted or `text` keeps `value` as a normal text field.
   */
  partType?: 'text' | 'file'
  /** Original filename for the file part (Content-Disposition). */
  fileName?: string
  /** Optional Content-Type for the file part. */
  fileMime?: string
  /** Base64-encoded file bytes for send (populated when user attaches a file in the UI). */
  fileBase64?: string
}

/** Per-request options passed to the HTTP client when sending. */
export interface RequestSendSettings {
  /** Request timeout in milliseconds. Use 0 for no limit (axios behavior). */
  timeoutMs: number
  /** Maximum redirects to follow; 0 disables redirects. */
  maxRedirects: number
  /** When false, TLS certificate verification is disabled (dev / self-signed only). */
  validateTls: boolean
  /**
   * Unless explicitly `false`, interactive Send uses a streaming response body (SSE, chunked text, etc.).
   * Set to `false` in Settings to buffer the full body before updating the UI.
   */
  streamResponse?: boolean
}

export function defaultSendSettings(): RequestSendSettings {
  return {
    timeoutMs: 120_000,
    maxRedirects: 5,
    validateTls: true,
    streamResponse: true,
  }
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
  /** Send / network behavior; omitted entries use defaults at runtime. */
  sendSettings?: RequestSendSettings
}

export interface HttpResponseView {
  status: number
  statusText: string
  headers: Record<string, string>
  bodyText: string
  durationMs: number
  sizeBytes: number
  /** Base64-encoded raw body when preview is available (see `bodyMime`). */
  bodyBase64?: string
  /** MIME type for `bodyBase64` data URL (e.g. image/png). */
  bodyMime?: string
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

/** Last-open request tabs — restored on next launch (desktop). */
export interface EditorTabState {
  openRequestIds: string[]
  activeRequestId: string | null
}

export interface WorkspaceMeta {
  id: string
  name: string
  activeEnvironmentId?: string
  mockPort?: number
  editorTabState?: EditorTabState
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
