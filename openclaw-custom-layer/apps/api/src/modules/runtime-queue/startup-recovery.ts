/**
 * Startup Recovery
 * PHASE H1: Runtime Hardening & Platform Stabilization
 *
 * Handles recovery of orphaned jobs and resources when the system restarts.
 * Ensures consistent state after crashes or unexpected shutdowns.
 */

import type { QueuedJob, JobStatus } from './types'
import type { RuntimeQueue } from './queue'
import { createJobError } from './retry-engine'
import { emitSystemEvent } from '../observability'

/**
 * Recovery report
 */
export interface RecoveryReport {
  /** When recovery started */
  startedAt: string
  /** When recovery completed */
  completedAt: string
  /** Total orphaned jobs found */
  orphanedJobsFound: number
  /** Jobs recovered (reset to pending/retrying) */
  jobsRecovered: number
  /** Jobs moved to dead letter */
  jobsDeadLettered: number
  /** Jobs that exceeded deadline */
  jobsExpired: number
  /** DAG executions recovered */
  dagExecutionsRecovered: number
  /** Resources released */
  resourcesReleased: number
  /** Locks cleaned up */
  locksCleanedUp: number
  /** Errors during recovery */
  errors: string[]
  /** Recovery actions taken */
  actions: string[]
}

/**
 * Recovery options
 */
export interface RecoveryOptions {
  /** Maximum retries for orphaned jobs before dead letter */
  maxOrphanedRetries: number
  /** Reset running jobs to pending */
  resetRunningToPending: boolean
  /** Reset scheduled jobs to pending */
  resetScheduledToPending: boolean
  /** Check for expired deadlines */
  checkExpiredDeadlines: boolean
  /** Clean stale DAG executions */
  cleanStaleDagExecutions: boolean
  /** Release orphaned locks */
  releaseOrphanedLocks: boolean
}

const DEFAULT_RECOVERY_OPTIONS: RecoveryOptions = {
  maxOrphanedRetries: 3,
  resetRunningToPending: true,
  resetScheduledToPending: true,
  checkExpiredDeadlines: true,
  cleanStaleDagExecutions: true,
  releaseOrphanedLocks: true
}

/**
 * Perform startup recovery
 */
