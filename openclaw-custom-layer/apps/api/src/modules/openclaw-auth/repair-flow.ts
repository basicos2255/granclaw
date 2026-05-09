/**
 * OpenClaw Repair Flow
 * P6.4R: Persistent Pairing, Auth Lifecycle & Route Consistency
 *
 * Handles repair and re-authorization flows.
 */

import { loadAuthState, saveAuthState } from './persistence'
import { processEvent, getAuthHealth } from './pairing-state'
import { runAuthHealthCheck } from './auth-lifecycle'
import { emitPairingRestored } from './ws-events'
import type { OpenClawHealthResponse } from './types'

// =============================================================================
// Repair Session Types
// =============================================================================

export interface RepairSession {
  sessionId: string
  createdAt: string
  expiresAt: string
  type: 'full' | 'scope'
  targetScope?: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'expired'
  repairUrl: string
}

// =============================================================================
// Active Sessions
// =============================================================================

const activeSessions = new Map<string, RepairSession>()

// Session expiration time (15 minutes)
const SESSION_EXPIRY_MS = 15 * 60 * 1000

// =============================================================================
// Session Creation
// =============================================================================

/**
 * Create a new repair session
 */
export function createRepairSession(options?: {
  type?: 'full' | 'scope'
  targetScope?: string
}): RepairSession {
  const sessionId = `repair-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_MS)

  const session: RepairSession = {
    sessionId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    type: options?.type || 'full',
    targetScope: options?.targetScope,
    status: 'pending',
    repairUrl: buildRepairUrl(sessionId, options?.targetScope)
  }

  // Store session
  activeSessions.set(sessionId, session)

  // Update state
  const state = loadAuthState()
  state.activeRepairSessionId = sessionId
  saveAuthState(state)

  processEvent('repair_started', sessionId)

  console.log(`[OpenClawAuth] Repair session created: ${sessionId}`)

  return session
}

/**
 * Build repair URL for OpenClaw re-auth
 */
function buildRepairUrl(sessionId: string, scope?: string): string {
  // In production, this would redirect to OpenClaw OAuth flow
  let url = `/api/openclaw/repair/${sessionId}`
  if (scope) {
    url += `?scope=${encodeURIComponent(scope)}`
  }
  return url
}

// =============================================================================
// Session Management
// =============================================================================

/**
 * Get active repair session
 */
export function getActiveRepairSession(): RepairSession | null {
  const state = loadAuthState()
  if (!state.activeRepairSessionId) {
    return null
  }

  const session = activeSessions.get(state.activeRepairSessionId)
  if (!session) {
    return null
  }

  // Check if expired
  if (new Date(session.expiresAt) < new Date()) {
    session.status = 'expired'
    return null
  }

  return session
}

/**
 * Get repair session by ID
 */
export function getRepairSession(sessionId: string): RepairSession | null {
  const session = activeSessions.get(sessionId)
  if (!session) {
    return null
  }

  // Check if expired
  if (new Date(session.expiresAt) < new Date()) {
    session.status = 'expired'
    return null
  }

  return session
}

/**
 * Start repair session (mark as in progress)
 */
export function startRepairSession(sessionId: string): boolean {
  const session = activeSessions.get(sessionId)
  if (!session || session.status !== 'pending') {
    return false
  }

  session.status = 'in_progress'
  return true
}

// =============================================================================
// Session Completion
// =============================================================================

/**
 * Complete repair session successfully
 */
export async function completeRepairSession(
  sessionId: string,
  result?: { newApiKey?: string; refreshedScopes?: string[] }
): Promise<OpenClawHealthResponse> {
  const session = activeSessions.get(sessionId)
  if (!session) {
    throw new Error(`Repair session not found: ${sessionId}`)
  }

  session.status = 'completed'

  // Update auth state
  const state = loadAuthState()
  state.activeRepairSessionId = undefined

  // Clear scopes that were repaired
  if (result?.refreshedScopes) {
    state.scopesNeedingAuth = state.scopesNeedingAuth.filter(
      s => !result.refreshedScopes!.includes(s)
    )
  } else if (session.type === 'full') {
    state.scopesNeedingAuth = []
  } else if (session.targetScope) {
    state.scopesNeedingAuth = state.scopesNeedingAuth.filter(
      s => s !== session.targetScope
    )
  }

  state.capability = state.scopesNeedingAuth.length > 0 ? 'degraded' : 'healthy'
  state.auth = 'paired'

  saveAuthState(state)
  processEvent('repair_completed', sessionId)

  // Emit WS event
  emitPairingRestored(state)

  console.log(`[OpenClawAuth] Repair session completed: ${sessionId}`)

  // Run full health check to verify
  return runAuthHealthCheck()
}

/**
 * Fail repair session
 */
export function failRepairSession(sessionId: string, error: string): void {
  const session = activeSessions.get(sessionId)
  if (!session) {
    return
  }

  session.status = 'failed'

  // Update state
  const state = loadAuthState()
  state.activeRepairSessionId = undefined
  saveAuthState(state)

  processEvent('repair_failed', `${sessionId}: ${error}`)

  console.log(`[OpenClawAuth] Repair session failed: ${sessionId} - ${error}`)
}

/**
 * Cancel repair session
 */
export function cancelRepairSession(sessionId: string): void {
  const session = activeSessions.get(sessionId)
  if (!session) {
    return
  }

  activeSessions.delete(sessionId)

  // Update state
  const state = loadAuthState()
  if (state.activeRepairSessionId === sessionId) {
    state.activeRepairSessionId = undefined
    saveAuthState(state)
  }

  console.log(`[OpenClawAuth] Repair session cancelled: ${sessionId}`)
}

// =============================================================================
// Quick Repair
// =============================================================================

/**
 * Quick repair - creates session and returns URL
 */
export function quickRepair(scope?: string): {
  sessionId: string
  repairUrl: string
} {
  const session = createRepairSession({
    type: scope ? 'scope' : 'full',
    targetScope: scope
  })

  return {
    sessionId: session.sessionId,
    repairUrl: session.repairUrl
  }
}

// =============================================================================
// Cleanup
// =============================================================================

/**
 * Clean up expired sessions
 */
export function cleanupExpiredSessions(): number {
  const now = new Date()
  let cleaned = 0

  for (const [sessionId, session] of activeSessions) {
    if (new Date(session.expiresAt) < now) {
      activeSessions.delete(sessionId)
      cleaned++
    }
  }

  if (cleaned > 0) {
    console.log(`[OpenClawAuth] Cleaned up ${cleaned} expired repair sessions`)
  }

  return cleaned
}

// Auto-cleanup every 5 minutes
setInterval(cleanupExpiredSessions, 5 * 60 * 1000)
