export interface RequestErrorDescription {
  title: string
  message: string
}

function includesAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern))
}

/** Turn Node/Axios network errors into a diagnosis that is useful outside developer tools. */
export function describeRequestError(error: unknown): RequestErrorDescription {
  const technicalDetails =
    (error instanceof Error ? error.message : String(error ?? '')).trim() || 'Unknown network error'
  const normalized = technicalDetails.toLowerCase()

  if (
    includesAny(normalized, [
      'econnrefused',
      'err_connection_refused',
      'connection refused',
      'actively refused',
    ])
  ) {
    return {
      title: '连接被拒绝',
      message: '目标 IP 或端口未开放。',
    }
  }

  if (includesAny(normalized, ['enotfound', 'eai_again', 'getaddrinfo', 'name_not_resolved'])) {
    return {
      title: '无法解析目标地址',
      message: '域名解析失败。',
    }
  }

  if (includesAny(normalized, ['etimedout', 'econnaborted', 'timeout', 'timed out'])) {
    return {
      title: '连接超时',
      message: '目标服务未在规定时间内响应。',
    }
  }

  if (includesAny(normalized, ['econnreset', 'socket hang up', 'socket closed'])) {
    return {
      title: '连接中断',
      message: '远端已关闭连接。',
    }
  }

  if (
    includesAny(normalized, [
      'certificate',
      'self signed',
      'unable_to_verify_leaf_signature',
      'cert_',
      'tls',
    ])
  ) {
    return {
      title: 'TLS 证书错误',
      message: '服务器证书校验失败。',
    }
  }

  if (includesAny(normalized, ['invalid url', 'err_invalid_url', 'unsupported protocol'])) {
    return {
      title: '请求地址无效',
      message: 'URL 格式或协议不正确。',
    }
  }

  return {
    title: '请求失败',
    message: '未收到有效的 HTTP 响应。',
  }
}
