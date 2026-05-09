/**
 * OpenClaw Pairing State Machine
 * P6.4R: Persistent Pairing, Auth Lifecycle & Route Consistency
 *
 * State machine for OpenClaw pairing lifecycle management.
 */

import type {
  OpenClawAuthState,
  OpenClawAuthEvent,
  OpenClawEventLog,
  ConnectionState,
  AuthState,
  CapabilityState,
  OpenClawAuthData,
  OpenClawHealthResponse,
  OpenClawIssue
} from './types'
import { STATE_TRANSITIONS } from './types'
import { loadAuthState, saveAuthState } from './persistence'
import { emitOpenClawEvent } from './ws-events'

// =============================================================================
// State Change Listeners
// =============================================================================

type StateChangeListener = (state: OpenClawAuthData) => void
const listeners: StateChangeListener[] = []

/**
 * Subscribe to state changes
 */
export function subscribeToAuthState(listener: StateChangeListener): () => void {
  listeners.push(listener)
  return () => {
    const index = listeners.indexOf(listener)
    if (index >= 0) {
      listeners.splice(index, 1)
    }
  }
}

/**
 * Notify all listeners of state change
 */
function notifyListeners(state: OpenClawAuthData): void {
  listeners.forEach(listener => {
    try {
      listener(state)
    } catch (err) {
      console.error('[OpenClawAuth] Listener error:', err)
    }
  })
}

// =============================================================================
// State Derivation
// =============================================================================

/**
 * Derive overall state from component states
 */
export function deriveOverallState(
  connection: ConnectionState,
  auth: AuthState,
  capability: CapabilityState
): OpenClawAuthState {
  // Error takes priority
  if (connection === 'error' || auth === 'error' || capability === 'error') {
    return 'repair_required'
  }

  // Disconnected takes priority
  if (connection === 'disconnected') {
    return 'disconnected'
  }

  // Unknown/checking states
  if (connection === 'unknown' || connection === 'checking') {
    return 'unknown'
  }

  // At this point, connection is 'connected'

  // Auth issues
  if (auth === 'unknown' || auth === 'checking') {
    return 'connected'
  }

  if (auth === 'expired') {
    return 'expired'
  }

  if (auth === 'unpaired') {
    return 'reauthorization_required'
  }

  // At this point, auth is 'paired'

  // Capability issues
  if (capability === 'blocked') {
    return 'repair_required'
  }

  if (capability === 'degraded') {
    return 'degraded'
  }

  // All good
  return 'paired'
}

// =============================================================================
// Event Processing
// =============================================================================

// Track previous state for change detection
let previousOverall: OpenClawAuthState = 'unknown'

/**
 * Process an event through the state machine
 */
export function processEvent(
  event: OpenClawAuthEvent,
  details?: string
): OpenClawAuthData {
  const state = loadAuthState()
  const oldOverall = state.overall

  // Get new overall state from transition table
  const transitions = STATE_TRANSITIONS[state.overall]
  let newOverall = transitions?.[event]

  // If no explicit transition, derive from component states
  if (!newOverall) {
    newOverall = deriveOverallState(state.connection, state.auth, state.capability)
  }

  // Log the event
  const eventLog: OpenClawEventLog = {
    event,
    timestamp: new Date().toISOString(),
    previousState: oldOverall,
    newState: newOverall,
    details
  }

  state.recentEvents.unshift(eventLog)
  state.overall = newOverall

  // Save state
  saveAuthState(state)

  // Log state change
  if (oldOverall !== newOverall) {
    console.log(`[OpenClawAuth] ${oldOverall} -> ${newOverall} (${event})`)

    // Emit WS event on state change
    if (previousOverall !== newOverall) {
      previousOverall = newOverall
      emitOpenClawEvent(newOverall, state)
    }
  }

  // Notify listeners
  notifyListeners(state)

  return state
}

// =============================================================================
// State Updates
// =============================================================================

/**
 * Update connection state
 */
export function updateConnectionState(
  connectionState: ConnectionState,
  result?: { success: boolean; latencyMs?: number; error?: string }
): OpenClawAuthData {
  const state = loadAuthState()

  state.connection = connectionState
  if (result) {
    state.lastConnectionCheck = {
      timestamp: Date.now(),
      ...result
    }
  }

  // Derive event
  const event: OpenClawAuthEvent = connectionState === 'connected'
    ? 'connection_ok'
    : connectionState === 'disconnected'
      ? 'connection_failed'
      : connectionState === 'error'
        ? 'fatal_error'
        : 'connection_check_started'

  return processEvent(event, result?.error)
}

/**
 * Update auth state
 */
