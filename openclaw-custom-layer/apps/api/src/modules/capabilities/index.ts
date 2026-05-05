/**
 * Capabilities Module
 * FEATURE 091: Approved Capabilities v1
 * FIX 104: Capability Key Normalization
 * FIX 105: Canonical Capability Groups & Cleanup
 * FIX 111: Capability Dispatcher
 */

export * from './types'
export * from './service'
export * from './capability-normalizer'
export {
  dispatchCapabilityExecution,
  isOsCapability,
  type DispatcherContext,
  type DispatchResult,
  type ExecutionMode
} from './capability-dispatcher'
export {
  handleGetCapabilities,
  handleGetCapabilityById,
  handleEnableCapability,
  handleDisableCapability,
  handleDeleteCapability
} from './routes'
