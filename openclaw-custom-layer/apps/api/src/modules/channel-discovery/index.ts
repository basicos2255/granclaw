/**
 * Channel Discovery Module
 * P4.1R: OpenClaw-First Integrations & Productionization
 *
 * Central module for channel source classification and discovery.
 */

// Types
export type {
  ChannelSource,
  ChannelDiscoveryResult,
  OpenClawCapabilityRef,
  ChannelSourceMapping,
  AdapterConfig,
  GranClawEnhancement,
  FallbackStrategy,
  FallbackTrigger,
  FallbackAction,
  ChannelAuditEntry
} from './types'

// Registry
export {
  getOpenClawCapability,
  getAllOpenClawCapabilities,
  getChannelSourceMapping,
  getAllChannelSourceMappings,
  getChannelsBySource,
  hasOpenClawCapability,
  getSourceSummary
} from './registry'

// Discovery
export {
  discoverChannel,
  discoverAllChannels,
  getRecommendedSource,
  getEnhancements,
  shouldUseOpenClawDirect,
  getChannelClassificationSummary
} from './discovery'

// Adapters
export {
  getAdapterConfig,
  hasAdapter,
  getAllAdapterConfigs,
  createApiAdapterContext,
  createWebhookAdapterContext,
  transformToOpenClawHttp,
  validateAdapterRequest
} from './adapters'
export type {
  OpenClawAdapter,
  ApiAdapterInput,
  ApiAdapterOutput,
  WebhookAdapterInput,
  WebhookAdapterOutput
} from './adapters'

// Fallback
export {
  getFallbackStrategy,
  determineFallbackAction,
  classifyError,
  getFallbackSource,
  hasFallbackAvailable,
  executeFallback,
  getFallbackSummary
} from './fallback'
