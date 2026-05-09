/**
 * OpenClaw Auth Handlers
 * P6.4R: Persistent Pairing, Auth Lifecycle & Route Consistency
 *
 * HTTP handlers for native HTTP server (not Express).
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { getAuthHealth, getAuthState } from './pairing-state'
import { runAuthHealthCheck, resetAllAuthState, canExecuteCapabilities } from './auth-lifecycle'
import { isCapabilityActuallyUsable, preExecutionCheck, getScopesNeedingAuth } from './capability-check'
import { reloadAuthState, getStateFilePath, stateFileExists } from './persistence'
import {
  createRepairSession,
  getActiveRepairSession,
  getRepairSession,
  startRepairSession,
  completeRepairSession,
  failRepairSession,
  cancelRepairSession,
  quickRepair
} from './repair-flow'
import { getQuickSessionStatus, refreshSession, runStartupCheck } from './session-check'

// =============================================================================
// Helpers
// =============================================================================

function sendJson(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function sendError(res: ServerResponse, message: string, status = 500): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ success: false, error: message }))
}

function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      if (!body) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

// =============================================================================
// Health Endpoints
// =============================================================================

/**
 * GET /openclaw/health
 */
export function handleGetOpenClawHealth(_req: IncomingMessage, res: ServerResponse): void {
  try {
    const health = getAuthHealth()
    sendJson(res, { success: true, data: health })
  } catch (err) {
    console.error('[OpenClawAuth] Health error:', err)
    sendError(res, 'Failed to get OpenClaw health')
  }
}

/**
 * GET /openclaw/status
 */
export function handleGetOpenClawStatus(_req: IncomingMessage, res: ServerResponse): void {
  try {
    const status = getQuickSessionStatus()
    sendJson(res, { success: true, data: status })
  } catch (err) {
    console.error('[OpenClawAuth] Status error:', err)
    sendError(res, 'Failed to get OpenClaw status')
  }
}

/**
 * GET /openclaw/state
 */
export function handleGetOpenClawState(_req: IncomingMessage, res: ServerResponse): void {
  try {
    const state = getAuthState()
    sendJson(res, {
      success: true,
      data: {
        ...state,
        stateFile: getStateFilePath(),
        stateFileExists: stateFileExists()
      }
    })
  } catch (err) {
    console.error('[OpenClawAuth] State error:', err)
    sendError(res, 'Failed to get OpenClaw state')
  }
}

// =============================================================================
// Check Endpoints
// =============================================================================

/**
 * POST /openclaw/check
 */
export async function handleOpenClawCheck(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const health = await runAuthHealthCheck()
    sendJson(res, { success: true, data: health })
  } catch (err) {
    console.error('[OpenClawAuth] Check error:', err)
    sendError(res, 'Failed to run OpenClaw check')
  }
}

/**
 * POST /openclaw/refresh
 */
export async function handleOpenClawRefresh(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const health = await refreshSession()
    sendJson(res, { success: true, data: health })
  } catch (err) {
    console.error('[OpenClawAuth] Refresh error:', err)
    sendError(res, 'Failed to refresh OpenClaw session')
  }
}

// =============================================================================
// Capability Endpoints
// =============================================================================

/**
 * GET /openclaw/capability/:scopeKey
 */
export function handleGetCapabilityUsable(_req: IncomingMessage, res: ServerResponse, scopeKey: string): void {
  try {
    const result = isCapabilityActuallyUsable(scopeKey)
    sendJson(res, { success: true, data: result })
  } catch (err) {
    console.error('[OpenClawAuth] Capability check error:', err)
    sendError(res, 'Failed to check capability')
  }
}

/**
 * GET /openclaw/can-execute
 */
export function handleCanExecute(_req: IncomingMessage, res: ServerResponse): void {
  try {
    const canExecute = canExecuteCapabilities()
    const health = getAuthHealth()
    sendJson(res, {
      success: true,
      data: {
        canExecute,
        state: health.overall,
        issues: health.issues
      }
    })
  } catch (err) {
    console.error('[OpenClawAuth] Can-execute error:', err)
    sendError(res, 'Failed to check execution capability')
  }
}

/**
 * POST /openclaw/pre-check
 */
export async function handlePreCheck(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const body = await parseBody(req)
    const scopeKey = body.scopeKey as string | undefined
    const result = preExecutionCheck(scopeKey)
    sendJson(res, { success: true, data: result })
  } catch (err) {
    console.error('[OpenClawAuth] Pre-check error:', err)
    sendError(res, 'Failed to run pre-check')
  }
}

/**
 * GET /openclaw/scopes-needing-auth
 */
export function handleGetScopesNeedingAuth(_req: IncomingMessage, res: ServerResponse): void {
  try {
    const scopes = getScopesNeedingAuth()
    sendJson(res, { success: true, data: { scopes } })
  } catch (err) {
    console.error('[OpenClawAuth] Scopes error:', err)
    sendError(res, 'Failed to get scopes needing auth')
  }
}

// =============================================================================
// Repair Endpoints
// =============================================================================

