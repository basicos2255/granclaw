/**
 * Task-Job Reconciliation
 * P6.10: Task Queue Reconciliation, Live Task Detail UX & Rich Interaction
 *
 * Listens to queue events and reconciles job completion/failure with
 * the original GranClaw task and thread.
 */

import type { QueuedJob, TaskLinkedJobPayload, QueueEvent } from './types'
import { getQueue } from './queue'
import type { TaskStatus } from '../tasks/types'

// Track initialization state
let initialized = false

/**
 * Extract taskId from job payload
 */
function extractTaskId(job: QueuedJob): string | undefined {
  const payload = job.payload as Partial<TaskLinkedJobPayload>
  return payload?.taskId
}

/**
 * Extract threadId from job payload
 */
function extractThreadId(job: QueuedJob): string | undefined {
  const payload = job.payload as Partial<TaskLinkedJobPayload>
  return payload?.threadId
}

/**
 * Handle job completed event
 */
async function handleJobCompleted(event: QueueEvent): Promise<void> {
  const { jobId, jobType, data } = event
  if (!jobId) return
  await onJobCompleted(jobId, jobType || '', data || {})
}

/**
 * Handle job failed event
 */
async function handleJobFailed(event: QueueEvent): Promise<void> {
  const { jobId, jobType, data } = event
  if (!jobId) return
  await onJobFailed(jobId, jobType || '', data || {})
}

/**
 * Handle job cancelled event
 */
async function handleJobCancelled(event: QueueEvent): Promise<void> {
  const { jobId, jobType, data } = event
  if (!jobId) return
  await onJobCancelled(jobId, jobType || '', data || {})
}

/**
 * Internal: Handle job completed
 */
async function onJobCompleted(jobId: string, jobType: string, meta: Record<string, unknown>): Promise<void> {
  console.log(`[TaskReconciliation P6.10] Job completed: ${jobId} (${jobType})`)

  const queue = getQueue()
  const job = queue.get(jobId)

  if (!job) {
    console.warn(`[TaskReconciliation P6.10] Job ${jobId} not found for reconciliation`)
    return
  }

  const taskId = extractTaskId(job)
  if (!taskId) {
    console.log(`[TaskReconciliation P6.10] Job ${jobId} has no taskId, skipping reconciliation`)
    return
  }

  console.log(`[TaskReconciliation P6.10] Reconciling job ${jobId} with task ${taskId}`)

  try {
    // Dynamic imports to avoid circular dependencies
    const { completeTask, getTask } = await import('../tasks/service')
    const { syncThreadWithTask } = await import('../task-threads/service')

    // Get current task state
    const task = getTask(taskId)
    if (!task) {
      console.error(`[TaskReconciliation P6.10] Task ${taskId} not found`)
      return
    }

    // Don't update if task is already in terminal state (except queued/running)
    const terminalStates: TaskStatus[] = ['success', 'error', 'blocked', 'unconfirmed']
    if (terminalStates.includes(task.status)) {
      console.log(`[TaskReconciliation P6.10] Task ${taskId} already in terminal state: ${task.status}`)
      return
    }

    // Determine success based on job result
    const jobResult = job.result as { success?: boolean; result?: unknown; error?: unknown } | undefined
    const isSuccess = jobResult?.success !== false

    // Update task status
    const newStatus: TaskStatus = isSuccess ? 'success' : 'error'
    console.log(`[TaskReconciliation P6.10] Updating task ${taskId} status: ${task.status} → ${newStatus}`)

    completeTask(
      taskId,
      newStatus,
      jobResult?.result ?? job.result,
      'queue',  // source
      undefined, // trace - could be extracted from job
      undefined, // debugSnapshot
      job.startedAt && job.completedAt
        ? new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
        : undefined,
      isSuccess ? undefined : String(jobResult?.error || 'Job completed with errors')
    )

    // Sync thread - pass status and optional error
    console.log(`[TaskReconciliation P6.10] Syncing thread for task ${taskId}`)
    syncThreadWithTask(taskId, newStatus, isSuccess ? undefined : 'Job completed with errors')

    // Log completion (WS events will be added in FASE G)
    console.log(`[TaskReconciliation P6.10] Task ${taskId} reconciled successfully`)

  } catch (err) {
    console.error(`[TaskReconciliation P6.10] Error reconciling task ${taskId}:`, err)
  }
}

