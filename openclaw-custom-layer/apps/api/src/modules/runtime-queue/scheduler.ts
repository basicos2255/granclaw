/**
 * Queue Scheduler
 * PHASE H1: Runtime Hardening & Platform Stabilization
 *
 * Polls queue for jobs and executes them with proper resource management.
 */

import type {
  QueuedJob,
  JobHandler,
  JobHelpers,
  JobHandlerResult,
  SchedulerState,
  ResourceCheckResult,
  QueueConfig
} from './types'
import type { RuntimeQueue } from './queue'
import {
  createJobError,
  createJobErrorFromResult,
  shouldRetry,
  analyzeErrorHistory
} from './retry-engine'

/**
 * Registered job handlers
 */
const handlers: Map<string, JobHandler> = new Map()

/**
 * Jobs pending cancellation
 */
const pendingCancellations: Set<string> = new Set()

/**
 * Scheduler state
 */
let schedulerState: SchedulerState = {
  running: false,
  paused: false,
  activeJobs: new Set(),
  processedCount: 0,
  failedCount: 0
}

/**
 * Scheduler interval handle
 */
let schedulerInterval: ReturnType<typeof setInterval> | null = null

/**
 * Resource check function (can be overridden)
 */
let resourceChecker: ((job: QueuedJob) => ResourceCheckResult) | null = null

/**
 * Register a job handler
 */
export function registerHandler<T = unknown, R = unknown>(
  type: string,
  handler: JobHandler<T, R>
): void {
  handlers.set(type, handler as JobHandler)
}

/**
 * Unregister a job handler
 */
export function unregisterHandler(type: string): void {
  handlers.delete(type)
}

/**
 * Set resource checker function
 */
export function setResourceChecker(
  checker: (job: QueuedJob) => ResourceCheckResult
): void {
  resourceChecker = checker
}

/**
 * Check if resources are available for a job
 */
function checkResources(job: QueuedJob, queue: RuntimeQueue): ResourceCheckResult {
  // Check concurrency limit
  const config = queue.getConfig()
  const runningCount = queue.getRunningCount()

  if (runningCount >= config.maxConcurrentJobs) {
    return {
      canRun: false,
      reason: `Concurrency limit reached (${runningCount}/${config.maxConcurrentJobs})`,
      blockingResource: 'concurrency'
    }
  }

  // Custom resource check
  if (resourceChecker) {
    return resourceChecker(job)
  }

  return { canRun: true }
}

/**
 * Create job helpers for handler
 */
function createJobHelpers(job: QueuedJob, queue: RuntimeQueue): JobHelpers {
  return {
    reportProgress: (percent: number, message?: string) => {
      queue.updateProgress(job.id, percent, message)
    },
    shouldCancel: () => {
      return pendingCancellations.has(job.id)
    },
    log: (level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown) => {
      const prefix = `[Job:${job.id.substring(0, 8)}][${job.type}]`
      switch (level) {
        case 'debug':
          console.debug(prefix, message, data || '')
          break
        case 'info':
          console.log(prefix, message, data || '')
          break
        case 'warn':
          console.warn(prefix, message, data || '')
          break
        case 'error':
          console.error(prefix, message, data || '')
          break
      }
    },
    getRemainingTime: () => {
      if (!job.deadlineAt) return null
      return new Date(job.deadlineAt).getTime() - Date.now()
    }
  }
}

/**
 * Execute a single job
 */
async function executeJob(job: QueuedJob, queue: RuntimeQueue): Promise<void> {
  const handler = handlers.get(job.type)

  if (!handler) {
    const error = createJobError(
      new Error(`No handler registered for job type: ${job.type}`),
      job.retryCount
    )
    queue.markFailed(job.id, error, true) // Move to dead letter
    schedulerState.failedCount++
    return
  }

  // Mark as running
  const runningJob = queue.markRunning(job.id)
  if (!runningJob) {
    console.warn(`[Scheduler] Failed to mark job ${job.id} as running`)
    return
  }

  schedulerState.activeJobs.add(job.id)

  try {
    const helpers = createJobHelpers(runningJob, queue)
    const config = queue.getConfig()

    // Create timeout promise
    const timeoutMs = config.defaultTimeoutMs
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const timeoutPromise = new Promise<JobHandlerResult>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Job execution timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })

    // Execute handler with timeout
    const resultPromise = handler(runningJob, helpers)
    const result = await Promise.race([resultPromise, timeoutPromise])

    // Clear timeout
    if (timeoutId) clearTimeout(timeoutId)

    // Handle result
    if (result.success) {
      queue.markCompleted(job.id, result.result)
      schedulerState.processedCount++
    } else {
      // Create error and check retry
      const error = createJobErrorFromResult(result, job.retryCount)
      const retryDecision = shouldRetry(runningJob, error, result.forceRetry, result.skipRetry)

      if (retryDecision.shouldRetry && retryDecision.nextRetryAt) {
        queue.markRetrying(job.id, retryDecision.nextRetryAt, error)
      } else {
        // Analyze error history for dead letter decision
        const analysis = analyzeErrorHistory(runningJob)
        const moveToDeadLetter = analysis.recommendation === 'dead-letter' ||
          !retryDecision.shouldRetry

        queue.markFailed(job.id, error, moveToDeadLetter && config.enableDeadLetter)
        schedulerState.failedCount++
      }
    }
  } catch (err) {
    // Unhandled error
    const error = createJobError(err, job.retryCount)
    const retryDecision = shouldRetry(runningJob, error)

    if (retryDecision.shouldRetry && retryDecision.nextRetryAt) {
      queue.markRetrying(job.id, retryDecision.nextRetryAt, error)
    } else {
      const config = queue.getConfig()
      queue.markFailed(job.id, error, config.enableDeadLetter)
      schedulerState.failedCount++
    }
  } finally {
    schedulerState.activeJobs.delete(job.id)
    pendingCancellations.delete(job.id)
  }
}

