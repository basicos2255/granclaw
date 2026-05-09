/**
 * OpenClaw Auth Lifecycle
 * P6.4R: Persistent Pairing, Auth Lifecycle & Route Consistency
 *
 * Manages the full authentication lifecycle with OpenClaw.
 */

import {
  updateConnectionState,
  updateAuthState,
  updateCapabilityState,
  recordSuccessfulExecution,
  recordScopeNeedsAuth,
  clearScopeAuth,
  getAuthState,
  getAuthHealth,
  processEvent
} from './pairing-state'
import { loadAuthState, saveAuthState, resetAuthState } from './persistence'
import type {
  OpenClawAuthState,
  OpenClawAuthData,
  OpenClawHealthResponse
} from './types'

// =============================================================================
// Connection Management
// =============================================================================

/**
 * Check connection to OpenClaw
 */
export async function checkConnection(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
  updateConnectionState('checking')

  try {
    const start = Date.now()

    // Try to reach OpenClaw health endpoint
    // In real implementation, this would be an actual HTTP call
    // For now, we check if the system-state has OpenClaw configured
    const systemState = await getOpenClawConfig()

    if (!systemState.baseUrl) {
      return {
        connected: false,
        error: 'OpenClaw URL not configured'
      }
    }

    // Simulate ping check
    const latencyMs = Date.now() - start

    updateConnectionState('connected', { success: true, latencyMs })

    return { connected: true, latencyMs }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown connection error'
    updateConnectionState('disconnected', { success: false, error })
    return { connected: false, error }
  }
}

/**
 * Get OpenClaw configuration from system-state
 */
async function getOpenClawConfig(): Promise<{ baseUrl?: string; apiKey?: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const systemState = require('../system-state')
    const state = systemState.getSystemState?.() || {}
    return {
      baseUrl: state.openclawUrl,
      apiKey: state.openclawApiKey
    }
  } catch {
    return {}
  }
}

// =============================================================================
// Auth Check
// =============================================================================

/**
 * Check authentication status with OpenClaw
 */
export async function checkAuth(): Promise<{ authenticated: boolean; error?: string }> {
  updateAuthState('checking')

  try {
    const config = await getOpenClawConfig()

    if (!config.apiKey) {
      updateAuthState('unpaired', { success: false, error: 'No API key configured' })
      return { authenticated: false, error: 'No API key configured' }
    }

    // In real implementation, verify API key with OpenClaw
    // For now, assume valid if key exists
    updateAuthState('paired', { success: true })
    return { authenticated: true }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Auth check failed'
    updateAuthState('error', { success: false, error })
    return { authenticated: false, error }
  }
}

// =============================================================================
// Capability Check
// =============================================================================

/**
 * Check capability health
 */
export async function checkCapabilities(): Promise<{ healthy: boolean; scopesNeedingAuth: string[] }> {
  updateCapabilityState('checking')

  try {
    // Get scopes that need re-auth from auth-check service
    let scopesNeedingAuth: string[] = []

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const authCheck = require('../../services/auth-check.service')
      if (authCheck.getScopesNeedingAuth) {
        scopesNeedingAuth = authCheck.getScopesNeedingAuth()
      }
    } catch {
      // Auth check service not available
    }

    if (scopesNeedingAuth.length > 0) {
      updateCapabilityState('degraded', scopesNeedingAuth)
      return { healthy: false, scopesNeedingAuth }
    }

    updateCapabilityState('healthy', [])
    return { healthy: true, scopesNeedingAuth: [] }
  } catch (err) {
    console.error('[OpenClawAuth] Capability check error:', err)
    updateCapabilityState('error')
    return { healthy: false, scopesNeedingAuth: [] }
  }
}

// =============================================================================
// Full Health Check
// =============================================================================

/**
 * Run full health check (connection + auth + capabilities)
 */
export async function runAuthHealthCheck(): Promise<OpenClawHealthResponse> {
  console.log('[OpenClawAuth] Running full health check...')

  // 1. Check connection
  const connResult = await checkConnection()
  if (!connResult.connected) {
    return getAuthHealth()
  }

  // 2. Check auth
  const authResult = await checkAuth()
  if (!authResult.authenticated) {
    return getAuthHealth()
  }

  // 3. Check capabilities
  await checkCapabilities()

  console.log('[OpenClawAuth] Health check complete')
  return getAuthHealth()
}

// =============================================================================
// Lifecycle Events
// =============================================================================

/**
 * Handle successful capability execution
 */
export function onSuccessfulExecution(context?: { scopeKey?: string }): void {
  recordSuccessfulExecution()

  // If we had a scope that needed auth and it's now working, clear it
  if (context?.scopeKey) {
    clearScopeAuth(context.scopeKey)
  }
}

/**
 * Handle scope auth failure
 */
export function onScopeAuthFailure(scopeKey: string): void {
  recordScopeNeedsAuth(scopeKey)
}

/**
 * Handle scope auth restored
 */
export function onScopeAuthRestored(scopeKey: string): void {
  clearScopeAuth(scopeKey)
}

// =============================================================================
// Repair Session
// =============================================================================

/**
 * Start repair session
 */
export function startRepairSession(): { sessionId: string; repairUrl: string } {
  const state = loadAuthState()
  const sessionId = `repair-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  state.activeRepairSessionId = sessionId
  saveAuthState(state)

  processEvent('repair_started', sessionId)

  // Generate repair URL (would be OpenClaw auth URL in production)
  const repairUrl = `/openclaw/repair/${sessionId}`

  return { sessionId, repairUrl }
}

/**
 * Complete repair session
 */
export function completeRepairSession(success: boolean): OpenClawAuthData {
  const state = loadAuthState()
  const sessionId = state.activeRepairSessionId
  state.activeRepairSessionId = undefined

  if (success) {
    state.scopesNeedingAuth = []
    state.capability = 'healthy'
    state.auth = 'paired'
    saveAuthState(state)
    return processEvent('repair_completed', sessionId)
  } else {
    saveAuthState(state)
    return processEvent('repair_failed', sessionId)
  }
}

// =============================================================================
// State Management
// =============================================================================

/**
 * Reset all auth state
 */
export function resetAllAuthState(): OpenClawAuthData {
  processEvent('reset')
  return resetAuthState()
}

/**
 * Get current overall state
 */
export function getOverallState(): OpenClawAuthState {
  return getAuthState().overall
}

/**
 * Check if pairing is healthy
 */
export function isPairingHealthy(): boolean {
  return getAuthState().overall === 'paired'
}

/**
 * Check if execution is allowed
 */
export function canExecuteCapabilities(): boolean {
  const state = getAuthState().overall
  return state === 'paired' || state === 'degraded'
}
