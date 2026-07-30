import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { clearCode, readCode, writeCode } from './storage'

interface AuthValue {
  code: string
  login: (code: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

/**
 * Вход по личному коду.
 *
 * Это не защита, а разделение: на одном устройстве могут работать несколько
 * человек, и данные каждого лежат под своим ключом. Пароль здесь ничего не
 * охраняет — потому и не спрашивается.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState(() => readCode())

  const login = useCallback((next: string) => {
    const clean = next.trim().slice(0, 40)
    if (!clean) return
    writeCode(clean)
    setCode(clean)
  }, [])

  const logout = useCallback(() => {
    clearCode()
    setCode('')
  }, [])

  const value = useMemo(() => ({ code, login, logout }), [code, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth вне AuthProvider')
  return ctx
}
