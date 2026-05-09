/**
 * OpenClaw Auth Routes
 * P6.4R: Persistent Pairing, Auth Lifecycle & Route Consistency
 *
 * HTTP endpoints for OpenClaw authentication and health.
 */

import { Router, Request, Response } from 'express'
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
import { getQuickSessionStatus, refreshSession } from './session-check'

const router = Router()

// =============================================================================
// Health Endpoints
// =============================================================================

/**
 * GET /openclaw/health
 * Returns OpenClaw auth health status
 */
router.get('/health', (_req: Request, res: Response) => {
  try {
    const health = getAuthHealth()
    res.json({
      success: true,
      data: health
    })
  } catch (err) {
    console.error('[OpenClawAuth] Health endpoint error:', err)
    res.status(500).json({
      success: false,
      error: 'Failed to get OpenClaw health'
    })
  }
})

/**
 * GET /openclaw/status
 * Quick status check (no network calls)
 */
router.get('/status', (_req: Request, res: Response) => {
  try {
    const status = getQuickSessionStatus()
    res.json({
      success: true,
      data: status
    })
  } catch (err) {
    console.error('[OpenClawAuth] Status endpoint error:', err)
    res.status(500).json({
      success: false,
      error: 'Failed to get OpenClaw status'
    })
  }
})

/**
 * GET /openclaw/state
 * Returns full auth state (for debugging)
 */
router.get('/state', (_req: Request, res: Response) => {
  try {
    const state = getAuthState()
    res.json({
      success: true,
      data: {
        ...state,
        stateFile: getStateFilePath(),
        stateFileExists: stateFileExists()
      }
    })
  } catch (err) {
    console.error('[OpenClawAuth] State endpoint error:', err)
    res.status(500).json({
      success: false,
      error: 'Failed to get OpenClaw state'
    })
  }
})

// =============================================================================
// Check Endpoints
// =============================================================================

/**
 * POST /openclaw/check
 * Run full health check (with network calls)
 */
router.post('/check', async (_req: Request, res: Response) => {
  try {
    const health = await runAuthHealthCheck()
    res.json({
      success: true,
      data: health
    })
  } catch (err) {
    console.error('[OpenClawAuth] Check endpoint error:', err)
    res.status(500).json({
      success: false,
      error: 'Failed to run OpenClaw health check'
    })
  }
})

/**
 * POST /openclaw/refresh
 * Refresh session (alias for check)
 */
router.post('/refresh', async (_req: Request, res: Response) => {
  try {
    const health = await refreshSession()
    res.json({
      success: true,
      data: health
    })
  } catch (err) {
    console.error('[OpenClawAuth] Refresh endpoint error:', err)
    res.status(500).json({
      success: false,
      error: 'Failed to refresh OpenClaw session'
    })
  }
})

// =============================================================================
// Capability Endpoints
// =============================================================================

/**
 * GET /openclaw/capability/:scopeKey
 * Check if a specific capability is usable
 */
router.get('/capability/:scopeKey', (req: Request, res: Response) => {
  try {
    const { scopeKey } = req.params
    const result = isCapabilityActuallyUsable(scopeKey)
    res.json({
      success: true,
      data: result
    })
  } catch (err) {
    console.error('[OpenClawAuth] Capability check error:', err)
    res.status(500).json({
      success: false,
      error: 'Failed to check capability'
    })
  }
})

/**
 * GET /openclaw/can-execute
 * Quick check if any execution is allowed
 */
router.get('/can-execute', (_req: Request, res: Response) => {
  try {
    const canExecute = canExecuteCapabilities()
    const health = getAuthHealth()
    res.json({
      success: true,
      data: {
        canExecute,
        state: health.overall,
        issues: health.issues
      }
    })
  } catch (err) {
    console.error('[OpenClawAuth] Can-execute check error:', err)
    res.status(500).json({
      success: false,
      error: 'Failed to check execution capability'
    })
  }
})

/**
 * POST /openclaw/pre-check
 * Pre-execution check with optional scope
 */
router.post('/pre-check', (req: Request, res: Response) => {
  try {
    const { scopeKey } = req.body || {}
    const result = preExecutionCheck(scopeKey)
    res.json({
      success: true,
      data: result
    })
  } catch (err) {
    console.error('[OpenClawAuth] Pre-check error:', err)
    res.status(500).json({
      success: false,
      error: 'Failed to run pre-execution check'
    })
  }
})

/**
 * GET /openclaw/scopes-needing-auth
 * Get list of scopes that need re-authorization
 */
router.get('/scopes-needing-auth', (_req: Request, res: Response) => {
  try {
    const scopes = getScopesNeedingAuth()
    res.json({
      success: true,
      data: { scopes }
    })
  } catch (err) {
    console.error('[OpenClawAuth] Scopes check error:', err)
    res.status(500).json({
      success: false,
      error: 'Failed to get scopes needing auth'
    })
  }
})

// =============================================================================
// Repair Endpoints
// =============================================================================

