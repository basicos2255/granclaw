/**
 * OpenClaw Adapters Types
 * P4.2: OpenClaw Capability Mapping & Adapter Consolidation
 *
 * Types for adapters that wrap OpenClaw tools with GranClaw governance.
 */

import type { ChannelType } from '../channels-runtime/types'

/**
 * Adapter execution context
 */
export interface AdapterContext {
  tenantId: string
  userId?: string
  channelId: string
  correlationId: string
  timestamp: string
}

/**
 * Adapter execution result
 */
export interface AdapterResult<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    retryable: boolean
  }
  executionMs: number
  usedOpenClaw: boolean
  fallbackActivated: boolean
  fallbackReason?: string
}

/**
 * OpenClaw tool invocation
 */
export interface OpenClawToolInvocation {
  toolId: string
  input: unknown
  context: AdapterContext
}

/**
 * OpenClaw tool result
 */
export interface OpenClawToolResult {
  success: boolean
  toolId: string
  result: unknown
  error?: string
}

/**
 * Provider justification (required for all providers)
 */
export interface ProviderJustification {
  reason: string
  whyOpenClawNotEnough: string
  fallbackStrategy: 'queue_for_retry' | 'escalate_human' | 'require_setup' | 'skip'
  stability: 'stable' | 'beta' | 'experimental'
  futureMigrationPossible: boolean
  migrateWhen?: string
}

/**
 * Channel source with justification
 */
export interface ChannelSourceWithJustification {
  channelType: ChannelType
  source: 'openclaw_native' | 'granclaw_adapter' | 'granclaw_provider'
  openclawTool?: string
  justification?: ProviderJustification
}

/**
 * API adapter request
 */
export interface ApiAdapterRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  url: string
  headers?: Record<string, string>
  body?: unknown
  timeout?: number
  retryCount?: number
}

/**
 * API adapter response
 */
export interface ApiAdapterResponse {
  status: number
  ok: boolean
  data: unknown
  headers?: Record<string, string>
}

/**
 * Webhook adapter request
 */
export interface WebhookAdapterRequest {
  url: string
  method: 'GET' | 'POST' | 'PUT'
  payload: unknown
  headers?: Record<string, string>
  signature?: string
  retryCount?: number
}

/**
 * Webhook adapter response
 */
export interface WebhookAdapterResponse {
  delivered: boolean
  statusCode: number
  response?: unknown
  retryCount: number
}

/**
 * Runtime responsibility split
 */
export interface RuntimeResponsibility {
  openclaw: string[]
  granclaw: string[]
}

export const RUNTIME_RESPONSIBILITY: RuntimeResponsibility = {
  openclaw: [
    'reasoning',
    'tool_execution',
    'native_capabilities',
    'chat_sessions',
    'rpc_gateway'
  ],
  granclaw: [
    'workflows',
    'queue',
    'dag_execution',
    'validation',
    'recovery',
    'approvals',
    'websocket_realtime',
    'memory_patterns',
    'metrics',
    'audit',
    'ux_product',
    'channel_abstraction'
  ]
}
