/**
 * Pairing State Module
 * P6.4: Persistent Pairing, Auth Lifecycle & Route Consistency
 *
 * Centralized state machine for OpenClaw connection, auth, and capability states.
 */

export * from './types'
export * from './service'
export {
  runPairingHealthCheck,
  syncSuccessfulExecution,
  syncScopeAuthFailure,
  syncScopeAuthResolved,
  getCombinedHealthStatus
} from './sync'
export {
  handleGetPairingState,
  handleGetPairingHealth,
  handleResetPairingState,
  handleReloadPairingState,
  handleRunPairingCheck,
  handleGetCombinedHealth
} from './routes'
