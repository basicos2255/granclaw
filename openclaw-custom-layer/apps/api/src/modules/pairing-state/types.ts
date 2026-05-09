/**
 * Pairing State Types
 * P6.4: Persistent Pairing, Auth Lifecycle & Route Consistency
 *
 * Centralized state machine for OpenClaw connection, auth, and capability states.
 */

/**
 * Connection states - is OpenClaw reachable?
 */
export type ConnectionState =
  | 'unknown'        // Not yet checked
  | 'checking'       // Currently checking
  | 'connected'      // OpenClaw API is reachable
  | 'disconnected'   // Cannot reach OpenClaw
  | 'error'          // Fatal connection error

/**
 * Auth/pairing states - is auth valid?
 */
export type AuthState =
  | 'unknown'        // Not yet checked
  | 'checking'       // Currently verifying
  | 'paired'         // Auth is valid
  | 'unpaired'       // No auth or expired
  | 'error'          // Auth check failed

/**
 * Capability states - are required scopes authorized?
 */
export type CapabilityState =
  | 'unknown'        // Not yet checked
  | 'checking'       // Currently verifying
  | 'healthy'        // All scopes OK
  | 'degraded'       // Some scopes need reauth
  | 'blocked'        // Critical scopes need auth
  | 'error'          // Capability check failed

/**
 * Overall pairing state - derived from connection + auth + capability
 */
export type OverallPairingState =
  | 'unknown'        // Initial state, nothing checked
  | 'disconnected'   // Cannot reach OpenClaw
  | 'connected'      // OpenClaw reachable but not paired
  | 'paired'         // Connected + auth valid + capabilities OK
  | 'degraded'       // Connected + auth valid but some capabilities need reauth
  | 'blocked'        // Connected but critical auth/capability issues
  | 'error'          // Fatal error state

/**
 * Transition events for state machine
 */
export type PairingEvent =
  | 'connection_check_started'
  | 'connection_ok'
  | 'connection_failed'
  | 'auth_check_started'
  | 'auth_ok'
  | 'auth_failed'
  | 'auth_expired'
  | 'capability_ok'
  | 'capability_degraded'
  | 'capability_blocked'
  | 'repair_started'
  | 'repair_completed'
  | 'repair_failed'
  | 'fatal_error'
  | 'reset'

/**
 * Complete pairing state
 */
export interface PairingState {
  /** Connection state */
  connection: ConnectionState
  /** Auth state */
  auth: AuthState
  /** Capability state */
  capability: CapabilityState
  /** Derived overall state */
  overall: OverallPairingState

  /** Last connection check result */
  lastConnectionCheck?: {
    timestamp: number
    success: boolean
    latencyMs?: number
    error?: string
  }

  /** Last auth check result */
  lastAuthCheck?: {
    timestamp: number
    success: boolean
    error?: string
  }

  /** Scopes that need reauth (if degraded/blocked) */
  scopesNeedingAuth: string[]

  /** Active repair session ID if any */
  activeRepairSessionId?: string

  /** Last successful execution timestamp */
  lastSuccessfulExecution?: number

  /** History of recent events (limited) */
  recentEvents: PairingEventLog[]

  /** State version for migrations */
  version: number

  /** Last update timestamp */
  updatedAt: string
}

/**
 * Event log entry
 */
export interface PairingEventLog {
  event: PairingEvent
  timestamp: string
  previousState: OverallPairingState
  newState: OverallPairingState
  details?: string
}

/**
 * Default pairing state
 */
export const DEFAULT_PAIRING_STATE: PairingState = {
  connection: 'unknown',
  auth: 'unknown',
  capability: 'unknown',
  overall: 'unknown',
  scopesNeedingAuth: [],
  recentEvents: [],
  version: 1,
  updatedAt: new Date().toISOString()
}

/**
 * State machine transition table
 * Maps (currentOverall, event) -> newOverall
 */
export const STATE_TRANSITIONS: Record<OverallPairingState, Partial<Record<PairingEvent, OverallPairingState>>> = {
  unknown: {
    connection_check_started: 'unknown',
    connection_ok: 'connected',
    connection_failed: 'disconnected',
    fatal_error: 'error',
    reset: 'unknown'
  },
  disconnected: {
    connection_check_started: 'disconnected',
    connection_ok: 'connected',
    connection_failed: 'disconnected',
    fatal_error: 'error',
    reset: 'unknown'
  },
  connected: {
    connection_failed: 'disconnected',
    auth_check_started: 'connected',
    auth_ok: 'paired',
    auth_failed: 'blocked',
    auth_expired: 'blocked',
    fatal_error: 'error',
    reset: 'unknown'
  },
  paired: {
    connection_failed: 'disconnected',
    auth_failed: 'blocked',
    auth_expired: 'blocked',
    capability_ok: 'paired',
    capability_degraded: 'degraded',
    capability_blocked: 'blocked',
    fatal_error: 'error',
    reset: 'unknown'
  },
  degraded: {
    connection_failed: 'disconnected',
    auth_failed: 'blocked',
    capability_ok: 'paired',
    capability_degraded: 'degraded',
    capability_blocked: 'blocked',
    repair_started: 'degraded',
    repair_completed: 'paired',
    repair_failed: 'degraded',
    fatal_error: 'error',
    reset: 'unknown'
  },
  blocked: {
    connection_failed: 'disconnected',
    auth_ok: 'paired',
    capability_ok: 'paired',
    repair_started: 'blocked',
    repair_completed: 'paired',
    repair_failed: 'blocked',
    fatal_error: 'error',
    reset: 'unknown'
  },
  error: {
    connection_ok: 'connected',
    reset: 'unknown'
  }
}

/**
 * Health status for API response
 */
export interface PairingHealthResponse {
  overall: OverallPairingState
  connection: ConnectionState
  auth: AuthState
  capability: CapabilityState

  healthy: boolean
  canExecute: boolean

  lastCheck?: number
  lastSuccess?: number

  issues: PairingIssue[]

  repairAvailable: boolean
  repairSessionId?: string
}

/**
 * Issue description for UI
 */
export interface PairingIssue {
  type: 'connection' | 'auth' | 'capability'
  severity: 'warning' | 'error' | 'critical'
  message: string
  scope?: string
  canRepair: boolean
}
