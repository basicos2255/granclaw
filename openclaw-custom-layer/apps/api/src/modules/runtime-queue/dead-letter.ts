/**
 * Dead Letter Queue
 * PHASE H1: Runtime Hardening & Platform Stabilization
 *
 * Handles jobs that have exhausted all retry attempts.
 * Provides inspection, requeue, and cleanup capabilities.
 */

import type { QueuedJob, JobStatus, JobPriority } from './types'
import type { RuntimeQueue } from './queue'
import {
  getDeadLetterEntries,
  getDeadLetterEntry,
  removeFromDeadLetter,
  markRequeueAttempt,
  clearDeadLetter,
  getDeadLetterCount,
  addToDeadLetter as persistAddToDeadLetter
} from './persistence'

/**
 * Dead letter entry with metadata
 */
export interface DeadLetterEntry {
  job: QueuedJob
  reason: string
  deadLetteredAt: string
  requeueAttempts: number
  lastRequeueAt?: string
}

/**
 * Dead letter statistics
 */
export interface DeadLetterStats {
  totalCount: number
  byJobType: Record<string, number>
  byErrorCategory: Record<string, number>
  avgRetryCount: number
  oldestEntry?: string
  newestEntry?: string
}

/**
 * Requeue options
 */
export interface RequeueOptions {
  /** Reset retry count */
  resetRetryCount?: boolean
  /** New priority */
  priority?: JobPriority
  /** Modified payload */
  payload?: unknown
  /** Additional tags */
  tags?: string[]
}

/**
 * Add a job to dead letter queue
 */
export function addToDeadLetter(job: QueuedJob, reason: string): void {
  persistAddToDeadLetter(job, reason)
  console.log(`[DeadLetter] Job ${job.id} added: ${reason}`)
}

/**
 * Get dead letter entries with pagination
 */
export function listDeadLetter(limit = 50, offset = 0): DeadLetterEntry[] {
  return getDeadLetterEntries(limit, offset)
}

/**
 * Get a specific dead letter entry
 */
export function getDeadLetterJob(jobId: string): DeadLetterEntry | undefined {
  return getDeadLetterEntry(jobId)
}

/**
 * Requeue a job from dead letter back to main queue
 */
export function requeueJob(
  queue: RuntimeQueue,
  jobId: string,
  options: RequeueOptions = {}
): QueuedJob | undefined {
  const entry = getDeadLetterEntry(jobId)
  if (!entry) {
    console.warn(`[DeadLetter] Job ${jobId} not found`)
    return undefined
  }

  // Mark requeue attempt
  markRequeueAttempt(jobId)

  // Create new job with modified properties
  const newJob = queue.enqueue(
    entry.job.type,
    options.payload ?? entry.job.payload,
    entry.job.context,
    {
      priority: options.priority ?? entry.job.priority,
      retryPolicy: entry.job.retryPolicy,
      deadlineAt: undefined, // Clear old deadline
      tags: [...(entry.job.tags || []), ...(options.tags || []), 'requeued']
    }
  )

  // Remove from dead letter
  removeFromDeadLetter(jobId)

  console.log(`[DeadLetter] Job ${jobId} requeued as ${newJob.id}`)

  return newJob
}

/**
 * Bulk requeue jobs by filter
 */
export function bulkRequeue(
  queue: RuntimeQueue,
  filter: {
    jobType?: string
    errorCategory?: string
    maxAge?: number // ms
  },
  options: RequeueOptions = {}
): { requeued: string[]; failed: string[] } {
  const entries = getDeadLetterEntries(1000) // Get all
  const now = Date.now()

  const requeued: string[] = []
  const failed: string[] = []

  for (const entry of entries) {
    // Apply filters
    if (filter.jobType && entry.job.type !== filter.jobType) continue
    if (filter.errorCategory && entry.job.lastError?.category !== filter.errorCategory) continue
    if (filter.maxAge) {
      const entryAge = now - new Date(entry.deadLetteredAt).getTime()
      if (entryAge > filter.maxAge) continue
    }

    try {
      const newJob = requeueJob(queue, entry.job.id, options)
      if (newJob) {
        requeued.push(entry.job.id)
      } else {
        failed.push(entry.job.id)
      }
    } catch (err) {
      console.error(`[DeadLetter] Error requeuing ${entry.job.id}:`, err)
      failed.push(entry.job.id)
    }
  }

  return { requeued, failed }
}

/**
 * Delete a dead letter entry permanently
 */
export function deleteDeadLetterEntry(jobId: string): boolean {
  const entry = removeFromDeadLetter(jobId)
  if (entry) {
    console.log(`[DeadLetter] Entry ${jobId} deleted`)
    return true
  }
  return false
}

/**
 * Clear all dead letter entries
 */
export function clearAllDeadLetter(): number {
  const count = clearDeadLetter()
  console.log(`[DeadLetter] Cleared ${count} entries`)
  return count
}

/**
 * Get dead letter statistics
 */
