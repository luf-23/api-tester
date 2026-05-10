import type { RequestDraft } from '@api-tester/shared'

export interface SendResult {
  response: {
    status: number
    statusText: string
    headers: Record<string, string>
    bodyText: string
    durationMs: number
    sizeBytes: number
    bodyBase64?: string
    bodyMime?: string
  }
  error?: string
}

export async function sendHttp(
  request: RequestDraft,
  environmentVariables?: Record<string, string>
): Promise<SendResult> {
  const bridge = (typeof window !== 'undefined' ? window.apiTester : undefined) as
    | Window['apiTester']
    | undefined
  if (bridge) return bridge.sendHttp({ request, environmentVariables })
  /* Fallback for browser preview / tests — never hit in Electron. */
  return {
    response: {
      status: 0,
      statusText: 'Preload bridge unavailable',
      headers: {},
      bodyText: '',
      durationMs: 0,
      sizeBytes: 0,
    },
    error: 'window.apiTester is not exposed; run inside Electron.',
  }
}
