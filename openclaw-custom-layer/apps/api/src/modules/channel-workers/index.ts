/**
 * Channel Workers Module
 * P5: Durable Operational Workers & Real Connectors
 *
 * Persistent worker runtime for channel connections.
 */

// Types
export type {
  WorkerStatus,
  WorkerHealth,
  WorkerRuntimeState,
  ChannelWorker,
  WorkerConfig,
  WorkerCredentials,
  WorkerHandler,
  WorkerRegistryEntry,
  WorkerFactory,
  WorkerPersistedState,
  WorkerManagerStats,
  HealthCheckResult,
  RecoveryAction,
  RecoveryResult
} from './types'

// Registry
export {
  registerWorkerFactory,
  createWorker,
  getWorker,
  getWorkerByChannel,
  getAllWorkers,
  getWorkersByStatus,
  getWorkersByType,
  getWorkersByTenant,
  removeWorker,
  updateWorkerStatus,
  updateWorkerState,
  recordHeartbeat,
  recordFailure,
  getWorkerStats,
  hasFactory,
  getRegisteredFactories
} from './worker-registry'

// Lifecycle
export {
  startWorker,
  stopWorker,
  restartWorker,
  stopAllWorkers,
  gracefulShutdown,
  recoverWorkersOnStartup,
  getWorkerLifecycleInfo
} from './lifecycle'

// Health
export {
  getSystemHealth,
  getAllWorkerHealth,
  getWorkerHealth,
  getWorkersByHealth,
  getWorkersNeedingAttention,
  isSystemOperational,
  getHealthMetrics
} from './health'

export type {
  SystemHealth,
  WorkerHealthSummary
} from './health'

// Persistence
export {
  loadAllStates,
  saveAllStates,
  loadWorkerState,
  saveWorkerState,
  deleteWorkerState,
  clearAllStates,
  getSavedChannelIds,
  hasWorkerState,
  flushToDisk,
  getPersistenceStats,
  cleanupOldStates
} from './persistence'

// Heartbeat
export {
  startHeartbeat,
  stopHeartbeat,
  checkWorker,
  getHeartbeatConfig,
  updateHeartbeatConfig,
  isHeartbeatRunning
} from './heartbeat'

// Recovery
export {
  reconnectWorker,
  restoreWorker,
  restartWorker as restartFailedWorker,
  recoverAllWorkers as recoverAllFailedWorkers,
  getRecoveryConfig,
  updateRecoveryConfig,
  determineRecoveryAction
} from './recovery'

// Manager
export {
  initializeWorkerManager,
  createWorker as createManagedWorker,
  destroyWorker,
  rebootWorker,
  findWorker,
  listWorkers,
  getManagerStatus,
  getWorkerDetails,
  stopTenantWorkers,
  stopChannelWorkers,
  persistAllStates,
  shutdownManager,
  recoverAllWorkers
} from './worker-manager'

// Workers
export {
  BaseWorker,
  EmailWorker,
  WhatsAppWorker,
  BrowserWorker,
  FTPWorker,
  SFTPWorker,
  CalendarWorker,
  FilesystemWorker,
  emailWorkerFactory,
  whatsappWorkerFactory,
  browserWorkerFactory,
  ftpWorkerFactory,
  sftpWorkerFactory,
  calendarWorkerFactory,
  filesystemWorkerFactory,
  workerFactories,
  registerAllWorkerFactories,
  getAvailableWorkerTypes
} from './workers'

// Routes
export {
  handleGetSystemHealth,
  handleGetAllWorkersHealth,
  handleGetWorkerHealth,
  handleGetWorkersNeedingAttention,
  handleCheckOperational,
  handleGetMetrics,
  handleGetManagerStatus,
  handleListWorkers,
  handleGetWorker,
  handleCreateWorker,
  handleDeleteWorker,
  handleRestartWorker
} from './routes'

export type { WorkerCreateRequest, ApiResponse } from './routes'

// Safety
export {
  canCreateWorker,
  recordReconnect,
  runSafetyChecks,
  startSafetyMonitor,
  stopSafetyMonitor,
  getSafetyConfig,
  updateSafetyConfig,
  isSafetyMonitorRunning,
  getSafetyStatus
} from './safety'

export type { SafetyConfig, SafetyViolation, SafetyCheckResult } from './safety'
