function readXsrfCookie() {
  const cookie = document.cookie.split('; ').find((item) => item.startsWith('XSRF-TOKEN='))
  return cookie ? decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) : ''
}

export async function apiRequest(path, options = {}) {
  const method = options.method || 'GET'
  const headers = { Accept: 'application/json', ...options.headers }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
    headers['X-XSRF-TOKEN'] = readXsrfCookie()
  }

  return fetch(path, {
    ...options,
    credentials: 'include',
    headers,
  })
}
