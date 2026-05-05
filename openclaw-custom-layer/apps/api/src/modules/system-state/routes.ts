/**
 * System State Routes
 * FIX 123: OpenClaw Persistent Setup & Pairing Flow
 *
 * API endpoints for system state management.
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { ok } from '../../shared/response'
import type { AuthContext } from '../auth'
import {
  getSystemState,
  markOpenClawReady,
  getPendingAction,
  clearPendingAction,
  consumePendingAction
} from './service'

/**
 * GET /system/state
 * Get current system state
 */
export function handleGetSystemState(
  _req: IncomingMessage,
  res: ServerResponse,
  _context: AuthContext | null
): void {
  const state = getSystemState()

  ok(res, {
    success: true,
    data: {
      openclawRequiresSetup: state.openclawRequiresSetup,
      openclawSetupStatus: state.openclawSetupStatus,
      lastError: state.lastError,
      lastChecked: state.lastChecked,
      lastSuccessfulExecution: state.lastSuccessfulExecution,
      hasPendingAction: !!state.pendingAction,
      pendingActionInput: state.pendingAction?.input?.substring(0, 100)
    }
  })
}

/**
 * GET /system/pending-action
 * Get pending action details
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
 * Manually mark OpenClaw as ready (after user confirms setup)
 */
export function handleMarkOpenClawReady(
  _req: IncomingMessage,
  res: ServerResponse,
  _context: AuthContext | null
): void {
  markOpenClawReady()

  ok(res, {
    success: true,
    message: 'OpenClaw marked as ready'
  })
}
