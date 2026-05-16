/**
 * Task-Job Reconciliation
 * P6.10: Task Queue Reconciliation, Live Task Detail UX & Rich Interaction
 * P6.16: Execution Truth Authority - Validation is the FINAL authority
 *
 * Listens to queue events and reconciles job completion/failure with
 * the original GranClaw task and thread.
 *
 * P6.16 KEY CHANGE: A task is ONLY successful if:
 * 1. executionStatus === 'completed'
 * 2. validationFailedSteps is empty
 * 3. No failedStep
 *
 * Provider text response alone does NOT mean success for capability tasks.
 */

import type { QueuedJob, TaskLinkedJobPayload, QueueEvent } from './types'
import { getQueue } from './queue'
import type {
  TaskStatus,
  TaskReconciliation,
  TaskFailureExplanation,
  ValidationFailureReason,
  RecoveryAction
} from '../tasks/types'
import { emitTaskEvent } from '../runtime-ws'  // P6.16

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
 * P6.16: CompositeExecutionResult type for proper validation
 */
interface CompositeExecutionResultFields {
  success?: boolean
  executionStatus?: 'completed' | 'partial' | 'failed' | 'blocked' | 'validation_failed'
  validationFailedSteps?: string[]
  validatedSteps?: string[]
  completedSteps?: string[]
  failedStep?: { stepId: string; error: string; recoverable: boolean }
  result?: unknown
  error?: unknown
  // P6.17R: Additional context for failure explanations
  blockedCapability?: string
  blockedReason?: string
}

/**
 * P6.17R: Create failure explanation for blocked/failed tasks
 * Maps execution status and reason to user-friendly explanations
 */
function createFailureExplanation(
  executionStatus: string | undefined,
  reason: string,
  jobResult?: CompositeExecutionResultFields
): TaskFailureExplanation {
  // Determine failure code based on execution status and reason
  let code: ValidationFailureReason = 'unknown'
  let title = 'Error de ejecución'
  let humanMessage = reason
  const recoveryActions: RecoveryAction[] = []

  if (executionStatus === 'blocked') {
    // Check reason for specific blocking cause
    if (reason.includes('capability') || reason.includes('Capacidad')) {
      code = 'capability_not_configured'
      title = 'Capacidad no configurada'
      humanMessage = 'La tarea requiere una capacidad que no está disponible o configurada.'
      recoveryActions.push({
        type: 'configure_capability',
        label: 'Configurar capacidad',
        description: 'Ir a configuración de capacidades',
        navigateTo: '/settings/capabilities',
        primary: true
      })
    } else if (reason.includes('pairing') || reason.includes('OpenClaw')) {
      code = 'pairing_required'
      title = 'Conexión requerida'
      humanMessage = 'La tarea requiere conexión con OpenClaw Desktop.'
      recoveryActions.push({
        type: 'repair_connection',
        label: 'Conectar OpenClaw',
        description: 'Verificar conexión con OpenClaw Desktop',
        navigateTo: '/runtime',
        primary: true
      })
    } else if (reason.includes('permission') || reason.includes('permiso')) {
      code = 'permission_required'
      title = 'Permiso requerido'
      humanMessage = 'La tarea requiere permisos adicionales.'
      recoveryActions.push({
        type: 'approve_action',
        label: 'Aprobar acción',
        description: 'Revisar y aprobar los permisos necesarios',
        primary: true
      })
    } else {
      code = 'unsupported_action'
      title = 'Acción bloqueada'
      humanMessage = reason
    }
  } else if (executionStatus === 'validation_failed') {
    code = 'missing_execution_evidence'
    title = 'Validación fallida'
    humanMessage = 'La tarea se ejecutó pero no se pudo verificar que las acciones se completaron correctamente.'
    if (jobResult?.validationFailedSteps?.length) {
      humanMessage += ` Pasos fallidos: ${jobResult.validationFailedSteps.join(', ')}`
    }
    recoveryActions.push({
      type: 'retry',
      label: 'Reintentar',
      description: 'Volver a ejecutar la tarea',
      primary: true
    })
  } else if (executionStatus === 'failed') {
    // Check for specific failure types
    if (reason.includes('download') || reason.includes('descarga')) {
      code = 'download_failed'
      title = 'Descarga fallida'
      humanMessage = 'No se pudo completar la descarga del archivo.'
    } else if (reason.includes('browser') || reason.includes('navegador')) {
      code = 'browser_failed'
      title = 'Error de navegador'
      humanMessage = 'Hubo un error al interactuar con el navegador.'
    } else if (reason.includes('timeout') || reason.includes('tiempo')) {
      code = 'execution_timeout'
      title = 'Tiempo agotado'
      humanMessage = 'La tarea tardó demasiado y fue cancelada.'
    } else {
      code = 'unknown'
      title = 'Error de ejecución'
      humanMessage = reason
    }
    recoveryActions.push({
      type: 'retry',
      label: 'Reintentar',
      description: 'Volver a ejecutar la tarea',
      primary: true
    })
  } else if (executionStatus === 'partial') {
    code = 'no_actions_executed'
    title = 'Ejecución parcial'
    humanMessage = 'Solo se completaron algunos pasos de la tarea.'
    recoveryActions.push({
      type: 'retry_with_replan',
      label: 'Reintentar con nuevo plan',
      description: 'Crear un nuevo plan y ejecutar',
      primary: true
    })
  }

  // Always add cancel and view details
  recoveryActions.push({
    type: 'view_details',
    label: 'Ver detalles',
    description: 'Ver información técnica del error'
  })

  return {
    code,
    title,
    humanMessage,
    technicalMessage: reason,
    failedStep: jobResult?.failedStep?.stepId,
    capability: jobResult?.blockedCapability,
    recoveryActions,
    canRetry: executionStatus !== 'blocked',
    canRepair: executionStatus === 'blocked',
    canReplan: executionStatus === 'partial' || executionStatus === 'validation_failed'
  }
}

