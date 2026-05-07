/**
 * API Adapter
 * P4.2: OpenClaw Capability Mapping & Adapter Consolidation
 *
 * Wraps OpenClaw http tool with GranClaw governance layer.
 */

import { executeTool } from '../tools/service'
import type {
  AdapterContext,
  AdapterResult,
  ApiAdapterRequest,
  ApiAdapterResponse
} from './types'

/**
 * Execute API request via OpenClaw http tool
 */
export async function executeApiRequest(
  request: ApiAdapterRequest,
  context: AdapterContext
): Promise<AdapterResult<ApiAdapterResponse>> {
  const startTime = Date.now()

  // Only GET and POST supported by OpenClaw http tool
  const supportedByOpenClaw = request.method === 'GET' || request.method === 'POST'

  if (!supportedByOpenClaw) {
    // Fallback: Use native fetch for PUT/PATCH/DELETE
    return executeWithFallback(request, context, startTime)
  }

  try {
    // Execute via OpenClaw http tool
    const toolResult = await executeTool('http', {
      url: request.url,
      method: request.method,
      body: request.body
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
          code: 'OPENCLAW_TOOL_ERROR',
          message: toolResult.error || 'Unknown error',
          retryable: true
        },
        executionMs,
        usedOpenClaw: true,
        fallbackActivated: false
      }
    }

    const result = toolResult.result as { status: number; ok: boolean; data: unknown }

    return {
      success: true,
      data: {
        status: result.status,
        ok: result.ok,
        data: result.data
      },
      executionMs,
      usedOpenClaw: true,
      fallbackActivated: false
    }
  } catch (error) {
    const executionMs = Date.now() - startTime
    const message = error instanceof Error ? error.message : 'Unknown error'

    // Check if retryable
    const retryable = message.includes('timeout') ||
                      message.includes('network') ||
                      message.includes('ECONNREFUSED')

    return {
      success: false,
      error: {
        code: 'OPENCLAW_EXECUTION_ERROR',
        message,
        retryable
      },
      executionMs,
      usedOpenClaw: true,
      fallbackActivated: false
    }
  }
}

/**
 * Execute with native fetch fallback
 */
async function executeWithFallback(
  request: ApiAdapterRequest,
  context: AdapterContext,
  startTime: number
): Promise<AdapterResult<ApiAdapterResponse>> {
  console.log(`[ApiAdapter] Using fallback for ${request.method} (OpenClaw only supports GET/POST)`)

  try {
    const controller = new AbortController()
    const timeout = request.timeout || 30000
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const options: RequestInit = {
      method: request.method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...request.headers
      }
    }

    if (request.body && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      options.body = JSON.stringify(request.body)
    }

    const response = await fetch(request.url, options)
    clearTimeout(timeoutId)

    const contentType = response.headers.get('content-type') || ''
    let data: unknown

    if (contentType.includes('application/json')) {
      data = await response.json()
    } else {
      data = await response.text()
    }

    const executionMs = Date.now() - startTime

    return {
      success: true,
      data: {
        status: response.status,
        ok: response.ok,
        data
      },
      executionMs,
      usedOpenClaw: false,
      fallbackActivated: true,
      fallbackReason: `Method ${request.method} not supported by OpenClaw http tool`
    }
  } catch (error) {
    const executionMs = Date.now() - startTime
    const message = error instanceof Error ? error.message : 'Unknown error'

    return {
      success: false,
      error: {
        code: 'FALLBACK_ERROR',
        message,
        retryable: message.includes('AbortError') || message.includes('network')
      },
      executionMs,
      usedOpenClaw: false,
      fallbackActivated: true,
      fallbackReason: `Method ${request.method} not supported by OpenClaw http tool`
    }
  }
}

/**
 * Check if OpenClaw http tool is available
 */
export async function checkOpenClawHttpAvailable(): Promise<boolean> {
  try {
    const result = await executeTool('http', {
      url: 'https://httpbin.org/get',
      method: 'GET'
    })
    return result.success
  } catch {
    return false
  }
}

/**
 * Get adapter info
 */
export function getApiAdapterInfo(): {
  channelType: 'api'
  source: 'granclaw_adapter'
  openclawTool: 'http'
  supportedMethods: string[]
  fallbackMethods: string[]
} {
  return {
    channelType: 'api',
    source: 'granclaw_adapter',
    openclawTool: 'http',
    supportedMethods: ['GET', 'POST'],
    fallbackMethods: ['PUT', 'PATCH', 'DELETE']
  }
}