/**
 * POST /openclaw/repair
 * Start a new repair session
 */
router.post('/repair', (req: Request, res: Response) => {
  try {
    const { scope, type } = req.body || {}
    const session = createRepairSession({
      type: type || (scope ? 'scope' : 'full'),
      targetScope: scope
    })
    res.json({
      success: true,
      data: session
    })
  } catch (err) {
    console.error('[OpenClawAuth] Repair create error:', err)
    res.status(500).json({
      success: false,
      error: 'Failed to create repair session'
    })
  }
})

/**
 * GET /openclaw/repair/active
 * Get active repair session
 */
router.get('/repair/active', (_req: Request, res: Response) => {
  try {
    const session = getActiveRepairSession()
    res.json({
      success: true,
      data: session
    })
  } catch (err) {
    console.error('[OpenClawAuth] Active repair error:', err)
    res.status(500).json({
      success: false,
      error: 'Failed to get active repair session'
    })
  }
})

/**
 * GET /openclaw/repair/:sessionId
 * Get repair session by ID
 */
router.get('/repair/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params
    const session = getRepairSession(sessionId)
    if (!session) {
      res.status(404).json({
        success: false,
        error: 'Repair session not found or expired'
      })
      return
    }
    res.json({
      success: true,
      data: session
    })
  } catch (err) {
    console.error('[OpenClawAuth] Get repair error:', err)
    res.status(500).json({
      success: false,
      error: 'Failed to get repair session'
    })
  }
})

/**
 * POST /openclaw/repair/:sessionId/start
 * Start repair session
 */
router.post('/repair/:sessionId/start', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params
    const started = startRepairSession(sessionId)
    if (!started) {
      res.status(400).json({
        success: false,
        error: 'Cannot start repair session'
      })
      return
    }
    res.json({
      success: true,
      data: { sessionId, status: 'in_progress' }
    })
  } catch (err) {
    console.error('[OpenClawAuth] Start repair error:', err)
    res.status(500).json({
      success: false,
      error: 'Failed to start repair session'
    })
  }
})

/**
 * POST /openclaw/repair/:sessionId/complete
 * Complete repair session
 */
router.post('/repair/:sessionId/complete', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params
    const { newApiKey, refreshedScopes } = req.body || {}
    const health = await completeRepairSession(sessionId, { newApiKey, refreshedScopes })
    res.json({
      success: true,
      data: health
    })
  } catch (err) {
    console.error('[OpenClawAuth] Complete repair error:', err)
    res.status(500).json({
      success: false,
      error: 'Failed to complete repair session'
    })
  }
})

/**
 * POST /openclaw/repair/:sessionId/fail
 * Fail repair session
 */
router.post('/repair/:sessionId/fail', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params
    const { error } = req.body || {}
    failRepairSession(sessionId, error || 'Unknown error')
    res.json({
      success: true,
      data: { sessionId, status: 'failed' }
    })
  } catch (err) {
    console.error('[OpenClawAuth] Fail repair error:', err)
    res.status(500).json({
      success: false,
      error: 'Failed to fail repair session'
    })
  }
})

/**
 * DELETE /openclaw/repair/:sessionId
 * Cancel repair session
 */
router.delete('/repair/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params
    cancelRepairSession(sessionId)
    res.json({
      success: true,
      data: { sessionId, status: 'cancelled' }
    })
  } catch (err) {
    console.error('[OpenClawAuth] Cancel repair error:', err)
    res.status(500).json({
      success: false,
      error: 'Failed to cancel repair session'
    })
  }
})

/**
 * GET /openclaw/quick-repair
 * Quick repair - creates session and returns URL
 */
router.get('/quick-repair', (req: Request, res: Response) => {
  try {
    const { scope } = req.query
    const result = quickRepair(scope as string | undefined)
    res.json({
      success: true,
      data: result
    })
  } catch (err) {
    console.error('[OpenClawAuth] Quick repair error:', err)
    res.status(500).json({
      success: false,
      error: 'Failed to create quick repair'
    })
  }
})

// =============================================================================
// Admin Endpoints
// =============================================================================

/**
 * POST /openclaw/reset
 * Reset auth state to defaults
 */
router.post('/reset', (_req: Request, res: Response) => {
  try {
    const state = resetAllAuthState()
    res.json({
      success: true,
      data: state
    })
  } catch (err) {
    console.error('[OpenClawAuth] Reset error:', err)
    res.status(500).json({
      success: false,
      error: 'Failed to reset OpenClaw state'
    })
  }
})

/**
 * POST /openclaw/reload
 * Reload state from disk
 */
router.post('/reload', (_req: Request, res: Response) => {
  try {
    const state = reloadAuthState()
    res.json({
      success: true,
      data: state
    })
  } catch (err) {
    console.error('[OpenClawAuth] Reload error:', err)
    res.status(500).json({
      success: false,
      error: 'Failed to reload OpenClaw state'
    })
  }
})

export default router