export function getDeadLetterStats(): DeadLetterStats {
  const entries = getDeadLetterEntries(1000)

  const byJobType: Record<string, number> = {}
  const byErrorCategory: Record<string, number> = {}
  let totalRetryCount = 0
  let oldestTime = Infinity
  let newestTime = 0
  let oldestEntry: string | undefined
  let newestEntry: string | undefined

  for (const entry of entries) {
    // Count by job type
    byJobType[entry.job.type] = (byJobType[entry.job.type] || 0) + 1

    // Count by error category
    const category = entry.job.lastError?.category || 'unknown'
    byErrorCategory[category] = (byErrorCategory[category] || 0) + 1

    // Track retry counts
    totalRetryCount += entry.job.retryCount

    // Track timestamps
    const entryTime = new Date(entry.deadLetteredAt).getTime()
    if (entryTime < oldestTime) {
      oldestTime = entryTime
      oldestEntry = entry.deadLetteredAt
    }
    if (entryTime > newestTime) {
      newestTime = entryTime
      newestEntry = entry.deadLetteredAt
    }
  }

  return {
    totalCount: entries.length,
    byJobType,
    byErrorCategory,
    avgRetryCount: entries.length > 0 ? totalRetryCount / entries.length : 0,
    oldestEntry,
    newestEntry
  }
}

/**
 * Get count of dead letter entries
 */
export function getCount(): number {
  return getDeadLetterCount()
}

/**
 * Analyze dead letter for patterns
 */
export interface DeadLetterAnalysis {
  /** Most common job types failing */
  topFailingTypes: Array<{ type: string; count: number; percentage: number }>
  /** Most common error categories */
  topErrorCategories: Array<{ category: string; count: number; percentage: number }>
  /** Jobs that could potentially be requeued (transient errors) */
  potentiallyRetryable: number
  /** Jobs with validation/auth errors (unlikely to succeed) */
  permanentlyFailed: number
  /** Average time jobs spent before hitting dead letter */
  avgTimeToDeadLetter: number
  /** Recommendations */
  recommendations: string[]
}

export function analyzeDeadLetter(): DeadLetterAnalysis {
  const entries = getDeadLetterEntries(1000)
  const total = entries.length

  if (total === 0) {
    return {
      topFailingTypes: [],
      topErrorCategories: [],
      potentiallyRetryable: 0,
      permanentlyFailed: 0,
      avgTimeToDeadLetter: 0,
      recommendations: ['Dead letter queue is empty - good!']
    }
  }

  const byType: Record<string, number> = {}
  const byCategory: Record<string, number> = {}
  let potentiallyRetryable = 0
  let permanentlyFailed = 0
  let totalTimeToDeadLetter = 0

  for (const entry of entries) {
    byType[entry.job.type] = (byType[entry.job.type] || 0) + 1

    const category = entry.job.lastError?.category || 'unknown'
    byCategory[category] = (byCategory[category] || 0) + 1

    // Classify retryability
    if (category === 'transient' || category === 'resource' || category === 'dependency') {
      potentiallyRetryable++
    } else if (category === 'validation' || category === 'auth') {
      permanentlyFailed++
    }

    // Calculate time to dead letter
    if (entry.job.createdAt && entry.deadLetteredAt) {
      const created = new Date(entry.job.createdAt).getTime()
      const deadLettered = new Date(entry.deadLetteredAt).getTime()
      totalTimeToDeadLetter += deadLettered - created
    }
  }

  // Sort and get top items
  const topFailingTypes = Object.entries(byType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([type, count]) => ({
      type,
      count,
      percentage: Math.round((count / total) * 100)
    }))

  const topErrorCategories = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([category, count]) => ({
      category,
      count,
      percentage: Math.round((count / total) * 100)
    }))

  // Generate recommendations
  const recommendations: string[] = []

  if (potentiallyRetryable > total * 0.3) {
    recommendations.push(
      `${potentiallyRetryable} jobs (${Math.round((potentiallyRetryable / total) * 100)}%) may succeed on retry - consider bulk requeue`
    )
  }

  if (permanentlyFailed > total * 0.5) {
    recommendations.push(
      'High percentage of validation/auth errors - check input validation in job handlers'
    )
  }

  if (topFailingTypes.length > 0 && topFailingTypes[0].percentage > 50) {
    recommendations.push(
      `Job type "${topFailingTypes[0].type}" accounts for ${topFailingTypes[0].percentage}% of failures - investigate`
    )
  }

  const avgTimeToDeadLetter = totalTimeToDeadLetter / total

  if (avgTimeToDeadLetter < 60000) {
    recommendations.push(
      'Jobs are failing quickly - consider increasing retry delays or checking infrastructure'
    )
  }

  if (recommendations.length === 0) {
    recommendations.push('No specific issues detected')
  }

  return {
    topFailingTypes,
    topErrorCategories,
    potentiallyRetryable,
    permanentlyFailed,
    avgTimeToDeadLetter,
    recommendations
  }
}
