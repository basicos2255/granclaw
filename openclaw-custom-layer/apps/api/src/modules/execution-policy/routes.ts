/**
 * Execution Policy Routes
 * FEATURE 120: Hybrid Execution Policy v1
 */

import type { IncomingMessage, ServerResponse } from 'http'
import type { AuthContext } from '../auth/types'
import { ok, badRequest, unauthorized } from '../../shared/response'
import { getExecutionPolicy, setExecutionPolicy } from './service'
import type { ExecutionProvider } from './types'

/**
 * GET /execution-policy
 * Get execution policy for current tenant
 */
export function handleGetExecutionPolicy(
  _req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const policy = getExecutionPolicy(context.tenant.id)

  ok(res, {
    success: true,
    policy
  })
}

/**
 * POST /execution-policy
 * Update execution policy for current tenant
 */
export function handleSetExecutionPolicy(
  req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  let body = ''

  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', () => {
    let input: Partial<{
      provider: ExecutionProvider
      preferOpenClawForNewActions: boolean
      allowLocalFallback: boolean
      avoidAiForLearnedActions: boolean
      requireConfirmationForOsToolsInStrict: boolean
      requireConfirmationForHighRiskInFree: boolean
    }>

    try {
      input = JSON.parse(body)
    } catch (_e) {
      badRequest(res, 'Invalid JSON body')
      return
    }

    // Validate provider if provided
    if (input.provider && !['auto', 'openclaw', 'local'].includes(input.provider)) {
      badRequest(res, 'provider must be "auto", "openclaw", or "local"')
      return
    }

    const policy = setExecutionPolicy(context.tenant.id, input)

    ok(res, {
      success: true,
      policy,
      message: 'Politica de ejecucion actualizada'
    })
  })
}
