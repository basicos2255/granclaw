/**
 * OpenClaw Auth Types
 * P6.4R: Persistent Pairing, Auth Lifecycle & Route Consistency
 *
 * Type definitions for OpenClaw authentication and pairing lifecycle.
 */

// =============================================================================
// State Types
// =============================================================================

/**
 * Overall OpenClaw pairing/auth state
 */
export type OpenClawAuthState =
  | 'unknown'                 // Initial state, no checks performed
  | 'disconnected'            // OpenClaw not reachable
  | 'connected'               // Reachable but not authenticated
  | 'paired'                  // Connected + authenticated + capabilities OK
  | 'degraded'                // Connected + auth OK but some scopes failing
  | 'reauthorization_required' // Auth expired, needs re-auth
  | 'repair_required'         // Critical issues, needs manual repair
  | 'expired'                 // Session completely expired

/**
 * Connection state to OpenClaw
 */
export type ConnectionState =
  | 'unknown'
  | 'checking'
  | 'connected'
  | 'disconnected'
  | 'error'

/**
 * Authentication state with OpenClaw
 */
export type AuthState =
  | 'unknown'
  | 'checking'
  | 'paired'
  | 'unpaired'
  | 'expired'
  | 'error'

/**
 * Capability health state
 */
export type CapabilityState =
  | 'unknown'
  | 'checking'
  | 'healthy'
  | 'degraded'
  | 'blocked'
  | 'error'

// =============================================================================
// Event Types
// =============================================================================

/**
 * OpenClaw auth events for state machine
 */
export type OpenClawAuthEvent =
  | 'connection_check_started'
  | 'connection_ok'
  | 'connection_failed'
  | 'auth_check_started'
  | 'auth_ok'
  | 'auth_failed'
  | 'auth_expired'
  | 'capability_check_started'
  | 'capability_ok'
  | 'capability_degraded'
  | 'capability_blocked'
  | 'scope_auth_required'
  | 'repair_started'
  | 'repair_completed'
  | 'repair_failed'
  | 'session_restored'
  | 'fatal_error'
  | 'reset'

/**
 * WebSocket event types for OpenClaw auth
 */
export type OpenClawWsEventType =
  | 'openclaw-connected'
  | 'openclaw-disconnected'
  | 'openclaw-degraded'
  | 'pairing-expired'
  | 'reauthorization-required'
  | 'repair-required'
  | 'pairing-restored'
  | 'openclaw-health-change'

// =============================================================================
// Data Structures
// =============================================================================

/**
 * Event log entry
 */
export interface OpenClawEventLog {
  event: OpenClawAuthEvent
  timestamp: string
  previousState: OpenClawAuthState
  newState: OpenClawAuthState
  details?: string
}

/**
 * Last check result
 */
export interface LastCheckResult {
  timestamp: number
  success: boolean
  latencyMs?: number
  error?: string
}

/**
 * Persistent auth state
 */
export interface OpenClawAuthData {
  overall: OpenClawAuthState
  connection: ConnectionState
  auth: AuthState
  capability: CapabilityState
  lastConnectionCheck?: LastCheckResult
  lastAuthCheck?: LastCheckResult
  lastCapabilityCheck?: LastCheckResult
  lastSuccessfulExecution?: number
  scopesNeedingAuth: string[]
  activeRepairSessionId?: string
  recentEvents: OpenClawEventLog[]
  createdAt: string
  updatedAt: string
}

/**
 * Issue reported in health check
 */
export interface OpenClawIssue {
  type: 'connection' | 'auth' | 'capability' | 'scope'
  severity: 'warning' | 'error' | 'critical'
  message: string
  scope?: string
  canRepair: boolean
}

/**
 * Health response for API
 */
export interface OpenClawHealthResponse {
  overall: OpenClawAuthState
  connection: ConnectionState
  auth: AuthState
  capability: CapabilityState
  healthy: boolean
  canExecute: boolean
  lastCheck?: number
  lastSuccess?: number
  issues: OpenClawIssue[]
  repairAvailable: boolean
  repairSessionId?: string
}

/**
 * Capability usability result
 */
export interface CapabilityUsabilityResult {
  usable: boolean
  reason?: string
  requiresAuth: boolean
  scopeKey?: string
  repairUrl?: string
}

// =============================================================================
// State Machine Transitions
// =============================================================================

/**
 * State transition table
 */
export const STATE_TRANSITIONS: Record<OpenClawAuthState, Partial<Record<OpenClawAuthEvent, OpenClawAuthState>>> = {
  unknown: {
    connection_ok: 'connected',
    connection_failed: 'disconnected',
    fatal_error: 'disconnected'
  },
  disconnected: {
    connection_ok: 'connected',
    reset: 'unknown'
  },
  connected: {
    auth_ok: 'paired',
    auth_failed: 'reauthorization_required',
    auth_expired: 'expired',
    connection_failed: 'disconnected',
    fatal_error: 'repair_required'
  },
  paired: {
    capability_degraded: 'degraded',
    capability_blocked: 'repair_required',
    auth_expired: 'reauthorization_required',
    connection_failed: 'disconnected',
    reset: 'unknown'
  },
  degraded: {
    capability_ok: 'paired',
    repair_completed: 'paired',
    capability_blocked: 'repair_required',
    auth_expired: 'reauthorization_required',
    connection_failed: 'disconnected'
  },
  reauthorization_required: {
    auth_ok: 'paired',
    session_restored: 'paired',
    auth_failed: 'repair_required',
    connection_failed: 'disconnected',
    reset: 'unknown'
  },
  repair_required: {
    repair_completed: 'paired',
    repair_failed: 'repair_required',
    connection_failed: 'disconnected',
    reset: 'unknown'
  },
  expired: {
    auth_ok: 'paired',
    session_restored: 'paired',
    repair_completed: 'paired',
    connection_failed: 'disconnected',
    reset: 'unknown'
  }
}

/**
 * Default auth state
 */
export const DEFAULT_AUTH_STATE: OpenClawAuthData = {
  overall: 'unknown',
  connection: 'unknown',
  auth: 'unknown',
  capability: 'unknown',
  scopesNeedingAuth: [],
  recentEvents: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}