/**
 * POST /openclaw/repair
 */
export async function handleCreateRepair(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const body = await parseBody(req)
    const scope = body.scope as string | undefined
    const type = body.type as 'full' | 'scope' | undefined
    const session = createRepairSession({
      type: type || (scope ? 'scope' : 'full'),
      targetScope: scope
    })
    sendJson(res, { success: true, data: session })
  } catch (err) {
    console.error('[OpenClawAuth] Create repair error:', err)
    sendError(res, 'Failed to create repair session')
  }
}

/**
 * GET /openclaw/repair/active
 */
export function handleGetActiveRepair(_req: IncomingMessage, res: ServerResponse): void {
  try {
    const session = getActiveRepairSession()
    sendJson(res, { success: true, data: session })
  } catch (err) {
    console.error('[OpenClawAuth] Active repair error:', err)
    sendError(res, 'Failed to get active repair')
  }
}

/**
 * GET /openclaw/repair/:sessionId
 */
export function handleGetRepairById(_req: IncomingMessage, res: ServerResponse, sessionId: string): void {
  try {
    const session = getRepairSession(sessionId)
    if (!session) {
      sendError(res, 'Repair session not found or expired', 404)
      return
    }
    sendJson(res, { success: true, data: session })
  } catch (err) {
    console.error('[OpenClawAuth] Get repair error:', err)
    sendError(res, 'Failed to get repair session')
  }
}

/**
 * POST /openclaw/repair/:sessionId/start
 */
export function handleStartRepairById(_req: IncomingMessage, res: ServerResponse, sessionId: string): void {
  try {
    const started = startRepairSession(sessionId)
    if (!started) {
      sendError(res, 'Cannot start repair session', 400)
      return
    }
    sendJson(res, { success: true, data: { sessionId, status: 'in_progress' } })
  } catch (err) {
    console.error('[OpenClawAuth] Start repair error:', err)
    sendError(res, 'Failed to start repair')
  }
}

/**
 * POST /openclaw/repair/:sessionId/complete
 */
export async function handleCompleteRepairById(req: IncomingMessage, res: ServerResponse, sessionId: string): Promise<void> {
  try {
    const body = await parseBody(req)
    const health = await completeRepairSession(sessionId, {
      newApiKey: body.newApiKey as string | undefined,
      refreshedScopes: body.refreshedScopes as string[] | undefined
    })
    sendJson(res, { success: true, data: health })
  } catch (err) {
    console.error('[OpenClawAuth] Complete repair error:', err)
    sendError(res, 'Failed to complete repair')
  }
}

/**
 * POST /openclaw/repair/:sessionId/fail
 */
export async function handleFailRepairById(req: IncomingMessage, res: ServerResponse, sessionId: string): Promise<void> {
  try {
    const body = await parseBody(req)
    failRepairSession(sessionId, (body.error as string) || 'Unknown error')
    sendJson(res, { success: true, data: { sessionId, status: 'failed' } })
  } catch (err) {
    console.error('[OpenClawAuth] Fail repair error:', err)
    sendError(res, 'Failed to fail repair')
  }
}

/**
 * DELETE /openclaw/repair/:sessionId
 */
export function handleCancelRepairById(_req: IncomingMessage, res: ServerResponse, sessionId: string): void {
  try {
    cancelRepairSession(sessionId)
    sendJson(res, { success: true, data: { sessionId, status: 'cancelled' } })
  } catch (err) {
    console.error('[OpenClawAuth] Cancel repair error:', err)
    sendError(res, 'Failed to cancel repair')
  }
}

/**
 * GET /openclaw/quick-repair
 */
export function handleQuickRepair(req: IncomingMessage, res: ServerResponse): void {
  try {
    const url = new URL(req.url || '/', `http://localhost`)
    const scope = url.searchParams.get('scope') || undefined
    const result = quickRepair(scope)
    sendJson(res, { success: true, data: result })
  } catch (err) {
    console.error('[OpenClawAuth] Quick repair error:', err)
    sendError(res, 'Failed to create quick repair')
  }
}

// =============================================================================
// Admin Endpoints
// =============================================================================

/**
 * POST /openclaw/reset
 */
export function handleOpenClawReset(_req: IncomingMessage, res: ServerResponse): void {
  try {
    const state = resetAllAuthState()
    sendJson(res, { success: true, data: state })
  } catch (err) {
    console.error('[OpenClawAuth] Reset error:', err)
    sendError(res, 'Failed to reset OpenClaw state')
  }
}

/**
 * POST /openclaw/reload
 */
export function handleOpenClawReload(_req: IncomingMessage, res: ServerResponse): void {
  try {
    const state = reloadAuthState()
    sendJson(res, { success: true, data: state })
  } catch (err) {
    console.error('[OpenClawAuth] Reload error:', err)
    sendError(res, 'Failed to reload OpenClaw state')
  }
}

// =============================================================================
// Startup
// =============================================================================

/**
 * Run startup check
 */
export { runStartupCheck as runOpenClawStartupCheck }
