/**
 * Channel Discovery Types
 * P4.1R: OpenClaw-First Integrations & Productionization
 *
 * Classification system for channels based on OpenClaw-first strategy.
 */

import type { ChannelType, ChannelStability } from '../channels-runtime/types'

/**
 * Channel source classification
 * Determines who executes/owns the channel
 */
export type ChannelSource =
  | 'openclaw_native'     // OpenClaw tool/MCP/capability handles it
  | 'granclaw_adapter'    // GranClaw wraps OpenClaw capability
  | 'granclaw_provider'   // GranClaw implements fully (OpenClaw can't)
  | 'fallback'            // Fallback when primary fails
  | 'experimental'        // Experimental/unstable implementation

/**
 * Channel discovery result
 */
export interface ChannelDiscoveryResult {
  channelId: string
  channelType: ChannelType
  source: ChannelSource
  provider: string
  capabilities: string[]
  stability: ChannelStability
  supportsRealtime: boolean
  supportsQueue: boolean
  supportsValidation: boolean
  supportsApprovals: boolean
  supportsMetrics: boolean
  fallbackAvailable: boolean
  fallbackSource?: ChannelSource
  reason: string
}

/**
 * OpenClaw capability reference
 */
export interface OpenClawCapabilityRef {
  toolName: string
  type: 'tool' | 'mcp' | 'capability' | 'browser' | 'connector'
  available: boolean
  scopes?: string[]
  limitations?: string[]
}

/**
 * Channel source mapping
 */
export interface ChannelSourceMapping {
  channelType: ChannelType
  primarySource: ChannelSource
  openclawRef?: OpenClawCapabilityRef
  granclawProvider?: string
  fallbackSource?: ChannelSource
  reason: string
}

/**
 * Adapter configuration
 */
export interface AdapterConfig {
  channelType: ChannelType
  openclawTool: string
  granclawEnhancements: GranClawEnhancement[]
  passthrough: boolean
}

/**
 * GranClaw enhancements over OpenClaw
 */
export type GranClawEnhancement =
  | 'queue'
  | 'validation'
  | 'retries'
  | 'runtime_events'
  | 'websocket'
  | 'approvals'
  | 'metrics'
  | 'audit'
  | 'rate_limiting'
  | 'fallback'

/**
 * Fallback strategy
 */
export interface FallbackStrategy {
  channelType: ChannelType
  triggerConditions: FallbackTrigger[]
  fallbackAction: FallbackAction
  maxRetries: number
  cooldownMs: number
}

export type FallbackTrigger =
  | 'openclaw_unavailable'
  | 'timeout'
  | 'auth_expired'
  | 'rate_limited'
  | 'capability_disabled'
  | 'network_error'

export type FallbackAction =
  | 'use_granclaw_provider'
  | 'queue_for_retry'
  | 'require_setup'
  | 'escalate_human'
  | 'skip'

/**
 * Channel audit entry
 */
export interface ChannelAuditEntry {
  channelType: ChannelType
  source: ChannelSource
  openclawNative: boolean
  adapterUsed: boolean
  providerUsed: boolean
  fallbackUsed: boolean
  reason: string
  timestamp: string
}

/**
 * P4.2: Provider justification (mandatory for all providers)
 */
export interface ProviderJustification {
  reason: string
  whyOpenClawNotEnough: string
  fallbackStrategy: FallbackAction
  stability: 'stable' | 'beta' | 'experimental'
  futureMigrationPossible: boolean
  migrateWhen?: string
}

/**
 * P4.2: Runtime responsibility split
 */
export interface RuntimeResponsibilitySplit {
  openclaw: OpenClawResponsibility[]
  granclaw: GranClawResponsibility[]
}

export type OpenClawResponsibility =
  | 'reasoning'
  | 'tool_execution'
  | 'native_capabilities'
  | 'chat_sessions'
  | 'rpc_gateway'

export type GranClawResponsibility =
  | 'workflows'
  | 'queue'
  | 'dag_execution'
  | 'validation'
  | 'recovery'
  | 'approvals'
  | 'websocket_realtime'
  | 'memory_patterns'
  | 'metrics'
  | 'audit'
  | 'ux_product'
  | 'channel_abstraction'