/**
 * Handle job failed event
 */
async function onJobFailed(jobId: string, jobType: string, meta: Record<string, unknown>): Promise<void> {
  console.log(`[TaskReconciliation P6.10] Job failed: ${jobId} (${jobType})`)

  const queue = getQueue()
  const job = queue.get(jobId)

  if (!job) {
    console.warn(`[TaskReconciliation P6.10] Job ${jobId} not found for failure reconciliation`)
    return
  }

  const taskId = extractTaskId(job)
  if (!taskId) {
    console.log(`[TaskReconciliation P6.10] Job ${jobId} has no taskId, skipping failure reconciliation`)
    return
  }

  console.log(`[TaskReconciliation P6.10] Reconciling failed job ${jobId} with task ${taskId}`)

  try {
    const { completeTask, getTask } = await import('../tasks/service')
    const { syncThreadWithTask } = await import('../task-threads/service')

    const task = getTask(taskId)
    if (!task) {
      console.error(`[TaskReconciliation P6.10] Task ${taskId} not found`)
      return
    }

    // Don't update if task is already in terminal error state
    if (task.status === 'error') {
      console.log(`[TaskReconciliation P6.10] Task ${taskId} already in error state`)
      return
    }

    const errorMessage = job.lastError?.message || meta?.error?.toString() || 'Job failed'
    const errorCategory = job.lastError?.category || 'unknown'

    console.log(`[TaskReconciliation P6.10] Updating task ${taskId} status: ${task.status} → error`)
    console.log(`[TaskReconciliation P6.10] Error: ${errorMessage} (${errorCategory})`)

    completeTask(
      taskId,
      'error',
      {
        jobId,
        error: errorMessage,
        errorCategory,
        retryCount: job.retryCount,
        errorHistory: job.errorHistory
      },
      'queue',
      undefined,
      undefined,
      job.startedAt && job.completedAt
        ? new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
        : undefined,
      errorMessage
    )

    // Sync thread with error
    console.log(`[TaskReconciliation P6.10] Syncing thread for failed task ${taskId}`)
    syncThreadWithTask(taskId, 'error', errorMessage)

    console.log(`[TaskReconciliation P6.10] Failed task ${taskId} reconciled`)

  } catch (err) {
    console.error(`[TaskReconciliation P6.10] Error reconciling failed task ${taskId}:`, err)
  }
}

/**
 * Handle job cancelled event
 */
async function onJobCancelled(jobId: string, jobType: string, meta: Record<string, unknown>): Promise<void> {
  console.log(`[TaskReconciliation P6.10] Job cancelled: ${jobId} (${jobType})`)

  const queue = getQueue()
  const job = queue.get(jobId)

  if (!job) return

  const taskId = extractTaskId(job)
  if (!taskId) return

  try {
    const { completeTask, getTask } = await import('../tasks/service')
    const { syncThreadWithTask } = await import('../task-threads/service')

    const task = getTask(taskId)
    if (!task || task.status === 'error') return

    completeTask(
      taskId,
      'error',
      { jobId, cancelled: true },
      'queue',
      undefined,
      undefined,
      undefined,
      'Task cancelled by user'
    )

    syncThreadWithTask(taskId, 'error', 'Task cancelled by user')

  } catch (err) {
    console.error(`[TaskReconciliation P6.10] Error handling cancelled job:`, err)
  }
}

/**
 * Initialize task reconciliation listeners
 * Call this after queue is initialized
 */
export function initializeTaskReconciliation(): void {
  if (initialized) {
    console.log('[TaskReconciliation P6.10] Already initialized')
    return
  }

  const queue = getQueue()

  // Register event listeners with wrapper functions
  queue.on('job:completed', handleJobCompleted)
  queue.on('job:failed', handleJobFailed)
  queue.on('job:cancelled', handleJobCancelled)

  initialized = true
  console.log('[TaskReconciliation P6.10] Task reconciliation listeners initialized')
}

