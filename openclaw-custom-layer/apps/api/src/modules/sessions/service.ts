/**
 * Service de Sessions
 * Multi-tenant aware
 */

import { storage } from '../../storage'
import type { Session, CreateSessionInput, AddMessageInput, SessionMessage } from './types'

const MAX_MESSAGES = 20

/**
 * List all sessions (internal, no tenant filter)
 */
export function listSessionsInternal(): Session[] {
  return storage.getAll<Session>('sessions')
}

/**
 * List sessions for a tenant
 */
export function listSessions(tenantId?: string): Session[] {
  const sessions = listSessionsInternal()
  if (!tenantId) return sessions
  return sessions.filter((s) => s.tenantId === tenantId)
}

/**
 * Get session by id (internal, no tenant check)
 */
export function getSession(id: string): Session | null {
  return storage.getById<Session>('sessions', id)
}

/**
 * Get session by id for a specific tenant
 */
export function getSessionForTenant(id: string, tenantId: string): Session | null {
  const session = getSession(id)
  if (!session || session.tenantId !== tenantId) return null
  return session
}

/**
 * Create session for a tenant
 */
export function createSession(input: CreateSessionInput | undefined, tenantId: string): Session {
  const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const now = Date.now()

  const messages: SessionMessage[] = []

  if (input?.initialMessage) {
    messages.push({
      role: 'user',
      content: input.initialMessage,
      timestamp: now
    })
  }

  const session: Session = {
    id,
    tenantId,
    messages,
    createdAt: now,
    updatedAt: now
  }

  storage.add('sessions', session)
  return session
}

export interface AddMessageResult {
  success: boolean
  session?: Session
  error?: string
}

export function addMessage(sessionId: string, input: AddMessageInput): AddMessageResult {
  const session = getSession(sessionId)

  if (!session) {
    return {
      success: false,
      error: `Session with id "${sessionId}" not found`
    }
  }

  const message: SessionMessage = {
    role: input.role,
    content: input.content,
    timestamp: Date.now()
  }

  // Añadir mensaje
  session.messages.push(message)

  // Limitar historial a últimos MAX_MESSAGES
  if (session.messages.length > MAX_MESSAGES) {
    session.messages = session.messages.slice(-MAX_MESSAGES)
  }

  session.updatedAt = Date.now()

  // Actualizar en storage
  storage.update<Session>('sessions', sessionId, {
    messages: session.messages,
    updatedAt: session.updatedAt
  })

  return { success: true, session }
}

/**
 * Obtiene los mensajes de una sesión para enviar al LLM
 * Formato compatible con OpenAI API
 */
export function getSessionMessages(sessionId: string): Array<{ role: string; content: string }> | null {
  const session = getSession(sessionId)
  if (!session) return null

  return session.messages.map((msg) => ({
    role: msg.role,
    content: msg.content
  }))
}
