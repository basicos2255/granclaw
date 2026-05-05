/**
 * Auth module types
 */

export type UserRole = 'admin' | 'user'

export interface User {
  id: string
  tenantId: string
  email: string
  passwordHash?: string
  role: UserRole
  active: boolean
  createdAt: number
}

/** User sin passwordHash para respuestas */
export type PublicUser = Omit<User, 'passwordHash'>

export interface AuthSession {
  token: string
  userId: string
  tenantId: string
  createdAt: number
  expiresAt: number
}

export interface Tenant {
  id: string
  name: string
  active: boolean
  createdAt: number
}

export interface LoginInput {
  email: string
  password: string
}

export interface LoginResult {
  success: boolean
  token?: string
  user?: PublicUser
  error?: string
}

export interface RegisterInput {
  email: string
  password: string
}

export interface RegisterResult {
  success: boolean
  token?: string
  user?: PublicUser
  error?: string
}

export interface AuthContext {
  user: User
  tenant: Tenant
  session: AuthSession
}