export function updateAuthState(
  authState: AuthState,
  result?: { success: boolean; error?: string }
): OpenClawAuthData {
  const state = loadAuthState()

  state.auth = authState
  if (result) {
    state.lastAuthCheck = {
      timestamp: Date.now(),
      ...result
    }
  }

  // Derive event
  const event: OpenClawAuthEvent = authState === 'paired'
    ? 'auth_ok'
    : authState === 'unpaired'
      ? 'auth_failed'
      : authState === 'expired'
        ? 'auth_expired'
        : authState === 'error'
          ? 'auth_failed'
          : 'auth_check_started'

  return processEvent(event, result?.error)
}

/**
 * Update capability state
 */
export function updateCapabilityState(
  capabilityState: CapabilityState,
  scopesNeedingAuth?: string[]
): OpenClawAuthData {
  const state = loadAuthState()

  state.capability = capabilityState
  if (scopesNeedingAuth !== undefined) {
    state.scopesNeedingAuth = scopesNeedingAuth
  }

  // Derive event
  const event: OpenClawAuthEvent = capabilityState === 'healthy'
    ? 'capability_ok'
    : capabilityState === 'degraded'
      ? 'capability_degraded'
      : capabilityState === 'blocked'
        ? 'capability_blocked'
        : 'capability_check_started'

  return processEvent(event)
}

// =============================================================================
// Execution Tracking
// =============================================================================

/**
 * Record successful execution
 */
export function recordSuccessfulExecution(): OpenClawAuthData {
  const state = loadAuthState()

  state.lastSuccessfulExecution = Date.now()

  // If we were degraded, upgrade to paired
  if (state.overall === 'degraded') {
    state.auth = 'paired'
    state.capability = 'healthy'
    state.scopesNeedingAuth = []
    return processEvent('capability_ok')
  }

  saveAuthState(state)
  return state
}

/**
 * Record scope needing auth
 */
export function recordScopeNeedsAuth(scopeKey: string): OpenClawAuthData {
  const state = loadAuthState()

  if (!state.scopesNeedingAuth.includes(scopeKey)) {
    state.scopesNeedingAuth.push(scopeKey)
  }

  // Update capability state
  if (state.scopesNeedingAuth.length > 0 && state.capability !== 'blocked') {
    state.capability = 'degraded'
  }

  return processEvent('scope_auth_required', scopeKey)
}

/**
 * Clear scope auth requirement
 */
export function clearScopeAuth(scopeKey: string): OpenClawAuthData {
  const state = loadAuthState()

  state.scopesNeedingAuth = state.scopesNeedingAuth.filter(s => s !== scopeKey)

  if (state.scopesNeedingAuth.length === 0) {
    state.capability = 'healthy'
    return processEvent('capability_ok')
  }

  saveAuthState(state)
  return state
}

// =============================================================================
// Health Response
// =============================================================================

/**
 * Get health response for API
 */
export function getAuthHealth(): OpenClawHealthResponse {
  const state = loadAuthState()

  const issues: OpenClawIssue[] = []

  // Check connection
  if (state.connection === 'disconnected') {
    issues.push({
      type: 'connection',
      severity: 'critical',
      message: 'Cannot connect to OpenClaw',
      canRepair: false
    })
  } else if (state.connection === 'error') {
    issues.push({
      type: 'connection',
      severity: 'critical',
      message: 'Connection error to OpenClaw',
      canRepair: false
    })
  }

  // Check auth
  if (state.auth === 'unpaired' || state.auth === 'expired') {
    issues.push({
      type: 'auth',
      severity: 'critical',
      message: 'OpenClaw session expired. Re-authorization required.',
      canRepair: true
    })
  } else if (state.auth === 'error') {
    issues.push({
      type: 'auth',
      severity: 'error',
      message: 'Error verifying OpenClaw authentication',
      canRepair: true
    })
  }

  // Check capabilities
  for (const scope of state.scopesNeedingAuth) {
    issues.push({
      type: 'scope',
      severity: 'warning',
      message: `Scope ${scope} requires re-authorization`,
      scope,
      canRepair: true
    })
  }

  if (state.capability === 'blocked') {
    issues.push({
      type: 'capability',
      severity: 'critical',
      message: 'Capabilities blocked. Manual repair required.',
      canRepair: true
    })
  }

  const healthy = state.overall === 'paired'
  const canExecute = state.overall === 'paired' || state.overall === 'degraded'

  return {
    overall: state.overall,
    connection: state.connection,
    auth: state.auth,
    capability: state.capability,
    healthy,
    canExecute,
    lastCheck: state.lastConnectionCheck?.timestamp,
    lastSuccess: state.lastSuccessfulExecution,
    issues,
    repairAvailable: issues.some(i => i.canRepair),
    repairSessionId: state.activeRepairSessionId
  }
}

/**
 * Get current auth state
 */
export function getAuthState(): OpenClawAuthData {
  return loadAuthState()
}
