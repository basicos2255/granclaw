/**
 * Runtime Queue Module
 * PHASE H1: Runtime Hardening & Platform Stabilization
 *
 * Durable job queue with intelligent retry, dead letter queue,
 * and crash recovery support.
 */

// Types
export type {
  JobStatus,
  JobPriority,
  ErrorCategory,
  RetryPolicy,
  JobContext,
  QueuedJob,
  JobError,
  JobHandler,
  JobHelpers,
  JobHandlerResult,
  QueueConfig,
  QueueStats,
  QueueEvent,
  QueueEventType,
  QueueEventListener,
  DeadLetterEntry,
  JobFilter,
  SchedulerState,
  ResourceCheckResult,
  BatchOperationResult
} from './types'

export {
  DEFAULT_RETRY_POLICIES,
  DEFAULT_QUEUE_CONFIG
} from './types'

// Queue
export {
  RuntimeQueue,
  getQueue,
  resetQueue
} from './queue'

// Retry Engine
export {
  classifyError,
  createJobError,
  createJobErrorFromResult,
  getEffectiveRetryPolicy,
  shouldRetry,
  calculateRetryDelay,
  analyzeErrorHistory,
  getRetryStatusMessage
} from './retry-engine'

export type {
  RetryDecision,
  ErrorAnalysis
} from './retry-engine'

// Scheduler
export {
  registerHandler,
  unregisterHandler,
  setResourceChecker,
  startScheduler,
  stopScheduler,
  pauseScheduler,
  resumeScheduler,
  requestCancellation,
  getSchedulerState,
  checkStaleJobs,
  recoverStaleJob,
  drainScheduler,
  getRegisteredHandlers
} from './scheduler'

// Persistence
export {
  setPersistenceConfig,
  saveQueueState,
  loadQueueState,
  saveDeadLetterState,
  loadDeadLetterState,
  startPeriodicPersistence,
  stopPeriodicPersistence,
  initializePersistence,
  findOrphanedJobs
} from './persistence'

// Dead Letter Queue
export {
  addToDeadLetter,
  listDeadLetter,
  getDeadLetterJob,
  requeueJob,
  bulkRequeue,
  deleteDeadLetterEntry,
  clearAllDeadLetter,
  getDeadLetterStats,
  getCount as getDeadLetterCount,
  analyzeDeadLetter
} from './dead-letter'

export type {
  DeadLetterStats,
  RequeueOptions,
  DeadLetterAnalysis
} from './dead-letter'

// Startup Recovery
export {
  performStartupRecovery,
  checkQueueHealth,
  gracefulShutdown,
  savePreShutdownState
} from './startup-recovery'

export type {
  RecoveryReport,
  RecoveryOptions,
  QueueHealthCheck
} from './startup-recovery'

// H1.1: Execution Integration
export {
  shouldEnqueueExecution,
  enqueueDagExecution,
  enqueueCompositeTask,
  enqueueSimpleTask,
  initializeExecutionHandlers,
  isExecutionIntegrationReady
} from './execution-integration'

export type {
  QueuedExecutionType,
  EnqueueExecutionOptions,
  EnqueueResult,
  ExecutionCriteria
} from './execution-integration'

// Convenience initialization
import { RuntimeQueue, getQueue } from './queue'
import { initializePersistence, startPeriodicPersistence, stopPeriodicPersistence } from './persistence'
import { startScheduler, stopScheduler } from './scheduler'
import { initializeExecutionHandlers } from './execution-integration'

/**
 * Initialize and start the runtime queue system
 */
export function initializeRuntimeQueue(config?: {
  persistenceIntervalMs?: number
  autoRecover?: boolean
  /** H1.1: Initialize execution handlers (dag, composite, simple tasks) */
  initExecutionHandlers?: boolean
}): {
  queue: RuntimeQueue
  loadedJobs: number
  orphanedJobs: number
  deadLetterCount: number
} {
  const queue = getQueue()

  // Load persisted state
  const result = initializePersistence(queue)

  // Start periodic persistence
  startPeriodicPersistence(queue, config?.persistenceIntervalMs || 5000)

  // Start scheduler
  startScheduler(queue)

  // H1.1: Initialize execution handlers
  if (config?.initExecutionHandlers !== false) {
    initializeExecutionHandlers()
  }

  console.log('[RuntimeQueue] Initialized:', result)

  return {
    queue,
    ...result
  }
}

/**
 * Gracefully shutdown the runtime queue system
 */
export async function shutdownRuntimeQueue(drainTimeoutMs = 30000): Promise<void> {
  const queue = getQueue()

  // Stop accepting new jobs
  stopScheduler()

  // Stop periodic persistence
  stopPeriodicPersistence()

  // Final save
  const { saveQueueState: save } = await import('./persistence')
  save(queue)

  console.log('[RuntimeQueue] Shutdown complete')
}
