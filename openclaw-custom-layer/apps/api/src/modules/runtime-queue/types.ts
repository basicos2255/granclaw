/**
 * Runtime Queue Types
 * PHASE H1: Runtime Hardening & Platform Stabilization
 *
 * Core type definitions for the durable execution queue system.
 */

/**
 * Job status lifecycle
 */
export type JobStatus =
  | 'pending'      // Waiting in queue
  | 'scheduled'    // Picked up by scheduler, waiting for resources
  | 'running'      // Currently executing
  | 'completed'    // Successfully finished
  | 'failed'       // Failed after all retries exhausted
  | 'retrying'     // Failed but will retry
  | 'cancelled'    // User cancelled
  | 'dead'         // Moved to dead letter queue

/**
 * Job priority levels
 */
export type JobPriority = 'critical' | 'high' | 'normal' | 'low' | 'background'

/**
 * Error classification for intelligent retry
 */
export type ErrorCategory =
  | 'transient'      // Network timeouts, rate limits - should retry
  | 'resource'       // Resource exhaustion - back off and retry
  | 'validation'     // Input validation - don't retry
  | 'auth'           // Authentication/authorization - don't retry
  | 'dependency'     // Dependency failure - may retry after dependency fixes
  | 'internal'       // Internal error - may retry
  | 'unknown'        // Unknown - conservative retry

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  /** Maximum retry attempts */
  maxRetries: number
  /** Initial delay in ms before first retry */
  initialDelayMs: number
  /** Maximum delay in ms between retries */
  maxDelayMs: number
  /** Backoff multiplier (1 = linear, 2 = exponential) */
  backoffMultiplier: number
  /** Jitter factor (0-1) to add randomness */
  jitterFactor: number
  /** Error categories that should not retry */
  nonRetryableCategories: ErrorCategory[]
}

/**
 * Default retry policies by error category
 */
export const DEFAULT_RETRY_POLICIES: Record<ErrorCategory, Partial<RetryPolicy>> = {
  transient: { maxRetries: 5, initialDelayMs: 1000, backoffMultiplier: 2 },
  resource: { maxRetries: 3, initialDelayMs: 5000, backoffMultiplier: 2 },
  validation: { maxRetries: 0 },
  auth: { maxRetries: 0 },
  dependency: { maxRetries: 3, initialDelayMs: 2000, backoffMultiplier: 1.5 },
  internal: { maxRetries: 2, initialDelayMs: 1000, backoffMultiplier: 2 },
  unknown: { maxRetries: 1, initialDelayMs: 2000, backoffMultiplier: 2 }
}

/**
 * Job execution context
 */
export interface JobContext {
  tenantId: string
  userId?: string
  sessionId?: string
  correlationId?: string
  parentJobId?: string
  metadata?: Record<string, unknown>
}

/**
 * Queued job definition
 */
export interface QueuedJob<T = unknown> {
  /** Unique job identifier */
  id: string
  /** Job type/handler name */
  type: string
  /** Job payload */
  payload: T
  /** Execution context */
  context: JobContext
  /** Current status */
  status: JobStatus
  /** Priority level */
  priority: JobPriority
  /** Custom retry policy (overrides defaults) */
  retryPolicy?: Partial<RetryPolicy>
  /** Current retry attempt (0 = first try) */
  retryCount: number
  /** Next retry timestamp (if retrying) */
  nextRetryAt?: string
  /** Last error information */
  lastError?: JobError
  /** Error history */
  errorHistory: JobError[]
  /** Timestamps */
  createdAt: string
  scheduledAt?: string
  startedAt?: string
  completedAt?: string
  /** Deadline for job completion */
  deadlineAt?: string
  /** Tags for filtering/grouping */
  tags: string[]
  /** Result of successful execution */
  result?: unknown
  /** Progress percentage (0-100) */
  progress?: number
  /** Progress message */
  progressMessage?: string
}

/**
 * Job error with classification
 */
export interface JobError {
  /** Error message */
  message: string
  /** Error code */
  code?: string
  /** Error category for retry decisions */
  category: ErrorCategory
  /** Stack trace (truncated) */
  stack?: string
  /** When the error occurred */
  occurredAt: string
  /** Retry attempt when error occurred */
  retryAttempt: number
  /** Additional error details */
  details?: Record<string, unknown>
}

/**
 * Job handler function signature
 */
export type JobHandler<T = unknown, R = unknown> = (
  job: QueuedJob<T>,
  helpers: JobHelpers
) => Promise<JobHandlerResult<R>>

/**
 * Helpers available to job handlers
 */
export interface JobHelpers {
  /** Report progress */
  reportProgress: (percent: number, message?: string) => void
  /** Check if job should be cancelled */
  shouldCancel: () => boolean
  /** Log with job context */
  log: (level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown) => void
  /** Get remaining time before deadline */
  getRemainingTime: () => number | null
}

