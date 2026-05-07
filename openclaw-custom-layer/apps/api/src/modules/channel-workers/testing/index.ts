/**
 * Testing Module
 * P5.1: Controlled Real Testing & Connector Hardening
 *
 * Exports all testing and hardening utilities.
 */

// Environments
export {
  getCurrentEnvironment,
  setEnvironment,
  getEnvironmentConfig,
  isFeatureEnabled,
  getLimit,
  isActionAllowed,
  hasEscalationKeyword,
  canTransitionTo,
  getEnvironmentSummary
} from './environments'

export type {
  RuntimeEnvironment,
  EnvironmentConfig,
  EnvironmentFeatures,
  EnvironmentLimits,
  EnvironmentSafety
} from './environments'

// Worker Modes
export {
  registerWorkerMode,
  getWorkerModeCapabilities,
  workerSupportsMode,
  getWorkerFeatures,
  canWorkerPerformAction,
  initializeWorkerModes,
  getAllWorkerModes,
  getWorkersForCurrentEnvironment
} from './worker-modes'

export type {
  WorkerModeCapabilities,
  WorkerModeFeatures
} from './worker-modes'

// Email Sandbox
export {
  initializeEmailSandbox,
  isEmailAllowed,
  isDuplicateMessage,
  clearDedupeSet,
  trackTestThread,
  getTestThreads,
  validateAttachment,
  recordConnection,
  getEmailSandboxState,
  incrementProcessed,
  getEmailSandboxConfig,
  shouldTriggerWorkflow
} from './email-sandbox'

export type {
  EmailSandboxConfig,
  EmailTestThread,
  AttachmentTest
} from './email-sandbox'

// WhatsApp Controls
export {
  initializeWhatsAppControls,
  canReply,
  recordReply,
  isMessageProcessed,
  markMessageProcessed,
  blockConversation,
  saveSessionState,
  restoreSessionState,
  recordReconnect as recordWhatsAppReconnect,
  getReconnectBackoff,
  getWhatsAppControlState
} from './whatsapp-controls'

export type {
  WhatsAppControlConfig,
  ConversationState
} from './whatsapp-controls'

// Browser Health
export {
  initializeBrowserHealth,
  stopBrowserHealth,
  registerContext,
  getReusableContext,
  updateContextUsage,
  recordCrash,
  attemptCrashRecovery,
  trackDownload,
  updateDownloadProgress,
  attemptDownloadRecovery,
  cleanupOldContexts,
  getBrowserHealthState,
  getRecentCrashes
} from './browser-health'

export type {
  BrowserHealthConfig,
  BrowserContextState,
  BrowserCrashRecord,
  DownloadRecoveryState
} from './browser-health'

// FTP Hardening
export {
  initializeFTPHardening,
  recordConnectionAttempt,
  startTransfer,
  updateTransferProgress,
  detectPartialUpload,
  completeTransfer,
  retryTransfer,
  calculateChecksum,
  validateChecksum,
  createRollbackMetadata,
  markDeployCompleted,
  executeRollback,
  getFTPHardeningState,
  getTransfer,
  cleanOldTransfers
} from './ftp-hardening'

export type {
  FTPHardeningConfig,
  TransferState,
  RollbackMetadata
} from './ftp-hardening'

// Soak Tests
export {
  SOAK_DURATIONS,
  startSoakTest,
  recordSoakMetric,
  recordSoakFailure,
  endSoakTest,
  getSoakTestStatus,
  getSoakTestHistory,
  stopSoakTest
} from './soak-tests'

export type {
  SoakTestConfig,
  SoakTestResult,
  SoakTestMetrics,
  SoakTestFailure
} from './soak-tests'

// Failure Simulation
export {
  startFailureSimulation,
  endFailureSimulation,
  hasInjectedFailure,
  markAuditEmitted,
  markNotificationEmitted,
  getSimulationStatus,
  getSimulationHistory,
  stopSimulation,
  verifyRecoveryExpectations,
  runAllFailureScenarios
} from './failure-simulation'

export type {
  FailureType,
  FailureSimulationConfig,
  FailureSimulationResult
} from './failure-simulation'

// Observability
export {
  METRICS,
  incrementCounter,
  setGauge,
  observeHistogram,
  getCounter,
  getGauge,
  getMetricsPrometheus,
  getMetricsSummary,
  resetMetrics,
  recordWorkerReconnect,
  recordWorkflowResult,
  updateQueueMetrics,
  updateWorkerHealthMetrics
} from './observability'

export type {
  MetricType,
  MetricDefinition,
  MetricValue,
  HistogramBucket
} from './observability'

// Safety Gates
export {
  initializeSafetyGates,
  checkGate,
  requestGateOverride,
  approveGateOverride,
  revokeGateOverride,
  recordViolation,
  getAllGateStatuses,
  getViolations,
  checkProductionReadiness,
  getSafetySummary
} from './safety-gates'

export type {
  SafetyGate,
  GateStatus
} from './safety-gates'

// Re-import for internal use
import { initializeWorkerModes as _initWorkerModes } from './worker-modes'
import { initializeSafetyGates as _initSafetyGates } from './safety-gates'

/**
 * Initialize all testing modules
 */
export function initializeTestingModules(): void {
  _initWorkerModes()
  _initSafetyGates()
  console.log('[Testing] All modules initialized')
}
