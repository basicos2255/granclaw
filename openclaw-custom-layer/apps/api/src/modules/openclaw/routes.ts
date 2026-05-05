/**
 * OpenClaw Routes
 * FIX 123: OpenClaw Persistent Setup & Pairing Flow
 * FIX 123.1: OpenClaw Setup Hardening & Scoped Reauthorization
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { ok, badRequest } from '../../shared/response'
import { getOpenClawStatus, getOpenClawWsStatus, testWebhook, getWsRpcStatus, getToolsRpcStatus } from './service'
import { checkOpenClawAuth } from './auth-check.service'
import type { WebhookTestRequest } from './types'
// FIX 123.1: System state integration with granular requirements
import {
  markOpenClawReady,
  markOpenClawRequiresSetup,
  getSystemState,
  updateLastChecked,
  getActiveRequirements,
  resolveAllRequirements,
  addSetupRequirement
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
 * FIX 123.1: Verify OpenClaw auth with granular requirements
 * Returns current auth status and resolves/creates requirements based on results
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

    // Get active requirements before any changes
    const activeRequirementsBefore = getActiveRequirements()

    // Update system state
    updateLastChecked()

    let resolvedCount = 0

    if (wsOk && (restOk || toolsOk)) {
      // At least WS and one other surface OK = resolve ALL requirements
      resolvedCount = resolveAllRequirements()
      console.log(`[OpenClaw] Check-auth: Resolved ${resolvedCount} requirements - all auth OK`)
    } else if (hasPairingError) {
      // Pairing error detected - create generic requirement if none exists
      const error = authStatus.details.wsError || authStatus.details.toolsError || 'Pairing required'
      if (activeRequirementsBefore.length === 0) {
        addSetupRequirement({
          scopeKey: 'openclaw:unknown_scope',
          reason: error,
          originalError: error
        })
      }
      console.log('[OpenClaw] Check-auth: Pairing error detected')
    } else if (!wsOk && !restOk && !toolsOk) {
      // All failed - likely needs setup
      const error = authStatus.details.wsError || authStatus.details.restError || 'All auth checks failed'
      if (activeRequirementsBefore.length === 0) {
        addSetupRequirement({
          scopeKey: 'openclaw:unknown_scope',
          reason: error,
          originalError: error
        })
      }
      console.log('[OpenClaw] Check-auth: All checks failed')
    }

    // Get current system state after changes
    const systemState = getSystemState()
    const activeRequirements = getActiveRequirements()

    ok(res, {
      success: true,
      authStatus,
      systemState: {
        openclawRequiresSetup: systemState.openclawRequiresSetup,
        openclawSetupStatus: systemState.openclawSetupStatus,
        lastError: systemState.lastError,
        lastChecked: systemState.lastChecked
      },
      // FIX 123.1: Include granular requirements
      activeRequirements,
      resolvedRequirements: systemState.setupRequirements.filter(r => r.status === 'resolved'),
      resolvedCount,
      summary: {
        wsOk,
        restOk,
        toolsOk,
        hasPairingError,
        isReady: !systemState.openclawRequiresSetup,
        activeRequirementCount: activeRequirements.length
      }
    })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[OpenClaw] Check-auth error:', errorMsg)

    // Create requirement on error if none exists
    const activeReqs = getActiveRequirements()
    if (activeReqs.length === 0) {
      addSetupRequirement({
        scopeKey: 'openclaw:unknown_scope',
        reason: errorMsg,
        originalError: errorMsg
      })
    }

    ok(res, {
      success: false,
      error: errorMsg,
      systemState: getSystemState(),
      activeRequirements: getActiveRequirements()
    })
  }
}
