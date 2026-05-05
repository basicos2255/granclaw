/**
 * System State Routes
 * FIX 123: OpenClaw Persistent Setup & Pairing Flow
 * FIX 123.1: OpenClaw Setup Hardening & Scoped Reauthorization
 *
 * API endpoints for system state management.
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { ok } from '../../shared/response'
import type { AuthContext } from '../auth'
import {
  getSystemState,
  getPendingAction,
  clearPendingAction,
  consumePendingAction,
  getActiveRequirements,
  resolveAllRequirements
} from './service'
import { checkOpenClawAuth } from '../openclaw/auth-check.service'

/**
 * GET /system/state
 * Get current system state
 * FIX 123.1: Include granular requirements
 */
export function handleGetSystemState(
  _req: IncomingMessage,
  res: ServerResponse,
  _context: AuthContext | null
): void {
  const state = getSystemState()
  const activeRequirements = getActiveRequirements()

  ok(res, {
    success: true,
    data: {
      openclawRequiresSetup: state.openclawRequiresSetup,
      openclawSetupStatus: state.openclawSetupStatus,
      lastError: state.lastError,
      lastChecked: state.lastChecked,
      lastSuccessfulExecution: state.lastSuccessfulExecution,
      hasPendingAction: !!state.pendingAction,
      pendingActionInput: state.pendingAction?.input?.substring(0, 100),
      // FIX 123.1: Granular requirements
      activeRequirements,
      activeRequirementCount: activeRequirements.length
    }
  })
}

/**
 * GET /system/pending-action
 * Get pending action details
 * FIX 123.1: Include scopeKey
 */
export function handleGetPendingAction(
  _req: IncomingMessage,
  res: ServerResponse,
  _context: AuthContext | null
): void {
  const action = getPendingAction()

  ok(res, {
    success: true,
    data: action ? {
      input: action.input,
      tenantId: action.tenantId,
      userId: action.userId,
      timestamp: action.timestamp,
      capabilityKey: action.capabilityKey,
      scopeKey: action.scopeKey,
      age: Date.now() - action.timestamp
    } : null
  })
}

/**
 * POST /system/clear-pending-action
 * Clear pending action
 */
export function handleClearPendingAction(
  _req: IncomingMessage,
  res: ServerResponse,
  _context: AuthContext | null
): void {
  clearPendingAction()

  ok(res, {
    success: true,
    message: 'Pending action cleared'
  })
}

/**
 * POST /system/consume-pending-action
 * Get and clear pending action
 */
export function handleConsumePendingAction(
  _req: IncomingMessage,
  res: ServerResponse,
  _context: AuthContext | null
): void {
  const action = consumePendingAction()

  ok(res, {
    success: true,
    data: action || null
  })
}

/**
 * POST /system/mark-openclaw-ready
 * FIX 123.1: Verified-only - must pass real auth check before marking ready
 * No longer allows manual marking without verification
 */
export async function handleMarkOpenClawReady(
  _req: IncomingMessage,
  res: ServerResponse,
  _context: AuthContext | null
): Promise<void> {
  console.log('[SystemState] mark-openclaw-ready requested - running verification')

  try {
    // FIX 123.1: Must verify before marking ready
    const authStatus = await checkOpenClawAuth()

    const wsOk = authStatus.ws === 'ok'
    const restOk = authStatus.rest === 'ok'
    const toolsOk = authStatus.tools === 'ok'

    // At least WS and one other surface must be OK
    if (wsOk && (restOk || toolsOk)) {
      const resolvedCount = resolveAllRequirements()
      console.log(`[SystemState] Verification passed - resolved ${resolvedCount} requirements`)

      ok(res, {
        success: true,
        verified: true,
        message: 'OpenClaw verified and marked as ready',
        resolvedCount,
        authStatus: {
          ws: authStatus.ws,
          rest: authStatus.rest,
          tools: authStatus.tools
        }
      })
    } else {
      // Verification failed - cannot mark ready
      console.log('[SystemState] Verification failed - cannot mark ready')
      const activeRequirements = getActiveRequirements()

      ok(res, {
        success: false,
        verified: false,
        message: 'Verification failed - OpenClaw not ready',
        authStatus: {
          ws: authStatus.ws,
          rest: authStatus.rest,
          tools: authStatus.tools
        },
        details: authStatus.details,
        activeRequirements
      })
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[SystemState] Verification error:', errorMsg)

    ok(res, {
      success: false,
      verified: false,
      message: 'Verification failed with error',
      error: errorMsg,
      activeRequirements: getActiveRequirements()
    })
  }
}
