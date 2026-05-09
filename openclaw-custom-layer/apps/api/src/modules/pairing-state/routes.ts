/**
 * Pairing State Routes
 * P6.4: Persistent Pairing, Auth Lifecycle & Route Consistency
 *
 * HTTP endpoints for pairing state access.
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { getPairingState, getPairingHealth, resetPairingState, reloadPairingState } from './service'
import { runPairingHealthCheck, getCombinedHealthStatus } from './sync'

/**
 * GET /pairing/state - Get full pairing state
 */
export function handleGetPairingState(req: IncomingMessage, res: ServerResponse): void {
  try {
    const state = getPairingState()

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      success: true,
      data: state
    }))
  } catch (err) {
    console.error('[PairingState] Error getting state:', err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      success: false,
      error: 'Error getting pairing state'
    }))
  }
}

/**
 * GET /pairing/health - Get health response (simplified for UI)
 */
export function handleGetPairingHealth(req: IncomingMessage, res: ServerResponse): void {
  try {
    const health = getPairingHealth()

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      success: true,
      data: health
    }))
  } catch (err) {
    console.error('[PairingState] Error getting health:', err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      success: false,
      error: 'Error getting pairing health'
    }))
  }
}

/**
 * POST /pairing/reset - Reset pairing state (for debugging)
 */
export function handleResetPairingState(req: IncomingMessage, res: ServerResponse): void {
  try {
    const state = resetPairingState()

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      success: true,
      data: state,
      message: 'Pairing state reset to defaults'
    }))
  } catch (err) {
    console.error('[PairingState] Error resetting state:', err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      success: false,
      error: 'Error resetting pairing state'
    }))
  }
}

/**
 * POST /pairing/reload - Force reload from disk
 */
export function handleReloadPairingState(req: IncomingMessage, res: ServerResponse): void {
  try {
    const state = reloadPairingState()

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      success: true,
      data: state,
      message: 'Pairing state reloaded from disk'
    }))
  } catch (err) {
    console.error('[PairingState] Error reloading state:', err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      success: false,
      error: 'Error reloading pairing state'
    }))
  }
}

/**
 * POST /pairing/check - Run full health check and sync state
 */
export async function handleRunPairingCheck(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const health = await runPairingHealthCheck()

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      success: true,
      data: health,
      message: 'Health check completed'
    }))
  } catch (err) {
    console.error('[PairingState] Error running health check:', err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      success: false,
      error: 'Error running health check'
    }))
  }
}

/**
 * GET /pairing/combined - Get combined health from pairing + system-state
 */
export function handleGetCombinedHealth(req: IncomingMessage, res: ServerResponse): void {
  try {
    const combined = getCombinedHealthStatus()

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      success: true,
      data: combined
    }))
  } catch (err) {
    console.error('[PairingState] Error getting combined health:', err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      success: false,
      error: 'Error getting combined health'
    }))
  }
}
