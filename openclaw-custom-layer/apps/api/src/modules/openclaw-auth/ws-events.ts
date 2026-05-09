/**
 * OpenClaw WebSocket Events
 * P6.4R: Persistent Pairing, Auth Lifecycle & Route Consistency
 *
 * Emits WebSocket events for OpenClaw auth state changes.
 */

import type { OpenClawAuthState, OpenClawAuthData, OpenClawWsEventType } from './types'

// =============================================================================
// Lazy Import for WS Gateway (avoid circular deps)
// =============================================================================

type EmitFn = (
  channel: string,
  event: string,
  payload: Record<string, unknown>,
  options?: Record<string, unknown>
) => number

let emitToWsFn: EmitFn | null = null

function getEmitFn(): EmitFn | null {
  if (!emitToWsFn) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ws = require('../runtime-ws')
      if (ws.emitToWs) {
        emitToWsFn = ws.emitToWs
      }
    } catch {
      // WS module not available yet
    }
  }
  return emitToWsFn
}

// =============================================================================
// Event Mapping
// =============================================================================

/**
 * Map overall state to WS event type
 */
function stateToEventType(state: OpenClawAuthState): OpenClawWsEventType {
  switch (state) {
    case 'paired':
      return 'openclaw-connected'
    case 'disconnected':
      return 'openclaw-disconnected'
    case 'degraded':
      return 'openclaw-degraded'
    case 'expired':
      return 'pairing-expired'
    case 'reauthorization_required':
      return 'reauthorization-required'
    case 'repair_required':
      return 'repair-required'
    default:
      return 'openclaw-health-change'
  }
}

// =============================================================================
// Event Emission
// =============================================================================

/**
 * Emit OpenClaw auth event to WebSocket clients
 */
export function emitOpenClawEvent(
  newState: OpenClawAuthState,
  data: OpenClawAuthData
): number {
  const emitFn = getEmitFn()
  if (!emitFn) {
    return 0
  }

  const eventType = stateToEventType(newState)

  const payload = {
    timestamp: new Date().toISOString(),
    source: 'openclaw-auth',
    overall: data.overall,
    connection: data.connection,
    auth: data.auth,
    capability: data.capability,
    healthy: data.overall === 'paired',
    canExecute: data.overall === 'paired' || data.overall === 'degraded',
    scopesNeedingAuth: data.scopesNeedingAuth
  }

  try {
    // Emit specific event
    const sentSpecific = emitFn('runtime', eventType, payload, {})

    // Also emit generic health-change event
    const sentGeneric = emitFn('runtime', 'openclaw-health-change', payload, {})

    console.log(`[OpenClawAuth] WS event emitted: ${eventType}`)

    return Math.max(sentSpecific, sentGeneric)
  } catch (err) {
    console.error('[OpenClawAuth] WS emit error:', err)
    return 0
  }
}

/**
 * Emit pairing restored event
 */
export function emitPairingRestored(data: OpenClawAuthData): number {
  const emitFn = getEmitFn()
  if (!emitFn) {
    return 0
  }

  const payload = {
    timestamp: new Date().toISOString(),
    source: 'openclaw-auth',
    overall: data.overall,
    connection: data.connection,
    auth: data.auth,
    capability: data.capability,
    healthy: true,
    canExecute: true,
    message: 'OpenClaw pairing restored successfully'
  }

  return emitFn('runtime', 'pairing-restored', payload, {})
}

/**
 * Emit reauthorization required event
 */
export function emitReauthorizationRequired(
  scope: string,
  reason: string
): number {
  const emitFn = getEmitFn()
  if (!emitFn) {
    return 0
  }

  const payload = {
    timestamp: new Date().toISOString(),
    source: 'openclaw-auth',
    scope,
    reason,
    action: 'reauthorize'
  }

  return emitFn('runtime', 'reauthorization-required', payload, {})
}

/**
 * Emit repair required event
 */
export function emitRepairRequired(
  issues: Array<{ type: string; message: string }>
): number {
  const emitFn = getEmitFn()
  if (!emitFn) {
    return 0
  }

  const payload = {
    timestamp: new Date().toISOString(),
    source: 'openclaw-auth',
    issues,
    action: 'repair'
  }

  return emitFn('runtime', 'repair-required', payload, {})
}
