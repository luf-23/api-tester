import { create } from 'zustand'
import {
  defaultAppSettings,
  type AppSettings,
  type RequestSendSettings,
} from '@api-tester/shared'

interface SettingsState {
  settings: AppSettings
  loaded: boolean
  load: (settings: AppSettings) => void
  update: (partial: Partial<AppSettings>) => AppSettings
  updateRequestDefaults: (partial: Partial<RequestSendSettings>) => AppSettings
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultAppSettings(),
  loaded: false,
  load: (settings) => set({ settings, loaded: true }),
  update: (partial) => {
    const next = { ...get().settings, ...partial }
    set({ settings: next })
    return next
  },
  updateRequestDefaults: (partial) => {
    const current = get().settings
    const next = {
      ...current,
      requestDefaults: { ...current.requestDefaults, ...partial },
    }
    set({ settings: next })
    return next
  },
}))
