/**
 * Auth service
 * FEATURE 070: Sessions stored in memory Map + register endpoint
 * FEATURE 071: Password auth complete
 */

import { createHash } from 'crypto'
import { storage } from '../../storage'
import type { User, PublicUser, Tenant, AuthSession, LoginInput, LoginResult, RegisterInput, RegisterResult, AuthContext } from './types'

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * FEATURE 070: In-memory session store
 * Map<token, AuthSession>
 */
const sessionMap: Map<string, AuthSession> = new Map()

/**
 * Generate simple token
 */
function generateToken(): string {
  return `gc_${Date.now()}_${Math.random().toString(36).slice(2, 15)}${Math.random().toString(36).slice(2, 15)}`
}

/**
 * Generate unique ID
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * FEATURE 071: Hash password using SHA-256
 * Simple hash for development - use bcrypt in production
 */
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

/**
 * FEATURE 071: Remove passwordHash from user for API responses
 */
function toPublicUser(user: User): PublicUser {
  const { passwordHash, ...publicUser } = user
  return publicUser
}

/**
 * Get all users
 */
export function getAllUsers(): User[] {
  return storage.getAll<User>('users')
}

/**
 * Get user by email
 */
export function getUserByEmail(email: string): User | null {
  const users = getAllUsers()
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null
}

/**
 * Get user by id
 */
export function getUserById(id: string): User | null {
  return storage.getById<User>('users', id)
}

/**
 * Get all tenants
 */
export function getAllTenants(): Tenant[] {
  return storage.getAll<Tenant>('tenants')
}

/**
 * Get tenant by id
 */
export function getTenantById(id: string): Tenant | null {
  return storage.getById<Tenant>('tenants', id)
}

/**
 * Create default tenant if none exists
 */
function ensureDefaultTenant(): Tenant {
  const tenants = getAllTenants()
  if (tenants.length > 0) {
    return tenants[0]
  }

  const tenant: Tenant = {
    id: generateId('tenant'),
    name: 'Default Tenant',
    active: true,
    createdAt: Date.now()
  }

  storage.add('tenants', tenant)
  return tenant
}

/**
 * Create first admin user
 */
function createFirstAdminUser(email: string, tenantId: string): User {
  const user: User = {
    id: generateId('user'),
    tenantId,
    email: email.toLowerCase(),
    role: 'admin',
    active: true,
    createdAt: Date.now()
  }

  storage.add('users', user)
  return user
}

/**
 * Create auth session
 * FEATURE 070: Uses in-memory Map instead of file storage
 */
function createSession(userId: string, tenantId: string): AuthSession {
  const now = Date.now()
  const session: AuthSession = {
    token: generateToken(),
    userId,
    tenantId,
    createdAt: now,
    expiresAt: now + SESSION_DURATION_MS
  }

  sessionMap.set(session.token, session)
  return session
}

/**
 * Login with email and password
 * FEATURE 071: Password verification
 */
export function login(input: LoginInput): LoginResult {
  const { email, password } = input

  if (!email || typeof email !== 'string') {
    return { success: false, error: 'Email is required' }
  }

  if (!password || typeof password !== 'string') {
    return { success: false, error: 'Password is required' }
  }

  const normalizedEmail = email.toLowerCase().trim()
  if (!normalizedEmail.includes('@')) {
    return { success: false, error: 'Invalid email format' }
  }

  // Check existing user
  const user = getUserByEmail(normalizedEmail)

  if (!user) {
    return { success: false, error: 'Credenciales incorrectas' }
  }

  if (!user.active) {
    return { success: false, error: 'Usuario inactivo' }
  }

  // Verify password
  if (!user.passwordHash) {
    return { success: false, error: 'Credenciales incorrectas' }
  }

  const inputHash = hashPassword(password)
  if (inputHash !== user.passwordHash) {
    return { success: false, error: 'Credenciales incorrectas' }
  }

  // Create session
  const session = createSession(user.id, user.tenantId)

  return {
    success: true,
    token: session.token,
    user: toPublicUser(user)
  }
}

/**
 * Get session by token
 * FEATURE 070: Uses in-memory Map
 */
export function getSessionByToken(token: string): AuthSession | null {
  const session = sessionMap.get(token)

  if (!session) return null

  // Check expiry
  if (session.expiresAt < Date.now()) {
    sessionMap.delete(token)
    return null
  }

  return session
}

/**
 * Validate token and get auth context
 */
export function validateToken(token: string): AuthContext | null {
  if (!token) return null

  const session = getSessionByToken(token)
  if (!session) return null

  const user = getUserById(session.userId)
  if (!user || !user.active) return null

  const tenant = getTenantById(session.tenantId)
  if (!tenant || !tenant.active) return null

  return { user, tenant, session }
}

/**
 * Logout - invalidate session
 * FEATURE 070: Uses in-memory Map
 */
export function logout(token: string): boolean {
  return sessionMap.delete(token)
}

/**
 * Create user (admin only)
 */
export function createUser(email: string, tenantId: string, role: 'admin' | 'user' = 'user'): User | null {
  const existing = getUserByEmail(email)
  if (existing) return null

  const tenant = getTenantById(tenantId)
  if (!tenant) return null

  const user: User = {
    id: generateId('user'),
    tenantId,
    email: email.toLowerCase(),
    role,
    active: true,
    createdAt: Date.now()
  }

  storage.add('users', user)
  return user
}

/**
 * Create tenant
 */
export function createTenant(name: string): Tenant {
  const tenant: Tenant = {
    id: generateId('tenant'),
    name,
    active: true,
    createdAt: Date.now()
  }

  storage.add('tenants', tenant)
  return tenant
}

/**
 * Register new user
 * FEATURE 070: Public registration endpoint
 * FEATURE 071: Password required
 */
export function register(input: RegisterInput): RegisterResult {
  const { email, password } = input

  if (!email || typeof email !== 'string') {
    return { success: false, error: 'Email is required' }
  }

  if (!password || typeof password !== 'string') {
    return { success: false, error: 'Password is required' }
  }

  if (password.length < 4) {
    return { success: false, error: 'Password must be at least 4 characters' }
  }

  const normalizedEmail = email.toLowerCase().trim()
  if (!normalizedEmail.includes('@')) {
    return { success: false, error: 'Invalid email format' }
  }

  // Check if user already exists
  const existingUser = getUserByEmail(normalizedEmail)
  if (existingUser) {
    return { success: false, error: 'Este email ya esta registrado' }
  }

  // Get or create default tenant
  const tenant = ensureDefaultTenant()

  // Determine role: first user is admin, rest are users
  const existingUsers = getAllUsers()
  const role = existingUsers.length === 0 ? 'admin' : 'user'

  // Create user with hashed password
  const user: User = {
    id: generateId('user'),
    tenantId: tenant.id,
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    role,
    active: true,
    createdAt: Date.now()
  }

  storage.add('users', user)

  // Create session
  const session = createSession(user.id, user.tenantId)

  return {
    success: true,
    token: session.token,
    user: toPublicUser(user)
  }
}

/**
 * Get active session count (for debugging)
 * FEATURE 070
 */
export function getSessionCount(): number {
  return sessionMap.size
}
