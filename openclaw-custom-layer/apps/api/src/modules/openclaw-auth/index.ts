/**
 * OpenClaw Auth Module
 * P6.4R: Persistent Pairing, Auth Lifecycle & Route Consistency
 *
 * Central module for OpenClaw authentication and pairing lifecycle.
 */

// =============================================================================
// Types
// =============================================================================

export type {
  OpenClawAuthState,
  ConnectionState,
  AuthState,
  CapabilityState,
  OpenClawAuthEvent,
  OpenClawWsEventType,
  OpenClawEventLog,
  LastCheckResult,
  OpenClawAuthData,
  OpenClawIssue,
  OpenClawHealthResponse,
  CapabilityUsabilityResult
} from './types'

export {
  STATE_TRANSITIONS,
  DEFAULT_AUTH_STATE
} from './types'

// =============================================================================
// Pairing State
// =============================================================================

export {
  getAuthState,
  getAuthHealth,
  processEvent,
  updateConnectionState,
  updateAuthState,
  updateCapabilityState,
  recordSuccessfulExecution,
  recordScopeNeedsAuth,
  clearScopeAuth,
  subscribeToAuthState,
  deriveOverallState
} from './pairing-state'

// =============================================================================
// Auth Lifecycle
// =============================================================================

export {
  checkConnection,
  checkAuth,
  checkCapabilities,
  runAuthHealthCheck,
  onSuccessfulExecution,
  onScopeAuthFailure,
  onScopeAuthRestored,
  startRepairSession as startRepair,
  completeRepairSession as completeRepair,
  resetAllAuthState,
  getOverallState,
  isPairingHealthy,
  canExecuteCapabilities
} from './auth-lifecycle'

// =============================================================================
// Session Check
// =============================================================================

export {
  isSessionValid,
  isSessionExpired,
  needsReauthorization,
  needsRepair,
  getQuickSessionStatus,
  refreshSession,
  quickConnectionCheck,
  quickAuthCheck,
  runStartupCheck
} from './session-check'

// =============================================================================
// Capability Check (CRITICAL)
// =============================================================================

export {
  isCapabilityActuallyUsable,
  markScopeNeedsAuth,
  markScopeAuthorized,
  getScopesNeedingAuth,
  hasScopesNeedingAuth,
  checkMultipleCapabilities,
  areAllCapabilitiesUsable,
  getUnusableCapabilities,
  preExecutionCheck
} from './capability-check'

// =============================================================================
// Repair Flow
// =============================================================================

export {
  createRepairSession,
  getActiveRepairSession,
  getRepairSession,
  startRepairSession,
  completeRepairSession,
  failRepairSession,
  cancelRepairSession,
  quickRepair,
  cleanupExpiredSessions,
  type RepairSession
} from './repair-flow'

// =============================================================================
// Persistence
// =============================================================================

export {
  loadAuthState,
  saveAuthState,
  resetAuthState,
  reloadAuthState,
  getStateFilePath,
  stateFileExists
} from './persistence'

// =============================================================================
// WS Events
// =============================================================================

export {
  emitOpenClawEvent,
  emitPairingRestored,
  emitReauthorizationRequired,
  emitRepairRequired
} from './ws-events'

// =============================================================================
// Handlers (Native HTTP)
// =============================================================================

export {
  handleGetOpenClawHealth,
  handleGetOpenClawStatus,
  handleGetOpenClawState,
  handleOpenClawCheck,
  handleOpenClawRefresh,
  handleGetCapabilityUsable,
  handleCanExecute,
  handlePreCheck,
  handleGetScopesNeedingAuth,
  handleCreateRepair,
  handleGetActiveRepair,
  handleGetRepairById,
  handleStartRepairById,
  handleCompleteRepairById,
  handleFailRepairById,
  handleCancelRepairById,
  handleQuickRepair,
  handleOpenClawReset,
  handleOpenClawReload,
  runOpenClawStartupCheck
} from './handlers'
