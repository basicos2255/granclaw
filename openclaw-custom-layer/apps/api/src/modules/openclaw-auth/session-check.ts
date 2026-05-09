/**
 * OpenClaw Session Check
 * P6.4R: Persistent Pairing, Auth Lifecycle & Route Consistency
 *
 * Validates and manages OpenClaw session state.
 */

import { loadAuthState } from './persistence'
import { checkConnection, checkAuth, runAuthHealthCheck } from './auth-lifecycle'
import type { OpenClawAuthState, OpenClawHealthResponse } from './types'

// =============================================================================
// Session Validation
// =============================================================================

/**
 * Quick check if session is valid (uses cached state)
 */
export function isSessionValid(): boolean {
  const state = loadAuthState()
  return state.overall === 'paired' || state.overall === 'degraded'
}

/**
 * Check if session is expired
 */
export function isSessionExpired(): boolean {
  const state = loadAuthState()
  return state.overall === 'expired' || state.auth === 'expired'
}

/**
 * Check if reauthorization is needed
 */
export function needsReauthorization(): boolean {
  const state = loadAuthState()
  return (
    state.overall === 'reauthorization_required' ||
    state.overall === 'expired' ||
    state.auth === 'unpaired' ||
    state.auth === 'expired'
  )
}

/**
 * Check if repair is needed
 */
export function needsRepair(): boolean {
  const state = loadAuthState()
  return state.overall === 'repair_required'
}

// =============================================================================
// Session Health
// =============================================================================

/**
 * Get quick session status (no network calls)
 */
export function getQuickSessionStatus(): {
  valid: boolean
  state: OpenClawAuthState
  canExecute: boolean
  needsAction: boolean
  action?: 'reauthorize' | 'repair' | 'connect'
} {
  const state = loadAuthState()

  const valid = state.overall === 'paired' || state.overall === 'degraded'
  const canExecute = valid
  const needsAction = !valid

  let action: 'reauthorize' | 'repair' | 'connect' | undefined
  if (state.overall === 'disconnected') {
    action = 'connect'
  } else if (state.overall === 'reauthorization_required' || state.overall === 'expired') {
    action = 'reauthorize'
  } else if (state.overall === 'repair_required') {
    action = 'repair'
  }

  return {
    valid,
    state: state.overall,
    canExecute,
    needsAction,
    action
  }
}

// =============================================================================
// Session Refresh
// =============================================================================

/**
 * Refresh session (runs full health check)
 */
export async function refreshSession(): Promise<OpenClawHealthResponse> {
  return runAuthHealthCheck()
}

/**
 * Quick connection check (faster than full refresh)
 */
export async function quickConnectionCheck(): Promise<boolean> {
  const result = await checkConnection()
  return result.connected
}

/**
 * Quick auth check (faster than full refresh)
 */
export async function quickAuthCheck(): Promise<boolean> {
  const result = await checkAuth()
  return result.authenticated
}

// =============================================================================
// Startup Check
// =============================================================================

/**
 * Run startup session validation (non-blocking)
 */
export async function runStartupCheck(): Promise<OpenClawHealthResponse> {
  console.log('[OpenClawAuth] Running startup session check...')

  try {
    const health = await runAuthHealthCheck()
    console.log(`[OpenClawAuth] Startup check result: ${health.overall}`)
    return health
  } catch (err) {
    console.warn('[OpenClawAuth] Startup check failed:', err)
    return {
      overall: 'unknown',
      connection: 'unknown',
      auth: 'unknown',
      capability: 'unknown',
      healthy: false,
      canExecute: false,
      issues: [{
        type: 'connection',
        severity: 'error',
        message: 'Startup check failed',
        canRepair: false
      }],
      repairAvailable: false
    }
  }
}