/**
 * P6.16: Determine task success based on validation authority
 * Validation is the FINAL authority - not just job.result.success
 *
 * A task is ONLY successful if:
 * 1. executionStatus === 'completed'
 * 2. validationFailedSteps is empty OR undefined
 * 3. success !== false
 */
function determineTaskSuccess(jobResult: CompositeExecutionResultFields | undefined): {
  isSuccess: boolean
  reason: string
} {
  // No result = error
  if (!jobResult) {
    return { isSuccess: false, reason: 'No job result' }
  }

  // P6.16: Check executionStatus FIRST (validation authority)
  if (jobResult.executionStatus) {
    if (jobResult.executionStatus === 'validation_failed') {
      return { isSuccess: false, reason: `Validation failed (status: ${jobResult.executionStatus})` }
    }
    if (jobResult.executionStatus === 'failed') {
      return { isSuccess: false, reason: `Execution failed (status: ${jobResult.executionStatus})` }
    }
    if (jobResult.executionStatus === 'blocked') {
      return { isSuccess: false, reason: `Execution blocked (status: ${jobResult.executionStatus})` }
    }
    if (jobResult.executionStatus === 'partial') {
      return { isSuccess: false, reason: `Partial execution (status: ${jobResult.executionStatus})` }
    }
    // Only 'completed' means success
    if (jobResult.executionStatus !== 'completed') {
      return { isSuccess: false, reason: `Unknown status: ${jobResult.executionStatus}` }
    }
  }

  // P6.16: Check validationFailedSteps (secondary check)
  if (jobResult.validationFailedSteps && jobResult.validationFailedSteps.length > 0) {
    return {
      isSuccess: false,
      reason: `Validation failed for steps: ${jobResult.validationFailedSteps.join(', ')}`
    }
  }

  // P6.16: Check explicit success field
  if (jobResult.success === false) {
    return { isSuccess: false, reason: 'Job explicitly marked as failed' }
  }

  // P6.16: Check failedStep
  if (jobResult.failedStep) {
    return { isSuccess: false, reason: `Step failed: ${jobResult.failedStep.stepId}` }
  }

  // All checks passed - this is a genuine success
  return { isSuccess: true, reason: 'All validations passed' }
}

/**
 * Internal: Handle job completed
 * P6.16: Updated to use validation authority
 */