export function performStartupRecovery(
  queue: RuntimeQueue,
  options: Partial<RecoveryOptions> = {}
): RecoveryReport {
  const opts = { ...DEFAULT_RECOVERY_OPTIONS, ...options }
  const report: RecoveryReport = {
    startedAt: new Date().toISOString(),
    completedAt: '',
    orphanedJobsFound: 0,
    jobsRecovered: 0,
    jobsDeadLettered: 0,
    jobsExpired: 0,
    dagExecutionsRecovered: 0,
    resourcesReleased: 0,
    locksCleanedUp: 0,
    errors: [],
    actions: []
  }

  emitSystemEvent('recovery-started', 'Startup recovery initiated', {
    options: opts
  })

  try {
    // Get all jobs
    const allJobs = queue.getAllJobs()
    const now = Date.now()

    for (const job of allJobs) {
      try {
        // Handle orphaned running jobs
        if (job.status === 'running' && opts.resetRunningToPending) {
          report.orphanedJobsFound++
          recoverOrphanedJob(queue, job, opts, report, now)
        }

        // Handle orphaned scheduled jobs
        if (job.status === 'scheduled' && opts.resetScheduledToPending) {
          report.orphanedJobsFound++
          recoverOrphanedJob(queue, job, opts, report, now)
        }

        // Check expired deadlines
        if (opts.checkExpiredDeadlines && job.deadlineAt) {
          const deadline = new Date(job.deadlineAt).getTime()
          if (deadline < now && job.status !== 'completed' && job.status !== 'failed' && job.status !== 'dead') {
            const error = createJobError(
              new Error('Job deadline expired during shutdown'),
              job.retryCount,
              'internal'
            )
            queue.markFailed(job.id, error, true)
            report.jobsExpired++
            report.actions.push(`Expired job ${job.id}: deadline ${job.deadlineAt}`)
          }
        }
      } catch (err) {
        report.errors.push(`Error processing job ${job.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // Clean stale retrying jobs (stuck for too long)
    cleanStaleRetryingJobs(queue, report, now)

  } catch (err) {
    report.errors.push(`Recovery error: ${err instanceof Error ? err.message : String(err)}`)
  }

  report.completedAt = new Date().toISOString()

  emitSystemEvent('recovery-completed', 'Startup recovery completed', {
    report
  })

  console.log('[StartupRecovery] Recovery completed:', {
    orphanedJobsFound: report.orphanedJobsFound,
    jobsRecovered: report.jobsRecovered,
    jobsDeadLettered: report.jobsDeadLettered,
    jobsExpired: report.jobsExpired,
    errors: report.errors.length
  })

  return report
}

/**
 * Recover an orphaned job
 */
function recoverOrphanedJob(
  queue: RuntimeQueue,
  job: QueuedJob,
  opts: RecoveryOptions,
  report: RecoveryReport,
  now: number
): void {
  // Check if job has exceeded max orphaned retries
  const orphanedRetries = (job.retryCount || 0)

  if (orphanedRetries >= opts.maxOrphanedRetries) {
    // Move to dead letter
    const error = createJobError(
      new Error('Job orphaned too many times during system recovery'),
      job.retryCount,
      'internal'
    )
    queue.markFailed(job.id, error, true)
    report.jobsDeadLettered++
    report.actions.push(`Dead-lettered job ${job.id}: exceeded max orphaned retries`)
    return
  }

  // Reset to pending for retry
  queue.update(job.id, {
    status: 'pending',
    scheduledAt: undefined,
    startedAt: undefined,
    progress: undefined,
    progressMessage: undefined
  })

  report.jobsRecovered++
  report.actions.push(`Recovered job ${job.id}: reset to pending`)
}

/**
 * Clean jobs stuck in retrying state for too long
 */
function cleanStaleRetryingJobs(
  queue: RuntimeQueue,
  report: RecoveryReport,
  now: number
): void {
  const MAX_RETRY_WAIT = 300000 // 5 minutes max wait for retry

  const allJobs = queue.getAllJobs()

  for (const job of allJobs) {
    if (job.status === 'retrying' && job.nextRetryAt) {
      const nextRetry = new Date(job.nextRetryAt).getTime()
      const waitTime = now - nextRetry

      // If retry was supposed to happen long ago, reset to pending
      if (waitTime > MAX_RETRY_WAIT) {
        queue.update(job.id, {
          status: 'pending',
          nextRetryAt: undefined
        })
        report.actions.push(`Reset stale retrying job ${job.id}: missed retry by ${Math.round(waitTime / 1000)}s`)
      }
    }
  }
}

/**
 * Health check for queue state
 */
export interface QueueHealthCheck {
  healthy: boolean
  totalJobs: number
  pendingJobs: number
  runningJobs: number
  failedJobs: number
  deadLetteredJobs: number
  avgWaitTime: number
  issues: string[]
  recommendations: string[]
}

export function checkQueueHealth(queue: RuntimeQueue): QueueHealthCheck {
  const stats = queue.getStats()
  const issues: string[] = []
  const recommendations: string[] = []

  // Check for stuck jobs
  if (stats.byStatus.running > 0) {
    // Note: In real scenario, check against actual running processes
    issues.push(`${stats.byStatus.running} jobs marked as running`)
  }

  // Check for high failure rate
  if (stats.successRate < 0.9 && stats.lastHourProcessed > 10) {
    issues.push(`Low success rate: ${Math.round(stats.successRate * 100)}%`)
    recommendations.push('Review error logs for failing job types')
  }

  // Check dead letter queue
  if (stats.deadLetterSize > 50) {
    issues.push(`Dead letter queue has ${stats.deadLetterSize} entries`)
    recommendations.push('Review and process dead letter queue')
  }

  // Check queue backlog
  if (stats.byStatus.pending > 100) {
    issues.push(`Large queue backlog: ${stats.byStatus.pending} pending jobs`)
    recommendations.push('Consider increasing concurrency limits')
  }

  return {
    healthy: issues.length === 0,
    totalJobs: Object.values(stats.byStatus).reduce((a, b) => a + b, 0),
    pendingJobs: stats.byStatus.pending,
    runningJobs: stats.byStatus.running,
    failedJobs: stats.byStatus.failed,
    deadLetteredJobs: stats.deadLetterSize,
    avgWaitTime: stats.avgWaitTimeMs,
    issues,
    recommendations
  }
}

/**
 * Graceful shutdown helper
 */
export async function gracefulShutdown(
  queue: RuntimeQueue,
  timeoutMs = 30000
): Promise<{
  success: boolean
  pendingJobs: number
  runningJobs: number
  message: string
}> {
  const startTime = Date.now()
  const stats = queue.getStats()
  const initialRunning = stats.byStatus.running

  console.log(`[StartupRecovery] Initiating graceful shutdown (timeout: ${timeoutMs}ms)`)

  // Wait for running jobs to complete
  while (true) {
    const currentStats = queue.getStats()

    if (currentStats.byStatus.running === 0) {
      return {
        success: true,
        pendingJobs: currentStats.byStatus.pending,
        runningJobs: 0,
        message: 'All running jobs completed'
      }
    }

    if (Date.now() - startTime > timeoutMs) {
      return {
        success: false,
        pendingJobs: currentStats.byStatus.pending,
        runningJobs: currentStats.byStatus.running,
        message: `Timeout: ${currentStats.byStatus.running} jobs still running`
      }
    }

    await new Promise(resolve => setTimeout(resolve, 100))
  }
}

/**
 * Pre-shutdown state save
 */
export function savePreShutdownState(queue: RuntimeQueue): {
  timestamp: string
  jobCount: number
  runningJobs: string[]
} {
  const allJobs = queue.getAllJobs()
  const runningJobs = allJobs
    .filter(j => j.status === 'running')
    .map(j => j.id)

  const state = {
    timestamp: new Date().toISOString(),
    jobCount: allJobs.length,
    runningJobs
  }

  emitSystemEvent('pre-shutdown', 'System shutting down', {
    state
  })

  return state
}
