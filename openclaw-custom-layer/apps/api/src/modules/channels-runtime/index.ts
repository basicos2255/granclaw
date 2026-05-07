/**
 * Channels Runtime Module
 * P3: Real Integrations & Operational Channels
 *
 * Main entry point for channel integrations.
 */

// Export types
export * from './types'

// Export registry
export {
  registerChannelProvider,
  getChannelProvider,
  getAllChannelProviders,
  getProvidersByStability,
  isProviderAvailable,
  initializeBuiltInProviders,
  getProviderSummary
} from './registry'

// Export permissions
export {
  getScopeDefinition,
  getScopesForChannelType,
  hasRequiredScopes,
  actionRequiresApproval,
  getActionRiskLevel,
  validateCredentialScopes,
  getScopeDescription,
  isChannelSetupComplete
} from './permissions'

// Export event adapter
export {
  registerWorkflowTrigger,
  removeWorkflowTrigger,
  subscribeToChannelEvents,
  emitChannelEvent,
  createChannelEventFromWebhook,
  getRecentEvents,
  initializeEventAdapter
} from './event-adapter'

// Export runtime integration
export {
  checkRateLimits,
  incrementRateLimits,
  isRecursiveReply,
  needsHumanEscalation,
  recordChannelError,
  recordChannelSuccess,
  enqueueChannelAction,
  executeApprovedAction,
  handleActionResult,
  createJobFromChannelEvent,
  initializeRuntimeIntegration
} from './runtime-integration'

// Export channel manager
export {
  createChannel,
  getChannel,
  getChannelsByTenant,
  getChannelsByType,
  updateChannel,
  connectChannel,
  disconnectChannel,
  deleteChannel,
  updateChannelStatus,
  updateChannelMetrics,
  setChannelCredential,
  performHealthChecks,
  getChannelStats,
  initializeChannelManager
} from './channel-manager'

/**
 * Initialize the entire channels runtime module
 */
export function initializeChannelsRuntime(): void {
  console.log('[ChannelsRuntime] Initializing...')

  // Initialize built-in providers
  const { initializeBuiltInProviders } = require('./registry')
  initializeBuiltInProviders()

  // Initialize event adapter
  const { initializeEventAdapter } = require('./event-adapter')
  initializeEventAdapter()

  // Initialize runtime integration
  const { initializeRuntimeIntegration } = require('./runtime-integration')
  initializeRuntimeIntegration()

  // Initialize channel manager
  const { initializeChannelManager } = require('./channel-manager')
  initializeChannelManager()

  console.log('[ChannelsRuntime] Initialization complete')
}
