'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'

export interface User {
  id: string
  email: string
  nombre: string
  rol: 'dueno' | 'gerente' | 'mesero' | 'cocina' | 'cajero' | 'contador' | 'comprador' | 'vendedor' | 'admin'
  telefono?: string
  direccion?: string
  metodo_pago?: string
  preferencias?: string[]
  alergias?: string[]
  puntos?: number
  gasto_total?: number
  ultima_visita?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  initialized: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: User }>
  register: (data: {
    email: string
    password: string
    nombre: string
    rol: 'dueno' | 'gerente' | 'mesero' | 'cocina' | 'cajero' | 'contador' | 'comprador' | 'vendedor' | 'admin'
    telefono?: string
    direccion?: string
  }) => Promise<{ success: boolean; error?: string; user?: User }>
  logout: () => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<{ success: boolean; error?: string }>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user || null)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        await fetch('/api/db/init')
      } catch {
        // ignore
      }
      await refreshUser()
      setInitialized(true)
      setLoading(false)
    }
    init()
  }, [refreshUser])

  const login = async (email: string, password: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setUser(data.user)
        return { success: true, user: data.user }
      }
      return { success: false, error: data.error || 'Error al iniciar sesión' }
    } catch (error: any) {
      return { success: false, error: error.message }
    } finally {
      setLoading(false)
    }
  }

  const register = async (data: {
    email: string
    password: string
    nombre: string
    rol: 'dueno' | 'gerente' | 'mesero' | 'cocina' | 'cajero' | 'contador' | 'comprador' | 'vendedor' | 'admin'
    telefono?: string
    direccion?: string
  }) => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (res.ok && result.success) {
        setUser(result.user)
        return { success: true, user: result.user }
      }
      return { success: false, error: result.error || 'Error en el registro' }
    } catch (error: any) {
      return { success: false, error: error.message }
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/me', { method: 'POST' })
    } catch {
      // ignore
    }
    setUser(null)
  }

  const updateProfile = async (data: Partial<User>) => {
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (res.ok && result.success) {
        setUser(result.user)
        return { success: true }
      }
      return { success: false, error: result.error }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, initialized, login, register, logout, updateProfile, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
