/**
 * OpenClaw Routes
 * FIX 123: OpenClaw Persistent Setup & Pairing Flow
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { ok, badRequest } from '../../shared/response'
import { getOpenClawStatus, getOpenClawWsStatus, testWebhook, getWsRpcStatus, getToolsRpcStatus } from './service'
import { checkOpenClawAuth } from './auth-check.service'
import type { WebhookTestRequest } from './types'
// FIX 123: System state integration
import {
  markOpenClawReady,
  markOpenClawRequiresSetup,
  getSystemState,
  updateLastChecked
} from '../system-state'

export function handleOpenClawStatus(_req: IncomingMessage, res: ServerResponse): void {
  const status = getOpenClawStatus()
  ok(res, status)
}

export function handleOpenClawWsStatus(_req: IncomingMessage, res: ServerResponse): void {
  const status = getOpenClawWsStatus()
  ok(res, status)
}

export function handleWebhookTest(req: IncomingMessage, res: ServerResponse): void {
  let body = ''

  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', () => {
    let request: WebhookTestRequest = {}

    if (body) {
      try {
        request = JSON.parse(body)
      } catch {
        badRequest(res, 'Invalid JSON body')
        return
      }
    }

    const result = testWebhook(request)
    ok(res, result)
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}

export function handleWsRpcStatus(_req: IncomingMessage, res: ServerResponse): void {
  const status = getWsRpcStatus()
  ok(res, status)
}

export function handleToolsStatus(_req: IncomingMessage, res: ServerResponse): void {
  const status = getToolsRpcStatus()
  ok(res, status)
}

/**
 * GET /openclaw/auth-status
 * Valida autenticación contra todas las superficies OpenClaw
 */
export async function handleAuthStatus(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const authStatus = await checkOpenClawAuth()
    ok(res, authStatus)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    ok(res, {
      rest: 'fail',
      ws: 'fail',
      tools: 'fail',
      details: { error: errorMsg },
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * GET /openclaw/check-auth
 * FIX 123: Verify OpenClaw auth and update system state
 * Returns current auth status and updates persistent state
 */
export async function handleCheckAuth(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  console.log('[OpenClaw] Check-auth requested')

  try {
    // Run auth check
    const authStatus = await checkOpenClawAuth()

    // Determine if setup is required based on results
    const wsOk = authStatus.ws === 'ok'
    const restOk = authStatus.rest === 'ok'
    const toolsOk = authStatus.tools === 'ok'

    // Check for pairing/auth errors in details
    const hasPairingError = authStatus.details.wsError?.toLowerCase().includes('pairing') ||
      authStatus.details.wsError?.toLowerCase().includes('authorization') ||
      authStatus.details.toolsError?.toLowerCase().includes('pairing') ||
      authStatus.details.toolsError?.toLowerCase().includes('authorization')

    // Update system state
    updateLastChecked()

    if (wsOk && (restOk || toolsOk)) {
      // At least WS and one other surface OK = ready
      markOpenClawReady()
      console.log('[OpenClaw] Check-auth: Marked as ready')
    } else if (hasPairingError) {
      // Pairing error detected
      const error = authStatus.details.wsError || authStatus.details.toolsError || 'Pairing required'
      markOpenClawRequiresSetup(error)
      console.log('[OpenClaw] Check-auth: Marked as requiring setup (pairing)')
    } else if (!wsOk && !restOk && !toolsOk) {
      // All failed - likely needs setup
      const error = authStatus.details.wsError || authStatus.details.restError || 'All auth checks failed'
      markOpenClawRequiresSetup(error)
      console.log('[OpenClaw] Check-auth: Marked as requiring setup (all failed)')
    }

    // Get current system state
    const systemState = getSystemState()

    ok(res, {
      success: true,
      authStatus,
      systemState: {
        openclawRequiresSetup: systemState.openclawRequiresSetup,
        openclawSetupStatus: systemState.openclawSetupStatus,
        lastError: systemState.lastError,
        lastChecked: systemState.lastChecked
      },
      summary: {
        wsOk,
        restOk,
        toolsOk,
        hasPairingError,
        isReady: !systemState.openclawRequiresSetup
      }
    })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[OpenClaw] Check-auth error:', errorMsg)

    // Mark as requiring setup on error
    markOpenClawRequiresSetup(errorMsg)

    ok(res, {
      success: false,
      error: errorMsg,
      systemState: getSystemState()
    })
  }
}
