/**
 * Runtime Queue
 * PHASE H1: Runtime Hardening & Platform Stabilization
 *
 * Durable job queue with priority scheduling and event emission.
 */

import { randomUUID } from 'crypto'
import type {
  QueuedJob,
  JobStatus,
  JobPriority,
  JobContext,
  JobFilter,
  QueueConfig,
  QueueStats,
  QueueEvent,
  QueueEventType,
  QueueEventListener,
  RetryPolicy
} from './types'
import { DEFAULT_QUEUE_CONFIG } from './types'

/**
 * Priority weights for sorting
 */
const PRIORITY_WEIGHT: Record<JobPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
  background: 4
}

/**
 * In-memory job queue with priority ordering
 */
export class RuntimeQueue {
  private jobs: Map<string, QueuedJob> = new Map()
  private config: QueueConfig
  private listeners: Map<QueueEventType, Set<QueueEventListener>> = new Map()
  private statsCache: { stats: QueueStats; timestamp: number } | null = null
  private statsCacheTtl = 5000 // 5 seconds

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config }
  }

  /**
   * Enqueue a new job
   */
  enqueue<T>(
    type: string,
    payload: T,
    context: JobContext,
    options: {
      priority?: JobPriority
      retryPolicy?: Partial<RetryPolicy>
      deadlineAt?: string
      tags?: string[]
    } = {}
  ): QueuedJob<T> {
    // Check queue capacity
    const pendingCount = this.countByStatus('pending')
    if (pendingCount >= this.config.maxPendingJobs) {
      this.emit('queue:full', undefined, undefined, { pendingCount })
      throw new Error(`Queue is full (${pendingCount}/${this.config.maxPendingJobs})`)
    }

    const job: QueuedJob<T> = {
      id: randomUUID(),
      type,
      payload,
      context,
      status: 'pending',
      priority: options.priority || 'normal',
      retryPolicy: options.retryPolicy,
      retryCount: 0,
      errorHistory: [],
      createdAt: new Date().toISOString(),
      deadlineAt: options.deadlineAt,
      tags: options.tags || []
    }

    this.jobs.set(job.id, job as QueuedJob)
    this.invalidateStatsCache()
    this.emit('job:enqueued', job.id, job.type, { priority: job.priority })

    return job
  }

  /**
   * Get a job by ID
   */
  get(jobId: string): QueuedJob | undefined {
    return this.jobs.get(jobId)
  }

  /**
   * Update a job
   */
  update(jobId: string, updates: Partial<QueuedJob>): QueuedJob | undefined {
    const job = this.jobs.get(jobId)
    if (!job) return undefined

    const updatedJob = { ...job, ...updates }
    this.jobs.set(jobId, updatedJob)
    this.invalidateStatsCache()

    return updatedJob
  }

  /**
   * Mark job as scheduled (picked by scheduler)
   */
  markScheduled(jobId: string): QueuedJob | undefined {
    const job = this.jobs.get(jobId)
    if (!job || job.status !== 'pending') return undefined

    const updated = this.update(jobId, {
      status: 'scheduled',
      scheduledAt: new Date().toISOString()
    })

    if (updated) {
      this.emit('job:scheduled', jobId, updated.type)
    }

    return updated
  }

  /**
   * Mark job as running
   */
  markRunning(jobId: string): QueuedJob | undefined {
    const job = this.jobs.get(jobId)
    if (!job || (job.status !== 'scheduled' && job.status !== 'retrying')) return undefined

    const updated = this.update(jobId, {
      status: 'running',
      startedAt: new Date().toISOString()
    })

    if (updated) {
      this.emit('job:started', jobId, updated.type)
    }

    return updated
  }

  /**
   * Mark job as completed
   */
  markCompleted(jobId: string, result?: unknown): QueuedJob | undefined {
    const job = this.jobs.get(jobId)
    if (!job || job.status !== 'running') return undefined

    const updated = this.update(jobId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      result
    })

    if (updated) {
      this.emit('job:completed', jobId, updated.type, {
        duration: this.calculateDuration(updated)
      })
    }

    return updated
  }

  /**
   * Mark job as failed
   */
  markFailed(
    jobId: string,
    error: QueuedJob['lastError'],
    moveToDeadLetter = false
  ): QueuedJob | undefined {
    const job = this.jobs.get(jobId)
    if (!job) return undefined

    const errorHistory = [...job.errorHistory, error!]
    const status: JobStatus = moveToDeadLetter ? 'dead' : 'failed'

    const updated = this.update(jobId, {
      status,
      completedAt: new Date().toISOString(),
      lastError: error,
      errorHistory
    })

    if (updated) {
      if (moveToDeadLetter) {
        this.emit('job:dead-lettered', jobId, updated.type, { error: error?.message })
      } else {
        this.emit('job:failed', jobId, updated.type, { error: error?.message })
      }
    }

    return updated
  }

  /**
   * Mark job for retry
   */
  markRetrying(jobId: string, nextRetryAt: string, error: QueuedJob['lastError']): QueuedJob | undefined {
    const job = this.jobs.get(jobId)
    if (!job) return undefined

    const errorHistory = [...job.errorHistory, error!]

    const updated = this.update(jobId, {
      status: 'retrying',
      retryCount: job.retryCount + 1,
      nextRetryAt,
      lastError: error,
      errorHistory
    })

    if (updated) {
      this.emit('job:retrying', jobId, updated.type, {
        retryCount: updated.retryCount,
        nextRetryAt
      })
    }

    return updated
  }

  /**
   * Mark job as cancelled
   */
  markCancelled(jobId: string): QueuedJob | undefined {
    const job = this.jobs.get(jobId)
    if (!job || job.status === 'completed' || job.status === 'dead') return undefined

    const updated = this.update(jobId, {
      status: 'cancelled',
      completedAt: new Date().toISOString()
    })

    if (updated) {
      this.emit('job:cancelled', jobId, updated.type)
    }

    return updated
  }

  /**
   * Update job progress
   */
  updateProgress(jobId: string, progress: number, message?: string): void {
    const job = this.jobs.get(jobId)
    if (!job || job.status !== 'running') return

    this.update(jobId, {
      progress: Math.min(100, Math.max(0, progress)),
      progressMessage: message
    })

    this.emit('job:progress', jobId, job.type, { progress, message })
  }

  /**
   * Get next jobs to process (by priority and age)
   */
  getNextPending(limit = 1): QueuedJob[] {
    const now = new Date()
    const pending = Array.from(this.jobs.values())
      .filter(job => {
        // Pending jobs
        if (job.status === 'pending') return true
        // Retrying jobs ready for retry
        if (job.status === 'retrying' && job.nextRetryAt) {
          return new Date(job.nextRetryAt) <= now
        }
        return false
      })
      .sort((a, b) => {
        // Sort by priority first
        const priorityDiff = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]
        if (priorityDiff !== 0) return priorityDiff
        // Then by creation time (FIFO within same priority)
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      })

    return pending.slice(0, limit)
  }

  /**
   * Get jobs ready for retry
   */
  getReadyForRetry(): QueuedJob[] {
    const now = new Date()
    return Array.from(this.jobs.values())
      .filter(job =>
        job.status === 'retrying' &&
        job.nextRetryAt &&
        new Date(job.nextRetryAt) <= now
      )
  }

  /**
   * Query jobs with filters
   */
  query(filter: JobFilter): QueuedJob[] {
    let results = Array.from(this.jobs.values())

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status]
      results = results.filter(j => statuses.includes(j.status))
    }

    if (filter.type) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type]
      results = results.filter(j => types.includes(j.type))
    }

    if (filter.priority) {
      const priorities = Array.isArray(filter.priority) ? filter.priority : [filter.priority]
      results = results.filter(j => priorities.includes(j.priority))
    }

    if (filter.tenantId) {
      results = results.filter(j => j.context.tenantId === filter.tenantId)
    }

    if (filter.userId) {
      results = results.filter(j => j.context.userId === filter.userId)
    }

    if (filter.tags && filter.tags.length > 0) {
      results = results.filter(j =>
        filter.tags!.some(tag => j.tags.includes(tag))
      )
    }

    if (filter.createdAfter) {
      const after = new Date(filter.createdAfter)
      results = results.filter(j => new Date(j.createdAt) >= after)
    }

    if (filter.createdBefore) {
      const before = new Date(filter.createdBefore)
      results = results.filter(j => new Date(j.createdAt) <= before)
    }

    // Sort by priority and creation time
    results.sort((a, b) => {
      const priorityDiff = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]
      if (priorityDiff !== 0) return priorityDiff
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    // Apply pagination
    const offset = filter.offset || 0
    const limit = filter.limit || 50

    return results.slice(offset, offset + limit)
  }

  /**
   * Count jobs by status
   */
  countByStatus(status: JobStatus): number {
    return Array.from(this.jobs.values()).filter(j => j.status === status).length
  }

  /**
   * Get running jobs count
   */
  getRunningCount(): number {
    return this.countByStatus('running')
  }

  /**
   * Delete a job
   */
  delete(jobId: string): boolean {
    const deleted = this.jobs.delete(jobId)
    if (deleted) {
      this.invalidateStatsCache()
    }
    return deleted
  }

  /**
   * Clear completed jobs older than specified age
   */
  clearOldCompleted(maxAgeMs: number): number {
    const cutoff = Date.now() - maxAgeMs
    let cleared = 0

    for (const [jobId, job] of this.jobs) {
      if (
        (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') &&
        job.completedAt &&
        new Date(job.completedAt).getTime() < cutoff
      ) {
        this.jobs.delete(jobId)
        cleared++
      }
    }

    if (cleared > 0) {
      this.invalidateStatsCache()
    }

    return cleared
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    // Return cached stats if valid
    if (this.statsCache && Date.now() - this.statsCache.timestamp < this.statsCacheTtl) {
      return this.statsCache.stats
    }

    const jobs = Array.from(this.jobs.values())
    const now = Date.now()
    const hourAgo = now - 3600000

    // Count by status
    const byStatus: Record<JobStatus, number> = {
      pending: 0,
      scheduled: 0,
      running: 0,
      completed: 0,
      failed: 0,
      retrying: 0,
      cancelled: 0,
      dead: 0
    }

    // Count by priority
    const byPriority: Record<JobPriority, number> = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0,
      background: 0
    }

    // Count by type
    const byType: Record<string, number> = {}

    // Timing stats
    let totalWaitTime = 0
    let waitTimeCount = 0
    let totalExecTime = 0
    let execTimeCount = 0
    let successCount = 0
    let failCount = 0
    let lastHourProcessed = 0
    let lastHourFailed = 0

    for (const job of jobs) {
      byStatus[job.status]++
      byPriority[job.priority]++
      byType[job.type] = (byType[job.type] || 0) + 1

      // Calculate wait time (time from created to started)
      if (job.startedAt) {
        const waitTime = new Date(job.startedAt).getTime() - new Date(job.createdAt).getTime()
        totalWaitTime += waitTime
        waitTimeCount++
      }

      // Calculate execution time (time from started to completed)
      if (job.startedAt && job.completedAt) {
        const execTime = new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
        totalExecTime += execTime
        execTimeCount++

        // Track success/failure
        if (job.status === 'completed') {
          successCount++
        } else if (job.status === 'failed' || job.status === 'dead') {
          failCount++
        }

        // Track last hour
        if (new Date(job.completedAt).getTime() >= hourAgo) {
          lastHourProcessed++
          if (job.status === 'failed' || job.status === 'dead') {
            lastHourFailed++
          }
        }
      }
    }

    const stats: QueueStats = {
      byStatus,
      byPriority,
      byType,
      avgWaitTimeMs: waitTimeCount > 0 ? totalWaitTime / waitTimeCount : 0,
      avgExecutionTimeMs: execTimeCount > 0 ? totalExecTime / execTimeCount : 0,
      successRate: (successCount + failCount) > 0 ? successCount / (successCount + failCount) : 1,
      lastHourProcessed,
      lastHourFailed,
      throughputPerMin: lastHourProcessed / 60,
      deadLetterSize: byStatus.dead
    }

    // Cache stats
    this.statsCache = { stats, timestamp: now }

    return stats
  }

  /**
   * Get all jobs (for persistence)
   */
  getAllJobs(): QueuedJob[] {
    return Array.from(this.jobs.values())
  }

  /**
   * Load jobs from persistence
   */
  loadJobs(jobs: QueuedJob[]): void {
    this.jobs.clear()
    for (const job of jobs) {
      this.jobs.set(job.id, job)
    }
    this.invalidateStatsCache()
  }

  /**
   * Get queue config
   */
  getConfig(): QueueConfig {
    return { ...this.config }
  }

  /**
   * Update queue config
   */
  updateConfig(updates: Partial<QueueConfig>): void {
    this.config = { ...this.config, ...updates }
  }

  /**
   * Subscribe to queue events
   */
  on(eventType: QueueEventType, listener: QueueEventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType)!.add(listener)

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(listener)
    }
  }

  /**
   * Emit a queue event
   */
  private emit(
    type: QueueEventType,
    jobId?: string,
    jobType?: string,
    data?: Record<string, unknown>
  ): void {
    const event: QueueEvent = {
      type,
      jobId,
      jobType,
      timestamp: new Date().toISOString(),
      data
    }

    const listeners = this.listeners.get(type)
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event)
        } catch (err) {
          console.error(`[Queue] Event listener error for ${type}:`, err)
        }
      }
    }
  }

  /**
   * Calculate job duration
   */
  private calculateDuration(job: QueuedJob): number {
    if (!job.startedAt || !job.completedAt) return 0
    return new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
  }

  /**
   * Invalidate stats cache
   */
  private invalidateStatsCache(): void {
    this.statsCache = null
  }
}

// Singleton instance
let queueInstance: RuntimeQueue | null = null

/**
 * Get the queue instance
 */
export function getQueue(config?: Partial<QueueConfig>): RuntimeQueue {
  if (!queueInstance) {
    queueInstance = new RuntimeQueue(config)
  }
  return queueInstance
}

/**
 * Reset queue instance (for testing)
 */
export function resetQueue(): void {
  queueInstance = null
}
