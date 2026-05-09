/**
 * Pairing State Sync
 * P6.4: Persistent Pairing, Auth Lifecycle & Route Consistency
 *
 * Syncs pairing state with OpenClaw auth check and system-state module.
 */

import { checkOpenClawAuth, type AuthCheckResponse } from '../openclaw/auth-check.service'
import {
  getPairingState,
  updateConnectionState,
  updateAuthState,
  updateCapabilityState,
  recordSuccessfulExecution as pairingRecordSuccess,
  recordScopeNeedsAuth,
  clearScopeAuth,
  getPairingHealth
} from './service'
import type { PairingHealthResponse } from './types'
import {
  getActiveRequirements,
  recordSuccessfulExecution as systemRecordSuccess,
  addSetupRequirement,
  resolveSetupRequirement,
  type OpenClawScopeKey
} from '../system-state'

/**
 * Run a full health check and sync pairing state
 */
export async function runPairingHealthCheck(): Promise<PairingHealthResponse> {
  console.log('[PairingSync] Running health check...')

  // Mark as checking
  updateConnectionState('checking')

  try {
    const authResult = await checkOpenClawAuth()
    syncAuthResultToPairingState(authResult)

    // Also sync with system-state
    syncWithSystemState(authResult)

    console.log('[PairingSync] Health check complete')
    return getPairingHealth()
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[PairingSync] Health check error:', errorMsg)

    updateConnectionState('error', { success: false, error: errorMsg })
    return getPairingHealth()
  }
}

/**
 * Sync auth check result to pairing state
 */
function syncAuthResultToPairingState(authResult: AuthCheckResponse): void {
  // Connection state
  const connectionOk = authResult.rest === 'ok' || authResult.ws === 'ok' || authResult.tools === 'ok'
  const connectionFailed = authResult.rest === 'fail' && authResult.ws === 'fail' && authResult.tools === 'fail'

  if (connectionOk) {
    updateConnectionState('connected', {
      success: true,
      latencyMs: undefined // Could add timing later
    })
  } else if (connectionFailed) {
    const error = authResult.details.restError || authResult.details.wsError || authResult.details.toolsError
    updateConnectionState('disconnected', {
      success: false,
      error
    })
    return // No point checking auth if disconnected
  }

  // Auth state - WS handshake is primary auth indicator
  const wsAuthOk = authResult.ws === 'ok' && authResult.details.wsHandshakeComplete
  const restAuthOk = authResult.rest === 'ok'
  const toolsAuthOk = authResult.tools === 'ok'

  if (wsAuthOk || (restAuthOk && toolsAuthOk)) {
    updateAuthState('paired', { success: true })
  } else if (authResult.ws === 'fail' || authResult.rest === 'fail' || authResult.tools === 'fail') {
    const error = authResult.details.wsError || authResult.details.restError || authResult.details.toolsError
    updateAuthState('unpaired', { success: false, error })
  }

  // Capability state - if auth is OK, check for specific scope issues
  // For now, if auth passes, capabilities are healthy
  // Scope-specific issues are tracked separately via recordScopeNeedsAuth
  const state = getPairingState()
  if (state.auth === 'paired' && state.scopesNeedingAuth.length === 0) {
    updateCapabilityState('healthy', [])
  } else if (state.scopesNeedingAuth.length > 0) {
    updateCapabilityState('degraded', state.scopesNeedingAuth)
  }
}

/**
 * Sync with system-state module for backwards compatibility
 */
function syncWithSystemState(authResult: AuthCheckResponse): void {
  const wsOk = authResult.ws === 'ok' && authResult.details.wsHandshakeComplete
  const restOk = authResult.rest === 'ok'
  const toolsOk = authResult.tools === 'ok'

  if (wsOk && (restOk || toolsOk)) {
    // Auth is good - resolve any active requirements
    systemRecordSuccess()
  }
}

/**
 * Record a successful execution and sync states
 */
export function syncSuccessfulExecution(params?: {
  scopeKey?: OpenClawScopeKey
  capabilityKey?: string
}): void {
  // Update pairing state
  pairingRecordSuccess()

  // Update system state with scope info
  if (params) {
    systemRecordSuccess(params)
  } else {
    systemRecordSuccess()
  }

  // Clear scope from pairing state if specified
  if (params?.scopeKey) {
    clearScopeAuth(params.scopeKey)
  }
}

/**
 * Record a scope auth failure and sync states
 */
export function syncScopeAuthFailure(params: {
  scopeKey: OpenClawScopeKey
  capabilityKey?: string
  reason: string
  originalError?: string
}): void {
  // Update pairing state
  recordScopeNeedsAuth(params.scopeKey)

  // Update system state
  addSetupRequirement({
    scopeKey: params.scopeKey,
    capabilityKey: params.capabilityKey,
    reason: params.reason,
    originalError: params.originalError
  })
}

/**
 * Resolve a scope auth requirement and sync states
 */
export function syncScopeAuthResolved(params: {
  scopeKey?: OpenClawScopeKey
  capabilityKey?: string
  id?: string
}): void {
  // Update pairing state
  if (params.scopeKey) {
    clearScopeAuth(params.scopeKey)
  }

  // Update system state
  resolveSetupRequirement(params)
}

/**
 * Get combined health status from both state systems
 */
export function getCombinedHealthStatus(): {
  pairing: PairingHealthResponse
  systemState: {
    requiresSetup: boolean
    activeRequirements: ReturnType<typeof getActiveRequirements>
  }
  consistent: boolean
} {
  const pairing = getPairingHealth()
  const activeRequirements = getActiveRequirements()
  const requiresSetup = activeRequirements.length > 0

  // Check consistency between the two state systems
  const pairingBlockedOrDegraded = pairing.overall === 'blocked' || pairing.overall === 'degraded'
  const consistent = pairingBlockedOrDegraded === requiresSetup

  return {
    pairing,
    systemState: {
      requiresSetup,
      activeRequirements
    },
    consistent
  }
}