/**
 * Result returned by job handler
 */
export interface JobHandlerResult<R = unknown> {
  /** Whether execution succeeded */
  success: boolean
  /** Result data (if success) */
  result?: R
  /** Error (if failed) */
  error?: {
    message: string
    code?: string
    category?: ErrorCategory
    details?: Record<string, unknown>
  }
  /** Should retry even if policy says no */
  forceRetry?: boolean
  /** Should not retry even if policy says yes */
  skipRetry?: boolean
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  /** Maximum concurrent jobs per queue */
  maxConcurrentJobs: number
  /** Maximum pending jobs in queue */
  maxPendingJobs: number
  /** Default job timeout in ms */
  defaultTimeoutMs: number
  /** How often to persist queue state (ms) */
  persistenceIntervalMs: number
  /** How often to check for stale jobs (ms) */
  staleCheckIntervalMs: number
  /** Job considered stale after this many ms without heartbeat */
  staleThresholdMs: number
  /** Polling interval for scheduler (ms) */
  pollIntervalMs: number
  /** Enable dead letter queue */
  enableDeadLetter: boolean
  /** Default retry policy */
  defaultRetryPolicy: RetryPolicy
}

/**
 * Default queue configuration
 */
export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  maxConcurrentJobs: 5,
  maxPendingJobs: 100,
  defaultTimeoutMs: 300000, // 5 minutes
  persistenceIntervalMs: 5000,
  staleCheckIntervalMs: 30000,
  staleThresholdMs: 60000,
  pollIntervalMs: 1000,
  enableDeadLetter: true,
  defaultRetryPolicy: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    nonRetryableCategories: ['validation', 'auth']
  }
}

/**
 * Queue statistics
 */
export interface QueueStats {
  /** Jobs by status */
  byStatus: Record<JobStatus, number>
  /** Jobs by priority */
  byPriority: Record<JobPriority, number>
  /** Jobs by type */
  byType: Record<string, number>
  /** Average wait time (ms) */
  avgWaitTimeMs: number
  /** Average execution time (ms) */
  avgExecutionTimeMs: number
  /** Success rate (0-1) */
  successRate: number
  /** Jobs processed in last hour */
  lastHourProcessed: number
  /** Jobs failed in last hour */
  lastHourFailed: number
  /** Current throughput (jobs/min) */
  throughputPerMin: number
  /** Dead letter queue size */
  deadLetterSize: number
}

/**
 * Queue event types
 */
export type QueueEventType =
  | 'job:enqueued'
  | 'job:scheduled'
  | 'job:started'
  | 'job:progress'
  | 'job:completed'
  | 'job:failed'
  | 'job:retrying'
  | 'job:cancelled'
  | 'job:dead-lettered'
  | 'job:stale-detected'
  | 'queue:drained'
  | 'queue:full'
  | 'queue:paused'
  | 'queue:resumed'

/**
 * Queue event
 */
export interface QueueEvent {
  type: QueueEventType
  jobId?: string
  jobType?: string
  timestamp: string
  data?: Record<string, unknown>
}

/**
 * Queue event listener
 */
export type QueueEventListener = (event: QueueEvent) => void

/**
 * Dead letter entry
 */
export interface DeadLetterEntry {
  /** Original job */
  job: QueuedJob
  /** Why it was dead-lettered */
  reason: string
  /** When it was moved to dead letter */
  deadLetteredAt: string
  /** Number of times requeue attempted */
  requeueAttempts: number
  /** Last requeue attempt timestamp */
  lastRequeueAt?: string
}

/**
 * Job filter for queries
 */
export interface JobFilter {
  status?: JobStatus | JobStatus[]
  type?: string | string[]
  priority?: JobPriority | JobPriority[]
  tenantId?: string
  userId?: string
  tags?: string[]
  createdAfter?: string
  createdBefore?: string
  limit?: number
  offset?: number
}

/**
 * Scheduler state
 */
export interface SchedulerState {
  /** Is scheduler running */
  running: boolean
  /** Is scheduler paused */
  paused: boolean
  /** Currently executing jobs */
  activeJobs: Set<string>
  /** Last poll timestamp */
  lastPollAt?: string
  /** Jobs processed since start */
  processedCount: number
  /** Jobs failed since start */
  failedCount: number
}

/**
 * Resource check result
 */
export interface ResourceCheckResult {
  /** Can job run now */
  canRun: boolean
  /** Reason if cannot run */
  reason?: string
  /** Estimated wait time in ms */
  estimatedWaitMs?: number
  /** Resource type blocking */
  blockingResource?: string
}

/**
 * Job batch operation result
 */
export interface BatchOperationResult {
  /** Jobs successfully processed */
  succeeded: string[]
  /** Jobs that failed */
  failed: Array<{ jobId: string; error: string }>
  /** Total processed */
  total: number
}
