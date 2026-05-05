import type { IncomingMessage, ServerResponse } from 'http'
import { ok, badRequest } from '../../shared/response'
import { getOpenClawStatus, getOpenClawWsStatus, testWebhook, getWsRpcStatus, getToolsRpcStatus } from './service'
import { checkOpenClawAuth } from './auth-check.service'
import type { WebhookTestRequest } from './types'

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
