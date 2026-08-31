import { createContext, useCallback, useContext, useState } from 'react'
import { api } from '../lib/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wealthline_user') || 'null') } catch { return null }
  })
  const [token, setToken] = useState(() => localStorage.getItem('wealthline_token'))

  const login = useCallback(async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } })
    localStorage.setItem('wealthline_token', data.token)
    localStorage.setItem('wealthline_user', JSON.stringify(data.user))
    setToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const signup = useCallback(async (name, email, password) => {
    const data = await api('/auth/signup', { method: 'POST', body: { name, email, password } })
    localStorage.setItem('wealthline_token', data.token)
    localStorage.setItem('wealthline_user', JSON.stringify(data.user))
    setToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('wealthline_token')
    localStorage.removeItem('wealthline_user')
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
