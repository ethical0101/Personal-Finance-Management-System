const API = '/api'

function getToken() {
  return localStorage.getItem('wealthline_token')
}

export async function api(path, { method = 'GET', body } = {}) {
  const token = getToken()
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  let data = null
  try { data = await res.json() } catch (e) { /* no body */ }
  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed (${res.status}).`)
  }
  return data
}

export function money(n) {
  const sign = n < 0 ? '-' : ''
  return `${sign}₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
