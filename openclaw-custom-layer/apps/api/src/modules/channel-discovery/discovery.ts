/**
 * Channel Discovery Service
 * P4.1R: OpenClaw-First Integrations & Productionization
 *
 * Resolves "Who should execute this?" for each channel/action.
 */

import type { ChannelType, ChannelStability } from '../channels-runtime/types'
import type {
  ChannelDiscoveryResult,
  ChannelSource,
  GranClawEnhancement
} from './types'
import {
  getChannelSourceMapping,
  getAllChannelSourceMappings,
  hasOpenClawCapability
} from './registry'
import { getChannelProvider } from '../channels-runtime/registry'

/**
 * GranClaw enhancements provided for all adapted/provided channels
 */
const GRANCLAW_ENHANCEMENTS: GranClawEnhancement[] = [
  'queue',
  'validation',
  'retries',
  'runtime_events',
  'websocket',
  'approvals',
  'metrics',
  'audit',
  'rate_limiting',
  'fallback'
]

/**
 * Discover channel execution source
 */
export function discoverChannel(
  channelType: ChannelType,
  tenantId: string
): ChannelDiscoveryResult {
  const mapping = getChannelSourceMapping(channelType)
  const provider = getChannelProvider(channelType)

  if (!mapping || !provider) {
    return {
      channelId: `${channelType}_${tenantId}`,
      channelType,
      source: 'experimental',
      provider: 'unknown',
      capabilities: [],
      stability: 'experimental',
      supportsRealtime: false,
      supportsQueue: false,
      supportsValidation: false,
      supportsApprovals: false,
      supportsMetrics: false,
      fallbackAvailable: false,
      reason: `Channel type '${channelType}' not registered`
    }
  }

  const hasOpenclaw = hasOpenClawCapability(channelType)

  return {
    channelId: `${channelType}_${tenantId}`,
    channelType,
    source: mapping.primarySource,
    provider: mapping.granclawProvider ?? 'unknown',
    capabilities: provider.supportedActions,
    stability: provider.stability,
    supportsRealtime: ['whatsapp', 'browser', 'webhook'].includes(channelType),
    supportsQueue: true,
    supportsValidation: true,
    supportsApprovals: true,
    supportsMetrics: true,
    fallbackAvailable: mapping.fallbackSource !== undefined,
    fallbackSource: mapping.fallbackSource,
    reason: mapping.reason
  }
}

/**
 * Discover all channels for a tenant
 */
export function discoverAllChannels(tenantId: string): ChannelDiscoveryResult[] {
  return getAllChannelSourceMappings().map(mapping =>
    discoverChannel(mapping.channelType, tenantId)
  )
}

/**
 * Get recommended source for action
 */
export function getRecommendedSource(
  channelType: ChannelType,
  action: string,
  context: { openclawAvailable: boolean; openclawHealthy: boolean }
): ChannelSource {
  const mapping = getChannelSourceMapping(channelType)

  if (!mapping) {
    return 'experimental'
  }

  // If OpenClaw adapter and OpenClaw is available/healthy
  if (
    mapping.primarySource === 'granclaw_adapter' &&
    context.openclawAvailable &&
    context.openclawHealthy
  ) {
    return 'granclaw_adapter'
  }

  // If OpenClaw adapter but OpenClaw unavailable, use fallback
  if (
    mapping.primarySource === 'granclaw_adapter' &&
    (!context.openclawAvailable || !context.openclawHealthy)
  ) {
    return mapping.fallbackSource ?? 'granclaw_provider'
  }

  return mapping.primarySource
}

/**
 * Get GranClaw enhancements for a source
 */
export function getEnhancements(source: ChannelSource): GranClawEnhancement[] {
  switch (source) {
    case 'openclaw_native':
      // No enhancements - pure OpenClaw
      return []
    case 'granclaw_adapter':
      // All enhancements on top of OpenClaw
      return GRANCLAW_ENHANCEMENTS
    case 'granclaw_provider':
      // All enhancements (full implementation)
      return GRANCLAW_ENHANCEMENTS
    case 'fallback':
      // Limited enhancements
      return ['queue', 'retries', 'audit']
    case 'experimental':
      // Minimal enhancements
      return ['audit']
  }
}

/**
 * Check if action should use OpenClaw directly
 */
export function shouldUseOpenClawDirect(
  channelType: ChannelType,
  action: string
): boolean {
  // Currently no actions bypass GranClaw layer
  // All go through adapters for governance
  return false
}

/**
 * Get channel classification summary
 */
export function getChannelClassificationSummary(): {
  total: number
  bySource: Record<ChannelSource, number>
  withFallback: number
  withOpenClawRef: number
} {
  const mappings = getAllChannelSourceMappings()

  const bySource: Record<ChannelSource, number> = {
    openclaw_native: 0,
    granclaw_adapter: 0,
    granclaw_provider: 0,
    fallback: 0,
    experimental: 0
  }

  let withFallback = 0
  let withOpenClawRef = 0

  for (const mapping of mappings) {
    bySource[mapping.primarySource]++
    if (mapping.fallbackSource) withFallback++
    if (mapping.openclawRef) withOpenClawRef++
  }

  return {
    total: mappings.length,
    bySource,
    withFallback,
    withOpenClawRef
  }
}
