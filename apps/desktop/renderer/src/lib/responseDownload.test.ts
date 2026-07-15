import { describe, expect, it } from 'vitest'
import type { HttpResponseView } from '@api-tester/shared'
import { isBinaryResponse, suggestedResponseFileName } from './responseDownload'

function response(headers: Record<string, string>): HttpResponseView {
  return { status: 200, statusText: 'OK', headers, bodyText: '', durationMs: 1, sizeBytes: 1 }
}

describe('response downloads', () => {
  it('uses an RFC 5987 content-disposition filename', () => {
    const value = response({
      'Content-Disposition': "attachment; filename*=UTF-8''%E6%8A%A5%E8%A1%A8.xlsx",
      'Content-Type': 'application/octet-stream',
    })
    expect(suggestedResponseFileName(value)).toBe('报表.xlsx')
  })

  it('derives common Office extensions from content type', () => {
    const value = response({
      'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    expect(suggestedResponseFileName(value)).toBe('response.docx')
    expect(isBinaryResponse(value)).toBe(true)
  })

  it('does not classify JSON and text as binary', () => {
    expect(isBinaryResponse(response({ 'content-type': 'application/json; charset=utf-8' }))).toBe(false)
    expect(isBinaryResponse(response({ 'content-type': 'text/csv' }))).toBe(false)
  })
})
