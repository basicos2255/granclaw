/**
 * Auth hook
 * FEATURE 071: Simple auth state management
 */
import { useState, useEffect, useCallback } from 'react'
import { api, clearToken, setToken } from '../services/api'

export interface AuthUser {
  id: string
  email: string
  role: 'admin' | 'user'
  tenantId: string
}

export interface AuthState {
  user: AuthUser | null
  loading: boolean
  isAuthenticated: boolean
}

const TOKEN_KEY = 'granclaw_token'

function hasToken(): boolean {
  return !!localStorage.getItem(TOKEN_KEY)
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: hasToken(),
    isAuthenticated: false
  })

  const checkAuth = useCallback(async () => {
    if (!hasToken()) {
      setState({ user: null, loading: false, isAuthenticated: false })
      return
    }

    setState((prev) => ({ ...prev, loading: true }))

    try {
      const response = await api.getMe()
      if (response.success && response.data?.user) {
        setState({
          user: response.data.user,
          loading: false,
          isAuthenticated: true
        })
      } else {
        clearToken()
        setState({ user: null, loading: false, isAuthenticated: false })
      }
    } catch {
      clearToken()
      setState({ user: null, loading: false, isAuthenticated: false })
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login(email, password)
    if (response.success && response.data?.token) {
      setToken(response.data.token)
      setState({
        user: response.data.user,
        loading: false,
        isAuthenticated: true
      })
      return { success: true }
    }
    return { success: false, error: response.error || 'Login fallido' }
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    const response = await api.register(email, password)
    if (response.success && response.data?.token) {
      setToken(response.data.token)
      setState({
        user: response.data.user,
        loading: false,
        isAuthenticated: true
      })
      return { success: true }
    }
    return { success: false, error: response.error || 'Registro fallido' }
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    clearToken()
    setState({ user: null, loading: false, isAuthenticated: false })
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return {
    ...state,
    login,
    register,
    logout,
    checkAuth
  }
}
