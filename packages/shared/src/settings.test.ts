import { describe, expect, it } from 'vitest'
import { appSettingsSchema } from './ipc'
import { defaultAppSettings } from './models'

describe('application settings', () => {
  it('provides defaults accepted by the IPC schema', () => {
    const defaults = defaultAppSettings()
    expect(appSettingsSchema.safeParse(defaults).success).toBe(true)
    expect(defaults.requestDefaults.proxyMode).toBe('system')
    expect(defaults.autoCheckUpdates).toBe(true)
  })

  it('rejects unsafe request default ranges', () => {
    const defaults = defaultAppSettings()
    const parsed = appSettingsSchema.safeParse({
      ...defaults,
      requestDefaults: { ...defaults.requestDefaults, maxRedirects: 101 },
    })
    expect(parsed.success).toBe(false)
  })
})