async function onJobCompleted(jobId: string, jobType: string, meta: Record<string, unknown>): Promise<void> {
  console.log(`[TaskReconciliation P6.16] Job completed: ${jobId} (${jobType})`)

  const queue = getQueue()
  const job = queue.get(jobId)

  if (!job) {
    console.warn(`[TaskReconciliation P6.16] Job ${jobId} not found for reconciliation`)
    return
  }

  const taskId = extractTaskId(job)
  if (!taskId) {
    console.log(`[TaskReconciliation P6.16] Job ${jobId} has no taskId, skipping reconciliation`)
    return
  }

  console.log(`[TaskReconciliation P6.16] Reconciling job ${jobId} with task ${taskId}`)

  try {
    // Dynamic imports to avoid circular dependencies
    const { completeTask, getTask, updateTask } = await import('../tasks/service')
    const { syncThreadWithTask } = await import('../task-threads/service')

    // Get current task state
    const task = getTask(taskId)
    if (!task) {
      console.error(`[TaskReconciliation P6.16] Task ${taskId} not found`)
      return
    }

    // Don't update if task is already in terminal state (except queued/running)
    const terminalStates: TaskStatus[] = ['success', 'error', 'blocked', 'unconfirmed']
    if (terminalStates.includes(task.status)) {
      console.log(`[TaskReconciliation P6.16] Task ${taskId} already in terminal state: ${task.status}`)
      return
    }

    // P6.16: Determine success using validation authority
    const jobResult = job.result as CompositeExecutionResultFields | undefined
    const { isSuccess, reason } = determineTaskSuccess(jobResult)

    // P6.17R: Determine task status - use 'blocked' for blocked execution
    let newStatus: TaskStatus
    if (isSuccess) {
      newStatus = 'success'
    } else if (jobResult?.executionStatus === 'blocked') {
      newStatus = 'blocked' // P6.17R: Use blocked status for blocked tasks
    } else {
      newStatus = 'error'
    }
    console.log(`[TaskReconciliation P6.17R] Task ${taskId}: ${task.status} → ${newStatus} (${reason})`)

    // P6.17R: Create failure explanation for non-success tasks
    const failureExplanation = isSuccess
      ? undefined
      : createFailureExplanation(jobResult?.executionStatus, reason, jobResult)

    // P6.17: Create reconciliation object for top-level storage
    const reconciliation: TaskReconciliation = {
      phase: 'P6.17',
      isSuccess,
      reason,
      executionStatus: jobResult?.executionStatus,
      validationFailedSteps: jobResult?.validationFailedSteps,
      validatedSteps: jobResult?.validatedSteps,
      completedSteps: jobResult?.completedSteps,
      failedStep: jobResult?.failedStep,
      totalDurationMs: job.startedAt && job.completedAt
        ? new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
        : undefined
    }

    // P6.16: Include validation details in result (for backward compat)
    const enrichedResult = {
      ...(jobResult?.result ?? job.result ?? {}),
      _reconciliation: reconciliation  // Keep nested for backward compat
    }

    completeTask(
      taskId,
      newStatus,
      enrichedResult,
      'queue',  // source
      undefined, // trace - could be extracted from job
      undefined, // debugSnapshot
      reconciliation.totalDurationMs,
      isSuccess ? undefined : reason
    )

    // P6.17R: Save reconciliation and failure explanation at top-level
    updateTask(taskId, {
      reconciliation,
      failureExplanation // P6.17R: Include failure explanation for blocked/failed tasks
    })

    // Sync thread - pass status and optional error
    console.log(`[TaskReconciliation P6.16] Syncing thread for task ${taskId}`)
    syncThreadWithTask(taskId, newStatus, isSuccess ? undefined : reason)

    // P6.16: Emit task event for live monitoring
    const duration = job.startedAt && job.completedAt
      ? new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
      : undefined

    emitTaskEvent(
      task.tenantId,
      task.userId,
      isSuccess ? 'task:completed' : 'task:failed',
      {
        taskId,
        threadId: extractThreadId(job),
        jobId,
        status: newStatus,
        message: reason,
        error: isSuccess ? undefined : reason,
        executionStatus: jobResult?.executionStatus,
        completedSteps: jobResult?.completedSteps?.length,
        totalSteps: jobResult?.completedSteps?.length,  // Approximation
        validatedSteps: jobResult?.validatedSteps?.length,
        validationFailedSteps: jobResult?.validationFailedSteps?.length,
        duration
      }
    )

    console.log(`[TaskReconciliation P6.16] Task ${taskId} reconciled: ${newStatus} (${reason})`)

  } catch (err) {
    console.error(`[TaskReconciliation P6.16] Error reconciling task ${taskId}:`, err)
  }
}

/**
 * Handle job failed event
 * P6.16: Updated logging
 */
