// Put this file in src/api.js. It talks to the Campus 360 backend.
// Needs the vite.config.js proxy (included), or set VITE_API_URL=http://localhost:4000 in a .env file.
const BASE = import.meta.env.VITE_API_URL || ''
const KEY = 'c360_token'
export const getToken = () => sessionStorage.getItem(KEY)
export const setToken = t => (t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY))

async function request(method, url, { body, form } = {}) {
  const headers = {}
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`
  if (body) headers['Content-Type'] = 'application/json'
  let res
  try { res = await fetch(`${BASE}/api${url}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) }) }
  catch { throw new Error('Cannot reach the server. Is the backend running?') }
  if (res.status === 401 && getToken()) { setToken(null); location.reload() }      // session ended
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data
}

export const api = {
  get: url => request('GET', url),
  post: (url, body) => request('POST', url, { body }),
  put: (url, body) => request('PUT', url, { body }),
  patch: (url, body) => request('PATCH', url, { body }),
  del: url => request('DELETE', url),
  upload: (url, fields, file) => { const f = new FormData(); Object.entries(fields || {}).forEach(([k, v]) => f.append(k, v)); f.append('file', file); return request('POST', url, { form: f }) },
  async login(email, password, role) { const d = await request('POST', '/auth/login', { body: { email, password, role } }); setToken(d.token); return d.user },
  logout: () => setToken(null),
  // opens a protected file (submission, question bank, notes) as a download
  async download(fileId, name) {
    const res = await fetch(`${BASE}/api/files/${fileId}`, { headers: { Authorization: `Bearer ${getToken()}` } })
    if (!res.ok) throw new Error('You cannot open this file')
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(await res.blob()), download: name })
    a.click(); URL.revokeObjectURL(a.href)
  },
}