/**
 * Poll and process jobs
 */
async function poll(queue: RuntimeQueue): Promise<void> {
  if (schedulerState.paused || !schedulerState.running) {
    return
  }

  schedulerState.lastPollAt = new Date().toISOString()

  const config = queue.getConfig()
  const availableSlots = config.maxConcurrentJobs - schedulerState.activeJobs.size

  if (availableSlots <= 0) {
    return
  }

  // Get next pending jobs
  const pendingJobs = queue.getNextPending(availableSlots)

  for (const job of pendingJobs) {
    // Check resources
    const resourceCheck = checkResources(job, queue)
    if (!resourceCheck.canRun) {
      continue
    }

    // Mark as scheduled and start execution
    const scheduledJob = queue.markScheduled(job.id)
    if (scheduledJob) {
      // Execute without awaiting (parallel execution)
      executeJob(scheduledJob, queue).catch(err => {
        console.error(`[Scheduler] Unhandled error executing job ${job.id}:`, err)
      })
    }
  }
}

/**
 * Start the scheduler
 */
export function startScheduler(queue: RuntimeQueue): void {
  if (schedulerState.running) {
    console.warn('[Scheduler] Already running')
    return
  }

  const config = queue.getConfig()

  schedulerState = {
    running: true,
    paused: false,
    activeJobs: new Set(),
    processedCount: 0,
    failedCount: 0
  }

  schedulerInterval = setInterval(() => {
    poll(queue).catch(err => {
      console.error('[Scheduler] Poll error:', err)
    })
  }, config.pollIntervalMs)

  console.log(`[Scheduler] Started (polling every ${config.pollIntervalMs}ms)`)
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
  }

  schedulerState.running = false
  console.log('[Scheduler] Stopped')
}

/**
 * Pause the scheduler (stops picking new jobs, running jobs continue)
 */
export function pauseScheduler(): void {
  schedulerState.paused = true
  console.log('[Scheduler] Paused')
}

/**
 * Resume the scheduler
 */
export function resumeScheduler(): void {
  schedulerState.paused = false
  console.log('[Scheduler] Resumed')
}

/**
 * Request cancellation of a job
 */
export function requestCancellation(jobId: string): void {
  pendingCancellations.add(jobId)
}

/**
 * Get scheduler state
 */
export function getSchedulerState(): SchedulerState {
  return {
    ...schedulerState,
    activeJobs: new Set(schedulerState.activeJobs)
  }
}

/**
 * Check for stale jobs and recover
 */
export function checkStaleJobs(queue: RuntimeQueue): string[] {
  const config = queue.getConfig()
  const now = Date.now()
  const staleJobIds: string[] = []

  // Find jobs marked as running but not in active set
  const allJobs = queue.getAllJobs()
  for (const job of allJobs) {
    if (job.status === 'running' && !schedulerState.activeJobs.has(job.id)) {
      // Check if started too long ago
      if (job.startedAt) {
        const startedAt = new Date(job.startedAt).getTime()
        if (now - startedAt > config.staleThresholdMs) {
          staleJobIds.push(job.id)
        }
      }
    }
  }

  return staleJobIds
}

/**
 * Recover a stale job (mark for retry or dead letter)
 */
export function recoverStaleJob(queue: RuntimeQueue, jobId: string): boolean {
  const job = queue.get(jobId)
  if (!job || job.status !== 'running') {
    return false
  }

  const error = createJobError(
    new Error('Job detected as stale (no heartbeat)'),
    job.retryCount,
    'internal'
  )

  const retryDecision = shouldRetry(job, error)

  if (retryDecision.shouldRetry && retryDecision.nextRetryAt) {
    queue.markRetrying(jobId, retryDecision.nextRetryAt, error)
    return true
  }

  const config = queue.getConfig()
  queue.markFailed(jobId, error, config.enableDeadLetter)
  return true
}

/**
 * Wait for all active jobs to complete
 */
export async function drainScheduler(timeoutMs = 60000): Promise<boolean> {
  const startTime = Date.now()

  while (schedulerState.activeJobs.size > 0) {
    if (Date.now() - startTime > timeoutMs) {
      console.warn(`[Scheduler] Drain timeout - ${schedulerState.activeJobs.size} jobs still active`)
      return false
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return true
}

/**
 * Get registered handler types
 */
export function getRegisteredHandlers(): string[] {
  return Array.from(handlers.keys())
}
