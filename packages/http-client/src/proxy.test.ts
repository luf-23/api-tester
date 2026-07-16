import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosRequestConfig } from 'axios'
import type { RequestDraft } from '@api-tester/shared'

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }))

vi.mock('axios', () => ({ default: { request: requestMock } }))

import { sendRequest } from './index'

function draft(sendSettings: RequestDraft['sendSettings']): RequestDraft {
  return {
    id: 'request-1',
    name: 'Proxy test',
    method: 'GET',
    url: 'https://example.com/resource',
    params: [],
    headers: [],
    bodyMode: 'none',
    bodyText: '',
    bodyFields: [],
    sendSettings,
  }
}

describe('request proxy settings', () => {
  beforeEach(() => {
    requestMock.mockReset()
    requestMock.mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, data: new Uint8Array() })
  })

  it('explicitly bypasses proxies in direct mode', async () => {
    await sendRequest(draft({ timeoutMs: 1000, maxRedirects: 5, validateTls: true, proxyMode: 'direct' }))

    expect((requestMock.mock.calls[0][0] as AxiosRequestConfig).proxy).toBe(false)
  })

  it('uses the proxy returned by the system resolver', async () => {
    const resolveSystemProxy = vi.fn().mockResolvedValue('http://127.0.0.1:7890')
    await sendRequest(
      draft({ timeoutMs: 1000, maxRedirects: 5, validateTls: true, proxyMode: 'system' }),
      { resolveSystemProxy }
    )

    expect(resolveSystemProxy).toHaveBeenCalledWith('https://example.com/resource')
    expect((requestMock.mock.calls[0][0] as AxiosRequestConfig).proxy).toEqual({
      protocol: 'http',
      host: '127.0.0.1',
      port: 7890,
    })
  })

  it('parses a custom authenticated proxy', async () => {
    await sendRequest(
      draft({
        timeoutMs: 1000,
        maxRedirects: 5,
        validateTls: true,
        proxyMode: 'custom',
        proxyUrl: 'https://user:p%40ss@proxy.example:8443',
      })
    )

    expect((requestMock.mock.calls[0][0] as AxiosRequestConfig).proxy).toEqual({
      protocol: 'https',
      host: 'proxy.example',
      port: 8443,
      auth: { username: 'user', password: 'p@ss' },
    })
  })

  it('rejects an unsupported custom proxy URL before sending', async () => {
    const result = await sendRequest(
      draft({
        timeoutMs: 1000,
        maxRedirects: 5,
        validateTls: true,
        proxyMode: 'custom',
        proxyUrl: 'socks5://127.0.0.1:1080',
      })
    )

    expect(result.error).toContain('Unsupported proxy protocol')
    expect(requestMock).not.toHaveBeenCalled()
  })
})
