import { create } from 'zustand'
import type { HttpResponseView } from '@api-tester/shared'

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
  openIds: [],
  activeId: null,
  responses: {},
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
