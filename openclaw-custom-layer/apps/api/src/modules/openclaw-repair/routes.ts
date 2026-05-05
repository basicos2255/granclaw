/**
 * OpenClaw Repair Routes
 * FIX 125: Pairing Auto-Repair Action Button
 *
 * API endpoints for managing OpenClaw repair sessions.
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { ok, badRequest, unauthorized, notFound } from '../../shared/response'
import type { AuthContext } from '../auth'
import {
  startRepairSession,
  getRepairSession,
  getActiveRepairSessions,
  checkRepairAuthorization,
  cancelRepairSession,
  markSessionWaitingUser,
  markSessionRetried,
  getRepairInstructions,
  getRepairHistory
} from './service'
import type { StartRepairInput } from './types'

/**
 * POST /openclaw/repair/start
 * Start a new repair session
 */
export function handleStartRepair(
  req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
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

    let input: StartRepairInput

    try {
      input = JSON.parse(body)
    } catch {
      badRequest(res, 'Invalid JSON body')
      return
    }

    if (!input.scopeKey) {
      badRequest(res, 'Field "scopeKey" is required')
      return
    }

    if (!input.originalInput) {
      badRequest(res, 'Field "originalInput" is required')
      return
    }

    console.log(`[OpenClawRepair] Starting repair for scope ${input.scopeKey}`)

    const result = startRepairSession(context.tenant.id, context.user.id, input)

    if (result.success && result.repairSession) {
      // Mark as waiting for user
      markSessionWaitingUser(result.repairSession.id)
    }

    ok(res, {
      ...result,
      instructions: result.repairSession
        ? getRepairInstructions(result.repairSession.scopeKey)
        : undefined
    })
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}

/**
 * GET /openclaw/repair/:id
 * Get repair session by ID
 */
export function handleGetRepairSession(
  req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null,
  sessionId: string
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const session = getRepairSession(sessionId)

  if (!session) {
    notFound(res, 'Repair session not found')
    return
  }

  // Verify tenant ownership
  if (session.tenantId !== context.tenant.id) {
    notFound(res, 'Repair session not found')
    return
  }

  ok(res, {
    success: true,
    repairSession: session,
    instructions: getRepairInstructions(session.scopeKey)
  })
}

/**
 * POST /openclaw/repair/:id/check
 * Check if OpenClaw authorization is ready
 */
export function handleCheckRepair(
  req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null,
  sessionId: string
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const session = getRepairSession(sessionId)

  if (!session) {
    notFound(res, 'Repair session not found')
    return
  }

  if (session.tenantId !== context.tenant.id) {
    notFound(res, 'Repair session not found')
    return
  }

  console.log(`[OpenClawRepair] Checking authorization for session ${sessionId}`)

  checkRepairAuthorization(sessionId)
    .then((result) => {
      ok(res, result)
    })
    .catch((err) => {
      console.error('[OpenClawRepair] Check error:', err)
      ok(res, {
        success: false,
        canRetry: false,
        message: 'Error al verificar autorización'
      })
    })
}

/**
 * POST /openclaw/repair/:id/cancel
 * Cancel a repair session
 */
export function handleCancelRepair(
  req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null,
  sessionId: string
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const session = getRepairSession(sessionId)

  if (!session) {
    notFound(res, 'Repair session not found')
    return
  }

  if (session.tenantId !== context.tenant.id) {
    notFound(res, 'Repair session not found')
    return
  }

  console.log(`[OpenClawRepair] Cancelling session ${sessionId}`)

  const cancelled = cancelRepairSession(sessionId)

  ok(res, {
    success: !!cancelled,
    repairSession: cancelled
  })
}

/**
 * POST /openclaw/repair/:id/retry
 * Mark session as retried (after user retries the action)
 */
export function handleRetryRepair(
  req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null,
  sessionId: string
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const session = getRepairSession(sessionId)

  if (!session) {
    notFound(res, 'Repair session not found')
    return
  }

  if (session.tenantId !== context.tenant.id) {
    notFound(res, 'Repair session not found')
    return
  }

  if (session.status !== 'ready') {
    badRequest(res, 'Session is not ready for retry')
    return
  }

  console.log(`[OpenClawRepair] Marking session ${sessionId} as retried`)

  const retried = markSessionRetried(sessionId)

  ok(res, {
    success: !!retried,
    repairSession: retried,
    originalInput: session.originalInput
  })
}

/**
 * GET /openclaw/repair/active
 * Get active repair sessions for current tenant
 */
export function handleGetActiveRepairs(
  req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const sessions = getActiveRepairSessions(context.tenant.id)

  ok(res, {
    success: true,
    sessions,
    count: sessions.length
  })
}

/**
 * GET /openclaw/repair/history
 * Get repair history for current tenant
 */
export function handleGetRepairHistory(
  req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const history = getRepairHistory(context.tenant.id)

  ok(res, {
    success: true,
    events: history,
    count: history.length
  })
}
