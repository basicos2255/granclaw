/**
 * Webhook Adapter
 * P4.2: OpenClaw Capability Mapping & Adapter Consolidation
 *
 * Wraps OpenClaw http tool for outgoing webhooks.
 * Adds incoming webhook handling (GranClaw-only).
 */

import { executeTool } from '../tools/service'
import type {
  AdapterContext,
  AdapterResult,
  WebhookAdapterRequest,
  WebhookAdapterResponse
} from './types'

/**
 * Send outgoing webhook via OpenClaw http tool
 */
export async function sendWebhook(
  request: WebhookAdapterRequest,
  context: AdapterContext
): Promise<AdapterResult<WebhookAdapterResponse>> {
  const startTime = Date.now()

  // OpenClaw http supports POST (primary for webhooks)
  const useOpenClaw = request.method === 'POST'

  if (!useOpenClaw) {
    return sendWithFallback(request, context, startTime)
  }

  try {
    const toolResult = await executeTool('http', {
      url: request.url,
      method: 'POST',
      body: request.payload
    }, {
      tenantId: context.tenantId,
      userId: context.userId,
      sessionId: context.channelId
    })

    const executionMs = Date.now() - startTime

    if (!toolResult.success) {
      return {
        success: false,
        error: {
          code: 'WEBHOOK_DELIVERY_FAILED',
          message: toolResult.error || 'Unknown error',
          retryable: true
        },
        executionMs,
        usedOpenClaw: true,
        fallbackActivated: false
      }
    }

    const result = toolResult.result as { status: number; ok: boolean }

    return {
      success: result.ok,
      data: {
        delivered: result.ok,
        statusCode: result.status,
        retryCount: request.retryCount || 0
      },
      executionMs,
      usedOpenClaw: true,
      fallbackActivated: false
    }
  } catch (error) {
    const executionMs = Date.now() - startTime
    const message = error instanceof Error ? error.message : 'Unknown error'

    return {
      success: false,
      error: {
        code: 'OPENCLAW_WEBHOOK_ERROR',
        message,
        retryable: true
      },
      executionMs,
      usedOpenClaw: true,
      fallbackActivated: false
    }
  }
}

/**
 * Send with native fetch fallback
 */
async function sendWithFallback(
  request: WebhookAdapterRequest,
  context: AdapterContext,
  startTime: number
): Promise<AdapterResult<WebhookAdapterResponse>> {
  console.log(`[WebhookAdapter] Using fallback for ${request.method}`)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...request.headers
    }

    if (request.signature) {
      headers['X-Webhook-Signature'] = request.signature
    }

    const response = await fetch(request.url, {
      method: request.method,
      headers,
      body: request.method !== 'GET' ? JSON.stringify(request.payload) : undefined,
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    let responseData: unknown
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      responseData = await response.json()
    } else {
      responseData = await response.text()
    }

    const executionMs = Date.now() - startTime

    return {
      success: response.ok,
      data: {
        delivered: response.ok,
        statusCode: response.status,
        response: responseData,
        retryCount: request.retryCount || 0
      },
      executionMs,
      usedOpenClaw: false,
      fallbackActivated: true,
      fallbackReason: `Method ${request.method} uses fallback`
    }
  } catch (error) {
    const executionMs = Date.now() - startTime
    const message = error instanceof Error ? error.message : 'Unknown error'

    return {
      success: false,
      error: {
        code: 'FALLBACK_WEBHOOK_ERROR',
        message,
        retryable: true
      },
      executionMs,
      usedOpenClaw: false,
      fallbackActivated: true,
      fallbackReason: `Method ${request.method} uses fallback`
    }
  }
}

/**
 * Verify incoming webhook signature
 * Note: This is GranClaw-only (OpenClaw doesn't handle incoming webhooks)
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // Simple HMAC verification (placeholder)
  // In production, use proper HMAC-SHA256
  const crypto = require('crypto')
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  return signature === expectedSignature || signature === `sha256=${expectedSignature}`
}

/**
 * Parse incoming webhook payload
 * Note: This is GranClaw-only
 */
export function parseIncomingWebhook(
  body: unknown,
  headers: Record<string, string>
): {
  valid: boolean
  eventType?: string
  payload?: unknown
  error?: string
} {
  if (!body) {
    return { valid: false, error: 'Empty body' }
  }

  // Try to extract event type from common patterns
  let eventType: string | undefined

  if (typeof body === 'object' && body !== null) {
    const obj = body as Record<string, unknown>
    eventType = (obj.event || obj.type || obj.action || obj.eventType) as string | undefined
  }

  // Check for common webhook headers
  const githubEvent = headers['x-github-event']
  const stripeEvent = headers['stripe-signature']

  if (githubEvent) {
    eventType = `github:${githubEvent}`
  }

  return {
    valid: true,
    eventType,
    payload: body
  }
}

/**
 * Get adapter info
 */
export function getWebhookAdapterInfo(): {
  channelType: 'webhook'
  source: 'granclaw_adapter'
  openclawTool: 'http'
  outgoingVia: 'openclaw'
  incomingVia: 'granclaw'
} {
  return {
    channelType: 'webhook',
    source: 'granclaw_adapter',
    openclawTool: 'http',
    outgoingVia: 'openclaw',
    incomingVia: 'granclaw'
  }
}
