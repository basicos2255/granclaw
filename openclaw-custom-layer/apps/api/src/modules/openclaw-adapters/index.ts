/**
 * OpenClaw Adapters Module
 * P4.2: OpenClaw Capability Mapping & Adapter Consolidation
 *
 * Adapters that wrap OpenClaw tools with GranClaw governance.
 * Providers are only used when OpenClaw cannot support the capability.
 */

// Types
export type {
  AdapterContext,
  AdapterResult,
  OpenClawToolInvocation,
  OpenClawToolResult,
  ProviderJustification,
  ChannelSourceWithJustification,
  ApiAdapterRequest,
  ApiAdapterResponse,
  WebhookAdapterRequest,
  WebhookAdapterResponse,
  RuntimeResponsibility
} from './types'

export { RUNTIME_RESPONSIBILITY } from './types'

// API Adapter
export {
  executeApiRequest,
  checkOpenClawHttpAvailable,
  getApiAdapterInfo
} from './api-adapter'

// Webhook Adapter
export {
  sendWebhook,
  verifyWebhookSignature,
  parseIncomingWebhook,
  getWebhookAdapterInfo
} from './webhook-adapter'

// Provider Justifications
export {
  getProviderJustification,
  requiresProvider,
  getAllChannelSources,
  getClassificationSummary,
  validateProviderJustifications
} from './provider-justifications'
