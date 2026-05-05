/**
 * OS Tools Routes
 * FEATURE 110: Controlled OS Tools v1
 */

import type { IncomingMessage, ServerResponse } from 'http'
import type { AuthContext } from '../auth/types'
import { ok, badRequest, unauthorized } from '../../shared/response'
import type { OSToolConfirmRequest } from './types'
import { OS_TOOLS_WHITELIST, getCurrentPlatform, getAllOSToolKeys } from './os-whitelist'
import {
  confirmOSToolExecution,
  rejectOSToolExecution,
  getPendingConfirmation,
  getPendingConfirmationsForSession,
  cleanupOldConfirmations
} from './os-executor'

/**
 * GET /os-tools
 * List all available OS tools with platform support info
 */
export function handleGetOSTools(
  _req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const platform = getCurrentPlatform()
  const tools = getAllOSToolKeys().map(key => {
    const config = OS_TOOLS_WHITELIST[key]
    const platformSupported = config.platforms[platform] !== undefined
    return {
      capabilityKey: key,
      displayName: config.displayName,
      description: config.description,
      riskLevel: config.riskLevel,
      requiresConfirmation: config.requiresConfirmation,
      platformSupported,
      currentPlatform: platform
    }
  })

  ok(res, {
    success: true,
    tools,
    platform
  })
}

/**
 * GET /os-tools/pending
 * List pending confirmations for current session
 */
export function handleGetPendingConfirmations(
  _req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null,
  sessionId?: string
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  if (!sessionId) {
    badRequest(res, 'sessionId required')
    return
  }

  const pending = getPendingConfirmationsForSession(context.tenant.id, sessionId)

  ok(res, {
    success: true,
    pending
  })
}

/**
 * POST /os-tools/confirm
 * Confirm or reject a pending OS tool execution
 */
export function handleConfirmOSTool(
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

  req.on('end', async () => {
    let input: OSToolConfirmRequest

    try {
      input = JSON.parse(body)
    } catch (_e) {
      badRequest(res, 'Invalid JSON body')
      return
    }

    const { confirmationId, action } = input

    if (!confirmationId) {
      badRequest(res, 'confirmationId required')
      return
    }

    if (!action || !['confirm', 'reject'].includes(action)) {
      badRequest(res, 'action must be "confirm" or "reject"')
      return
    }

    // Get the pending confirmation
    const confirmation = getPendingConfirmation(confirmationId)
    if (!confirmation) {
      badRequest(res, 'Confirmation not found or expired')
      return
    }

    // Verify tenant ownership
    if (confirmation.tenantId !== context.tenant.id) {
      unauthorized(res, 'Not authorized to confirm this action')
      return
    }

    if (confirmation.status !== 'pending') {
      badRequest(res, `Confirmation already ${confirmation.status}`)
      return
    }

    if (action === 'reject') {
      rejectOSToolExecution(confirmationId)
      ok(res, {
        success: true,
        message: `${confirmation.displayName} fue rechazado`,
        status: 'rejected'
      })
      return
    }

    // Execute
    const result = await confirmOSToolExecution(confirmationId)
    if (!result) {
      badRequest(res, 'Failed to execute OS tool')
      return
    }

    if (result.success) {
      ok(res, {
        success: true,
        message: `${confirmation.displayName} ejecutado correctamente`,
        result
      })
    } else {
      ok(res, {
        success: false,
        error: result.error,
        message: `Error al ejecutar ${confirmation.displayName}: ${result.error}`,
        result
      })
    }
  })
}

/**
 * POST /os-tools/cleanup
 * Clean up old confirmations
 */
export function handleCleanupOSTools(
  _req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const deleted = cleanupOldConfirmations()

  ok(res, {
    success: true,
    message: `Cleaned up ${deleted} old confirmations`,
    deleted
  })
}