/**
 * Check if reconciliation is initialized
 */
export function isReconciliationInitialized(): boolean {
  return initialized
}

/**
 * Manually reconcile a task with its job
 * Useful for repairing orphaned tasks
 */
export async function reconcileTaskWithJob(taskId: string): Promise<{
  success: boolean
  message: string
  jobId?: string
  previousStatus?: TaskStatus
  newStatus?: TaskStatus
}> {
  try {
    const { getTask, completeTask } = await import('../tasks/service')
    const { syncThreadWithTask } = await import('../task-threads/service')

    const task = getTask(taskId)
    if (!task) {
      return { success: false, message: 'Task not found' }
    }

    // If task is not in queued/running state, no reconciliation needed
    if (task.status !== 'queued' && task.status !== 'running') {
      return {
        success: true,
        message: `Task already in terminal state: ${task.status}`,
        previousStatus: task.status
      }
    }

    // Find the job linked to this task
    const queue = getQueue()
    const allJobs = queue.getAllJobs()
    const linkedJob = allJobs.find((job: QueuedJob) => extractTaskId(job) === taskId)

    if (!linkedJob) {
      // No linked job found - task is orphaned
      // Mark as error/incomplete
      completeTask(
        taskId,
        'error',
        { orphaned: true, reconciled: true },
        'queue',
        undefined,
        undefined,
        undefined,
        'No linked queue job found - task may have been lost'
      )
      syncThreadWithTask(taskId, 'error', 'No linked queue job found')

      return {
        success: true,
        message: 'Task marked as error - no linked job found',
        previousStatus: task.status,
        newStatus: 'error'
      }
    }

    // Found linked job - check its status
    const jobStatus = linkedJob.status

    if (jobStatus === 'completed') {
      // Job completed but task not updated
      await onJobCompleted(linkedJob.id, linkedJob.type, {})
      return {
        success: true,
        message: 'Task reconciled with completed job',
        jobId: linkedJob.id,
        previousStatus: task.status,
        newStatus: 'success'
      }
    }

    if (jobStatus === 'failed' || jobStatus === 'dead') {
      // Job failed but task not updated
      await onJobFailed(linkedJob.id, linkedJob.type, {})
      return {
        success: true,
        message: 'Task reconciled with failed job',
        jobId: linkedJob.id,
        previousStatus: task.status,
        newStatus: 'error'
      }
    }

    if (jobStatus === 'cancelled') {
      await onJobCancelled(linkedJob.id, linkedJob.type, {})
      return {
        success: true,
        message: 'Task reconciled with cancelled job',
        jobId: linkedJob.id,
        previousStatus: task.status,
        newStatus: 'error'
      }
    }

    // Job is still pending/running - no reconciliation needed
    return {
      success: true,
      message: `Job still in progress: ${jobStatus}`,
      jobId: linkedJob.id,
      previousStatus: task.status
    }

  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err)
    }
  }
}

/**
 * Reconcile all orphaned tasks
 */
export async function reconcileAllOrphanedTasks(tenantId?: string): Promise<{
  total: number
  reconciled: number
  errors: number
  details: Array<{ taskId: string; result: string }>
}> {
  const { listTasks } = await import('../tasks/service')

  // Get all tasks in non-terminal states
  const allTasks = listTasks(tenantId)
  const orphanCandidates = allTasks.filter(t =>
    t.status === 'queued' || t.status === 'running'
  )

  const results: Array<{ taskId: string; result: string }> = []
  let reconciled = 0
  let errors = 0

  for (const task of orphanCandidates) {
    const result = await reconcileTaskWithJob(task.id)
    results.push({
      taskId: task.id,
      result: result.message
    })

    if (result.success && result.newStatus) {
      reconciled++
    } else if (!result.success) {
      errors++
    }
  }

  return {
    total: orphanCandidates.length,
    reconciled,
    errors,
    details: results
  }
}
