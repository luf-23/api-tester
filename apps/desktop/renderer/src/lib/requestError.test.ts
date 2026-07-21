import { describe, expect, it } from 'vitest'
import { describeRequestError } from './requestError'

describe('describeRequestError', () => {
  it('explains a closed target port', () => {
    const result = describeRequestError('connect ECONNREFUSED 127.0.0.1:8080')
    expect(result.title).toBe('连接被拒绝')
    expect(result.message).toBe('目标 IP 或端口未开放。')
  })

  it.each([
    ['getaddrinfo ENOTFOUND api.invalid', '无法解析目标地址'],
    ['connect ETIMEDOUT 10.0.0.1:8080', '连接超时'],
    ['socket hang up', '连接中断'],
    ['self signed certificate', 'TLS 证书错误'],
  ])('classifies %s', (error, title) => {
    expect(describeRequestError(error).title).toBe(title)
  })

  it('provides a useful fallback for an empty status-0 response', () => {
    const result = describeRequestError('No HTTP response was received')
    expect(result.title).toBe('请求失败')
    expect(result.message).toBe('未收到有效的 HTTP 响应。')
  })
})
