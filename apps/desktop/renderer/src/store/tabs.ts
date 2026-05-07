import { create } from 'zustand'
import type { HttpResponseView } from '@api-tester/shared'
import { sampleCollection, sampleResponseBody } from '../lib/seed'
import type { FolderNode, RequestWithTests } from '@api-tester/shared'

function isRequest(n: FolderNode | RequestWithTests): n is RequestWithTests {
  return 'method' in n
}

function flatten(node: FolderNode): RequestWithTests[] {
  const out: RequestWithTests[] = []
  for (const c of node.children) {
    if (isRequest(c)) out.push(c)
    else out.push(...flatten(c))
  }
  return out
}

const allRequests = flatten(sampleCollection.root)
const initialIds = [
  'Get Users',
  'Create User',
  'Update User',
  'Delete User',
  'List Orders',
]
  .map((name) => allRequests.find((r) => r.name === name)?.id)
  .filter((x): x is string => Boolean(x))

const seededResponse: HttpResponseView = {
  status: 200,
  statusText: 'OK',
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(new TextEncoder().encode(sampleResponseBody).length),
    'x-request-id': 'req_2gKp4F8tZ',
    'cache-control': 'private, max-age=0',
    server: 'jade-edge/1.18',
    date: new Date().toUTCString(),
    'x-ratelimit-limit': '60',
    'x-ratelimit-remaining': '58',
    vary: 'Accept-Encoding',
    'access-control-allow-origin': '*',
    'strict-transport-security': 'max-age=31536000',
    'x-runtime': '0.142',
  },
  bodyText: sampleResponseBody,
  durationMs: 142,
  sizeBytes: new TextEncoder().encode(sampleResponseBody).length,
}

export interface TabResponseState {
  loading: boolean
  response?: HttpResponseView
  error?: string
  receivedAt?: number
}

interface TabsState {
  openIds: string[]
  activeId: string | null
  responses: Record<string, TabResponseState>
  open: (id: string) => void
  close: (id: string) => void
  activate: (id: string) => void
  setResponse: (id: string, state: TabResponseState) => void
}

export const useTabsStore = create<TabsState>((set) => ({
  openIds: initialIds,
  activeId: initialIds[0] ?? null,
  responses: initialIds[0] ? { [initialIds[0]]: { loading: false, response: seededResponse, receivedAt: Date.now() } } : {},
  open: (id) =>
    set((s) => ({
      openIds: s.openIds.includes(id) ? s.openIds : [...s.openIds, id],
      activeId: id,
    })),
  close: (id) =>
    set((s) => {
      const next = s.openIds.filter((x) => x !== id)
      const activeId = s.activeId === id ? next[next.length - 1] ?? null : s.activeId
      const responses = { ...s.responses }
      delete responses[id]
      return { openIds: next, activeId, responses }
    }),
  activate: (id) => set({ activeId: id }),
  setResponse: (id, state) =>
    set((s) => ({ responses: { ...s.responses, [id]: state } })),
}))
