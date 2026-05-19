/**
 * Capabilities Module
 * FEATURE 091: Approved Capabilities v1
 * FIX 104: Capability Key Normalization
 * FIX 105: Canonical Capability Groups & Cleanup
 * FIX 111: Capability Dispatcher
 * P6.13: Capability Readiness
 * P6.18: Real Capability Probe
 * P6.18D5: /tools shape normalization, pre-proposal capability gate
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
// P6.18: Export probe functions
// P6.18D: Export extended probe and capability gate functions
export {
  probeOpenClawGateway,
  probeCapabilityReadiness,
  probeAllCapabilities,
  isCapabilityReady,
  getCapabilityDefinitions,
  // P6.18D: Extended probe functions
  probeCLI,
  probeGatewayTools,
  probeGatewayPlugins,
  probeOpenClawGatewayExtended,
  getCapabilityGateReadiness,
  hasRequiredToolForCapability,
  clearProbeCache
} from './probe'
export {
  handleGetCapabilities,
  handleGetCapabilityById,
  handleEnableCapability,
  handleDisableCapability,
  handleDeleteCapability,
  // P6.13: Capability readiness handlers
  handleGetAllCapabilitiesReadiness,
  handleGetCapabilityReadiness,
  handleTestCapability,
  // P6.18: Probe handlers
  handleProbeGateway,
  handleProbeCapability,
  handleProbeAllCapabilities
} from './routes'
