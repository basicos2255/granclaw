/**
 * Pairing State Service
 * P6.4: Persistent Pairing, Auth Lifecycle & Route Consistency
 *
 * State machine for OpenClaw pairing lifecycle.
 */

import { readFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { atomicWriteJson } from '../../shared/atomic-persistence'

// P6.4: Lazy import to avoid circular dependency
let emitPairingStateChangeFn: ((state: ReturnType<typeof getPairingHealth>) => number) | null = null

function getEmitFn(): ((state: ReturnType<typeof getPairingHealth>) => number) | null {
  if (!emitPairingStateChangeFn) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ws = require('../runtime-ws')
      if (ws.emitPairingStateChange) {
        emitPairingStateChangeFn = ws.emitPairingStateChange
      }
    } catch {
      // WS module not available yet
    }
  }
  return emitPairingStateChangeFn
}
import type {
  PairingState,
  PairingEvent,
  PairingEventLog,
  OverallPairingState,
  ConnectionState,
  AuthState,
  CapabilityState,
  PairingHealthResponse,
  PairingIssue
} from './types'
import {
  DEFAULT_PAIRING_STATE,
  STATE_TRANSITIONS
} from './types'

// Path to persistent state file
const DATA_DIR = join(process.cwd(), 'data')
const STATE_FILE = join(DATA_DIR, 'pairing-state.json')
const MAX_EVENT_LOG = 50

// In-memory cache
let cachedState: PairingState | null = null

// Event listeners
type PairingStateListener = (state: PairingState) => void
const listeners: PairingStateListener[] = []

/**
 * Ensure data directory exists
 */
function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

/**
 * Load state from disk
 */