async function onJobFailed(jobId: string, jobType: string, meta: Record<string, unknown>): Promise<void> {
  console.log(`[TaskReconciliation P6.16] Job failed: ${jobId} (${jobType})`)

  const queue = getQueue()
  const job = queue.get(jobId)

  if (!job) {
    console.warn(`[TaskReconciliation P6.16] Job ${jobId} not found for failure reconciliation`)
    return
  }

  const taskId = extractTaskId(job)
  if (!taskId) {
    console.log(`[TaskReconciliation P6.16] Job ${jobId} has no taskId, skipping failure reconciliation`)
    return
  }

  console.log(`[TaskReconciliation P6.16] Reconciling failed job ${jobId} with task ${taskId}`)

  try {
    const { completeTask, getTask, updateTask } = await import('../tasks/service')
    const { syncThreadWithTask } = await import('../task-threads/service')

    const task = getTask(taskId)
    if (!task) {
      console.error(`[TaskReconciliation P6.16] Task ${taskId} not found`)
      return
    }

    // Don't update if task is already in terminal error state
    if (task.status === 'error') {
      console.log(`[TaskReconciliation P6.16] Task ${taskId} already in error state`)
      return
    }

    const errorMessage = job.lastError?.message || meta?.error?.toString() || 'Job failed'
    const errorCategory = job.lastError?.category || 'unknown'

    console.log(`[TaskReconciliation P6.16] Updating task ${taskId} status: ${task.status} → error`)
    console.log(`[TaskReconciliation P6.16] Error: ${errorMessage} (${errorCategory})`)

    // P6.17: Create reconciliation for failed job
    const reconciliation: TaskReconciliation = {
      phase: 'P6.17',
      isSuccess: false,
      reason: errorMessage,
      executionStatus: 'failed',
      totalDurationMs: job.startedAt && job.completedAt
        ? new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
        : undefined
    }

    // P6.17R: Create failure explanation
    const failureExplanation = createFailureExplanation('failed', errorMessage)

    completeTask(
      taskId,
      'error',
      {
        jobId,
        error: errorMessage,
        errorCategory,
        retryCount: job.retryCount,
        errorHistory: job.errorHistory,
        _reconciliation: reconciliation
      },
      'queue',
      undefined,
      undefined,
      reconciliation.totalDurationMs,
      errorMessage
    )

    // P6.17R: Save reconciliation and failure explanation at top-level
    updateTask(taskId, {
      reconciliation,
      failureExplanation
    })

    // Sync thread with error
    console.log(`[TaskReconciliation P6.16] Syncing thread for failed task ${taskId}`)
    syncThreadWithTask(taskId, 'error', errorMessage)

    // P6.16: Emit task failed event for live monitoring
    const duration = job.startedAt && job.completedAt
      ? new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
      : undefined

    emitTaskEvent(
      task.tenantId,
      task.userId,
      'task:failed',
      {
        taskId,
        threadId: extractThreadId(job),
        jobId,
        status: 'error',
        message: errorMessage,
        error: errorMessage,
        duration
      }
    )

    console.log(`[TaskReconciliation P6.16] Failed task ${taskId} reconciled`)

  } catch (err) {
    console.error(`[TaskReconciliation P6.16] Error reconciling failed task ${taskId}:`, err)
  }
}

/**
 * Handle job cancelled event
 * P6.16: Updated logging
 */
async function onJobCancelled(jobId: string, jobType: string, meta: Record<string, unknown>): Promise<void> {
  console.log(`[TaskReconciliation P6.16] Job cancelled: ${jobId} (${jobType})`)

  const queue = getQueue()
  const job = queue.get(jobId)

  if (!job) return

  const taskId = extractTaskId(job)
  if (!taskId) return

  try {
    const { completeTask, getTask, updateTask } = await import('../tasks/service')
    const { syncThreadWithTask } = await import('../task-threads/service')

    const task = getTask(taskId)
    if (!task || task.status === 'error') return

    // P6.17: Create reconciliation for cancelled job
    const reconciliation: TaskReconciliation = {
      phase: 'P6.17',
      isSuccess: false,
      reason: 'Task cancelled by user',
      executionStatus: 'failed'
    }

    completeTask(
      taskId,
      'error',
      { jobId, cancelled: true, _reconciliation: reconciliation },
      'queue',
      undefined,
      undefined,
      undefined,
      'Task cancelled by user'
    )

    // P6.17: Save reconciliation at top-level
    updateTask(taskId, { reconciliation })

    syncThreadWithTask(taskId, 'error', 'Task cancelled by user')

  } catch (err) {
    console.error(`[TaskReconciliation P6.16] Error handling cancelled job:`, err)
  }
}

/**
 * Initialize task reconciliation listeners
 * Call this after queue is initialized
 * P6.16: Updated with validation authority
 */
export function initializeTaskReconciliation(): void {
  if (initialized) {
    console.log('[TaskReconciliation P6.16] Already initialized')
    return
  }

  const queue = getQueue()

  // Register event listeners with wrapper functions
  queue.on('job:completed', handleJobCompleted)
  queue.on('job:failed', handleJobFailed)
  queue.on('job:cancelled', handleJobCancelled)

  initialized = true
  console.log('[TaskReconciliation P6.16] Task reconciliation listeners initialized (validation authority enabled)')
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
