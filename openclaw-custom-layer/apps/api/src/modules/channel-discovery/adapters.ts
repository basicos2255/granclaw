/**
 * OpenClaw Adapters
 * P4.1R: OpenClaw-First Integrations & Productionization
 *
 * Adapters that wrap OpenClaw tools with GranClaw governance layer.
 */

import type { ChannelType } from '../channels-runtime/types'
import type { AdapterConfig, GranClawEnhancement } from './types'

/**
 * Adapter configurations
 * Defines how GranClaw wraps OpenClaw tools
 */
const adapterConfigs: Map<ChannelType, AdapterConfig> = new Map([
  // API Channel: Wraps OpenClaw 'http' tool
  ['api', {
    channelType: 'api',
    openclawTool: 'http',
    granclawEnhancements: [
      'queue',
      'validation',
      'retries',
      'runtime_events',
      'websocket',
      'approvals',
      'metrics',
      'audit',
      'rate_limiting'
    ],
    passthrough: false
  }],

  // Webhook Channel: Wraps OpenClaw 'http' tool for outgoing
  ['webhook', {
    channelType: 'webhook',
    openclawTool: 'http',
    granclawEnhancements: [
      'queue',
      'validation',
      'retries',
      'runtime_events',
      'websocket',
      'approvals',
      'metrics',
      'audit',
      'rate_limiting'
    ],
    passthrough: false
  }]
])

/**
 * Get adapter config for channel
 */
export function getAdapterConfig(channelType: ChannelType): AdapterConfig | undefined {
  return adapterConfigs.get(channelType)
}

/**
 * Check if channel has adapter
 */
export function hasAdapter(channelType: ChannelType): boolean {
  return adapterConfigs.has(channelType)
}

/**
 * Get all adapter configs
 */
export function getAllAdapterConfigs(): AdapterConfig[] {
  return Array.from(adapterConfigs.values())
}

/**
 * Base adapter interface
 */
export interface OpenClawAdapter<TInput, TOutput> {
  channelType: ChannelType
  openclawTool: string
  enhancements: GranClawEnhancement[]

  /**
   * Pre-process input before sending to OpenClaw
   */
  preProcess(input: TInput): Promise<TInput>

  /**
   * Execute via OpenClaw tool
   */
  executeViaOpenClaw(input: TInput): Promise<TOutput>

  /**
   * Post-process output from OpenClaw
   */
  postProcess(output: TOutput): Promise<TOutput>

  /**
   * Handle fallback when OpenClaw fails
   */
  handleFallback(input: TInput, error: Error): Promise<TOutput>
}

/**
 * API Adapter - Wraps OpenClaw http tool
 */
export interface ApiAdapterInput {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  url: string
  headers?: Record<string, string>
  body?: unknown
  timeout?: number
}

export interface ApiAdapterOutput {
  status: number
  headers: Record<string, string>
  body: unknown
  durationMs: number
}

/**
 * Create API adapter execution context
 */
export function createApiAdapterContext(
  tenantId: string,
  userId?: string
): {
  tenantId: string
  userId?: string
  timestamp: string
  correlationId: string
} {
  return {
    tenantId,
    userId,
    timestamp: new Date().toISOString(),
    correlationId: `api_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }
}

/**
 * Webhook Adapter - Wraps OpenClaw http tool for outgoing webhooks
 */
export interface WebhookAdapterInput {
  url: string
  method: 'GET' | 'POST' | 'PUT'
  payload: unknown
  headers?: Record<string, string>
  signature?: string
}

export interface WebhookAdapterOutput {
  delivered: boolean
  statusCode: number
  response?: unknown
  durationMs: number
  retryCount: number
}

/**
 * Create webhook adapter execution context
 */
export function createWebhookAdapterContext(
  tenantId: string,
  webhookId: string
): {
  tenantId: string
  webhookId: string
  timestamp: string
  correlationId: string
} {
  return {
    tenantId,
    webhookId,
    timestamp: new Date().toISOString(),
    correlationId: `webhook_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }
}

/**
 * Transform OpenClaw http input to adapter format
 */
export function transformToOpenClawHttp(input: ApiAdapterInput): {
  url: string
  method: string
  headers?: Record<string, string>
  body?: string
} {
  return {
    url: input.url,
    method: input.method,
    headers: input.headers,
    body: input.body ? JSON.stringify(input.body) : undefined
  }
}

/**
 * Validate adapter can handle request
 */
export function validateAdapterRequest(
  channelType: ChannelType,
  action: string
): { valid: boolean; reason?: string } {
  const config = adapterConfigs.get(channelType)

  if (!config) {
    return { valid: false, reason: `No adapter for channel type: ${channelType}` }
  }

  // API adapter supports standard HTTP methods
  if (channelType === 'api') {
    const validActions = ['get', 'post', 'put', 'patch', 'delete']
    if (!validActions.includes(action.toLowerCase())) {
      return { valid: false, reason: `Invalid action for API adapter: ${action}` }
    }
  }

  // Webhook adapter supports send/verify
  if (channelType === 'webhook') {
    const validActions = ['send', 'verify', 'configure']
    if (!validActions.includes(action.toLowerCase())) {
      return { valid: false, reason: `Invalid action for webhook adapter: ${action}` }
    }
  }

  return { valid: true }
}