function loadState(): PairingState {
  if (cachedState) {
    return cachedState
  }

  ensureDataDir()

  if (!existsSync(STATE_FILE)) {
    cachedState = { ...DEFAULT_PAIRING_STATE }
    saveState(cachedState)
    return cachedState
  }

  try {
    const raw = readFileSync(STATE_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<PairingState>

    // Merge with defaults
    cachedState = {
      ...DEFAULT_PAIRING_STATE,
      ...parsed,
      recentEvents: parsed.recentEvents || []
    }

    return cachedState
  } catch (err) {
    console.error('[PairingState] Error loading state:', err)
    cachedState = { ...DEFAULT_PAIRING_STATE }
    return cachedState
  }
}

// Track previous overall state for change detection
let previousOverall: OverallPairingState = 'unknown'

/**
 * Save state to disk
 */
function saveState(state: PairingState): void {
  state.updatedAt = new Date().toISOString()

  const result = atomicWriteJson(STATE_FILE, state, {
    createBackup: true,
    ensureDir: true
  })

  if (result.success) {
    const stateChanged = previousOverall !== state.overall
    previousOverall = state.overall
    cachedState = state

    // Notify listeners
    listeners.forEach(listener => {
      try {
        listener(state)
      } catch (err) {
        console.error('[PairingState] Listener error:', err)
      }
    })

    // P6.4: Emit WS event on state change
    if (stateChanged) {
      const emitFn = getEmitFn()
      if (emitFn) {
        try {
          const health = getPairingHealth()
          emitFn(health)
        } catch (err) {
          console.error('[PairingState] WS emit error:', err)
        }
      }
    }
  } else {
    console.error('[PairingState] Error saving state:', result.error)
  }
}

/**
 * Derive overall state from component states
 */
function deriveOverallState(
  connection: ConnectionState,
  auth: AuthState,
  capability: CapabilityState
): OverallPairingState {
  // Error takes priority
  if (connection === 'error' || auth === 'error' || capability === 'error') {
    return 'error'
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

  if (auth === 'unpaired') {
    return 'blocked'
  }

  // At this point, auth is 'paired'

  // Capability issues
  if (capability === 'blocked') {
    return 'blocked'
  }

  if (capability === 'degraded') {
    return 'degraded'
  }

  // All good
  return 'paired'
}

/**
 * Get current pairing state
 */
export function getPairingState(): PairingState {
  return loadState()
}

/**
 * Process an event through the state machine
 */
export function processEvent(
  event: PairingEvent,
  details?: string
): PairingState {
  const state = loadState()
  const previousOverall = state.overall

  // Get new overall state from transition table
  const transitions = STATE_TRANSITIONS[state.overall]
  let newOverall = transitions?.[event]

  // If no explicit transition, derive from component states
  if (!newOverall) {
    newOverall = deriveOverallState(state.connection, state.auth, state.capability)
  }

  // Log the event
  const eventLog: PairingEventLog = {
    event,
    timestamp: new Date().toISOString(),
    previousState: previousOverall,
    newState: newOverall,
    details
  }

  state.recentEvents.unshift(eventLog)
  if (state.recentEvents.length > MAX_EVENT_LOG) {
    state.recentEvents = state.recentEvents.slice(0, MAX_EVENT_LOG)
  }

  state.overall = newOverall

  if (previousOverall !== newOverall) {
    console.log(`[PairingState] ${previousOverall} -> ${newOverall} (${event})`)
  }

  saveState(state)
  return state
}

/**
 * Update connection state
 */
export function updateConnectionState(
  connectionState: ConnectionState,
  result?: { success: boolean; latencyMs?: number; error?: string }
): PairingState {
  const state = loadState()

  state.connection = connectionState
  state.lastConnectionCheck = result ? {
    timestamp: Date.now(),
    ...result
  } : state.lastConnectionCheck

  // Derive event
  const event: PairingEvent = connectionState === 'connected'
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
): PairingState {
  const state = loadState()

  state.auth = authState
  state.lastAuthCheck = result ? {
    timestamp: Date.now(),
    ...result
  } : state.lastAuthCheck

  // Derive event
  const event: PairingEvent = authState === 'paired'
    ? 'auth_ok'
    : authState === 'unpaired'
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
): PairingState {
  const state = loadState()

  state.capability = capabilityState
  if (scopesNeedingAuth !== undefined) {
    state.scopesNeedingAuth = scopesNeedingAuth
  }

  // Derive event
  const event: PairingEvent = capabilityState === 'healthy'
    ? 'capability_ok'
    : capabilityState === 'degraded'
      ? 'capability_degraded'
      : capabilityState === 'blocked'
        ? 'capability_blocked'
        : 'capability_ok'

  return processEvent(event)
}

/**
 * Record successful execution
 */
export function recordSuccessfulExecution(): PairingState {
  const state = loadState()

  state.lastSuccessfulExecution = Date.now()

  // If we were degraded or blocked, upgrade to paired
  if (state.overall === 'degraded' || state.overall === 'blocked') {
    state.auth = 'paired'
    state.capability = 'healthy'
    state.scopesNeedingAuth = []
    return processEvent('capability_ok')
  }

  saveState(state)
  return state
}

/**
 * Record scope needing auth
 */
export function recordScopeNeedsAuth(scopeKey: string): PairingState {
  const state = loadState()

  if (!state.scopesNeedingAuth.includes(scopeKey)) {
    state.scopesNeedingAuth.push(scopeKey)
  }

  // Update capability state
  if (state.scopesNeedingAuth.length > 0 && state.capability !== 'blocked') {
    state.capability = 'degraded'
  }

  return processEvent('capability_degraded', scopeKey)
}

/**
 * Clear scope auth requirement
 */
export function clearScopeAuth(scopeKey: string): PairingState {
  const state = loadState()

  state.scopesNeedingAuth = state.scopesNeedingAuth.filter(s => s !== scopeKey)

  if (state.scopesNeedingAuth.length === 0) {
    state.capability = 'healthy'
    return processEvent('capability_ok')
  }

  saveState(state)
  return state
}

/**
 * Start repair session
 */
export function startRepairSession(sessionId: string): PairingState {
  const state = loadState()
  state.activeRepairSessionId = sessionId
  return processEvent('repair_started', sessionId)
}

/**
 * Complete repair session
 */
export function completeRepairSession(success: boolean): PairingState {
  const state = loadState()
  const sessionId = state.activeRepairSessionId
  state.activeRepairSessionId = undefined

  if (success) {
    state.scopesNeedingAuth = []
    state.capability = 'healthy'
    return processEvent('repair_completed', sessionId)
  } else {
    return processEvent('repair_failed', sessionId)
  }
}

/**
 * Reset pairing state
 */
export function resetPairingState(): PairingState {
  cachedState = null
  saveState({ ...DEFAULT_PAIRING_STATE })
  console.log('[PairingState] State reset to defaults')
  return loadState()
}

/**
 * Force reload from disk
 */
export function reloadPairingState(): PairingState {
  cachedState = null
  return loadState()
}

/**
 * Subscribe to state changes
 */
export function subscribeToPairingState(listener: PairingStateListener): () => void {
  listeners.push(listener)
  return () => {
    const index = listeners.indexOf(listener)
    if (index >= 0) {
      listeners.splice(index, 1)
    }
  }
}

/**
 * Get health response for API
 */
export function getPairingHealth(): PairingHealthResponse {
  const state = loadState()

  const issues: PairingIssue[] = []

  // Check connection
  if (state.connection === 'disconnected') {
    issues.push({
      type: 'connection',
      severity: 'critical',
      message: 'No se puede conectar con OpenClaw',
      canRepair: false
    })
  } else if (state.connection === 'error') {
    issues.push({
      type: 'connection',
      severity: 'critical',
      message: 'Error de conexion con OpenClaw',
      canRepair: false
    })
  }

  // Check auth
  if (state.auth === 'unpaired') {
    issues.push({
      type: 'auth',
      severity: 'critical',
      message: 'OpenClaw no esta pareado. Requiere autorizacion.',
      canRepair: true
    })
  } else if (state.auth === 'error') {
    issues.push({
      type: 'auth',
      severity: 'error',
      message: 'Error verificando autenticacion de OpenClaw',
      canRepair: true
    })
  }

  // Check capabilities
  for (const scope of state.scopesNeedingAuth) {
    issues.push({
      type: 'capability',
      severity: 'warning',
      message: `Scope ${scope} requiere reautorizacion`,
      scope,
      canRepair: true
    })
  }

  if (state.capability === 'blocked') {
    issues.push({
      type: 'capability',
      severity: 'critical',
      message: 'Capacidades bloqueadas. Requiere autorizacion.',
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
