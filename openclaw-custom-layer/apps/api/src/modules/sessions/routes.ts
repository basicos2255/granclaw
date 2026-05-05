/**
 * Routes de Sessions
 * Con tenant isolation via auth context
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { ok, badRequest, notFound, unauthorized } from '../../shared/response'
import { listSessions, getSessionForTenant, createSession, addMessage } from './service'
import type { CreateSessionInput, AddMessageInput } from './types'
import type { AuthContext } from '../auth'

export function handleListSessions(_req: IncomingMessage, res: ServerResponse, context: AuthContext | null): void {
  // Rutas protegidas requieren contexto
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  ok(res, listSessions(context.tenant.id))
}

export function handleGetSession(_req: IncomingMessage, res: ServerResponse, sessionId: string, context: AuthContext | null): void {
  // Rutas protegidas requieren contexto
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const session = getSessionForTenant(sessionId, context.tenant.id)

  if (!session) {
    notFound(res, `Session with id "${sessionId}" not found`)
    return
  }

  ok(res, session)
}

export function handleCreateSession(req: IncomingMessage, res: ServerResponse, context: AuthContext | null): void {
  // Rutas protegidas requieren contexto
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  let body = ''

  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', () => {
    let input: CreateSessionInput = {}

    if (body) {
      try {
        input = JSON.parse(body)
      } catch {
        badRequest(res, 'Invalid JSON body')
        return
      }
    }

    const session = createSession(input, context.tenant.id)
    ok(res, session, 201)
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}

export function handleAddMessage(req: IncomingMessage, res: ServerResponse, sessionId: string, context: AuthContext | null): void {
  // Rutas protegidas requieren contexto
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  // Verificar que la sesión pertenece al tenant
  const session = getSessionForTenant(sessionId, context.tenant.id)
  if (!session) {
    notFound(res, `Session with id "${sessionId}" not found`)
    return
  }

  let body = ''

  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', () => {
    if (!body) {
      badRequest(res, 'Request body is required')
      return
    }

    let input: AddMessageInput

    try {
      input = JSON.parse(body)
    } catch {
      badRequest(res, 'Invalid JSON body')
      return
    }

    if (!input.role || !['user', 'assistant', 'system'].includes(input.role)) {
      badRequest(res, 'Field "role" must be "user", "assistant", or "system"')
      return
    }

    if (!input.content || typeof input.content !== 'string') {
      badRequest(res, 'Field "content" is required')
      return
    }

    const result = addMessage(sessionId, input)

    if (!result.success) {
      notFound(res, result.error || 'Session not found')
      return
    }

    ok(res, result.session)
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}
