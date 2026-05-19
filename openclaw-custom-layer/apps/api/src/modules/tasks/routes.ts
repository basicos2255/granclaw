/**
 * Tasks Routes
 * FEATURE 080: Task System v1
 * FIX 126: Timeout Recovery & Multistep Task Execution
 * P6.3: Added structured result endpoint
 * P6.10: Task-Job Reconciliation endpoints
 * P6.11R: Added step type validation before runSimpleAgentTask
 * P6.12: Added retry, cancel, repair endpoints
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { ok, badRequest, unauthorized, notFound, serverError } from '../../shared/response'
import type { AuthContext } from '../auth'
import { listTasks, getTask, updateTask, buildCapabilityGateFailureExplanation, buildCapabilityGateResult } from './service'
import { getTaskResult } from '../task-results'
import { runSimpleAgentTask } from '../orchestrator/service'
import type { TaskStepInfo, ExecuteStepsResult } from '../orchestrator/types'
import { reconcileTaskWithJob, reconcileAllOrphanedTasks, enqueueCompositeTask, getQueue } from '../runtime-queue'
import { isStepSafeForSimpleExecution, classifyIntent, classifyExecutionMode } from '../execution-policy'
import { buildCompositeExecutionPlan } from '../composite-tasks/planner'
import { emitQueueEvent } from '../observability'
import { getThread, addMessage } from '../task-threads'
import type { EnqueueResult } from '../runtime-queue'

/**
 * GET /tasks - Lista tareas del tenant
 */
export function handleGetTasks(_req: IncomingMessage, res: ServerResponse, context: AuthContext | null): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const tasks = listTasks(context.tenant.id)
  ok(res, tasks)
}

/**
 * GET /tasks/:id - Obtiene una tarea por ID
 * Signature compatible con DynamicRouteHandler: (req, res, param, context)
 */
export function handleGetTaskById(_req: IncomingMessage, res: ServerResponse, taskId: string, context: AuthContext | null): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const task = getTask(taskId)

  if (!task) {
    notFound(res, 'Task not found')
    return
  }

  // Verificar que la tarea pertenece al tenant
  if (task.tenantId !== context.tenant.id) {
    notFound(res, 'Task not found')
    return
  }

  ok(res, task)
}

/**
 * P6.3: GET /tasks/:id/result - Obtiene resultado estructurado de tarea
 */
export function handleGetTaskResult(_req: IncomingMessage, res: ServerResponse, taskId: string, context: AuthContext | null): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  // First verify task exists and belongs to tenant
  const task = getTask(taskId)

  if (!task) {
    notFound(res, 'Task not found')
    return
  }

  if (task.tenantId !== context.tenant.id) {
    notFound(res, 'Task not found')
    return
  }

  // Get structured result
  const result = getTaskResult(taskId)

  if (!result) {
    // Return task basic info if no structured result yet
    ok(res, {
      taskId: task.id,
      status: task.status,
      summary: task.summary || task.input,
      outputs: task.outputs || [],
      artifacts: task.artifacts || [],
      provider: task.provider || task.source,
      durationMs: task.executionDurationMs,
      createdAt: task.createdAt
    })
    return
  }

  ok(res, result)
}

/**
 * FIX 126: POST /tasks/execute-steps - Execute steps sequentially
 */
interface ExecuteStepsInput {
  taskId?: string
  steps: TaskStepInfo[]
  startFromStepId?: string
}

export function handleExecuteSteps(req: IncomingMessage, res: ServerResponse, context: AuthContext | null): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  let body = ''

  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', async () => {
    if (!body) {
      badRequest(res, 'Request body is required')
      return
    }

    let input: ExecuteStepsInput
    try {
      input = JSON.parse(body)
    } catch {
      badRequest(res, 'Invalid JSON body')
      return
    }

    if (!input.steps || !Array.isArray(input.steps) || input.steps.length === 0) {
      badRequest(res, 'Field "steps" is required and must be a non-empty array')
      return
    }

    // Execute steps sequentially
    const result = await executeStepsSequentially(
      input.steps,
      context.tenant.id,
      context.user.id,
      input.startFromStepId
    )

    ok(res, result)
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}

/**
 * Execute steps sequentially with optional starting point
 */
async function executeStepsSequentially(
  steps: TaskStepInfo[],
  tenantId: string,
  userId: string,
  startFromStepId?: string
): Promise<ExecuteStepsResult> {
  const stepResults: Record<string, { status: 'completed' | 'failed' | 'skipped'; result?: unknown; error?: string }> = {}
  const completedSteps: string[] = []
  let failedStepId: string | undefined

  // Find starting index
  let startIndex = 0
  if (startFromStepId) {
    const foundIndex = steps.findIndex(s => s.id === startFromStepId)
    if (foundIndex >= 0) {
      startIndex = foundIndex
      // Mark previous steps as skipped
      for (let i = 0; i < startIndex; i++) {
        stepResults[steps[i].id] = { status: 'skipped' }
      }
    }
  }

  // Execute steps from starting point
  for (let i = startIndex; i < steps.length; i++) {
    const step = steps[i]

    // Check if this step depends on previous and previous failed
    if (step.dependsOnPrevious && i > startIndex) {
      const prevStep = steps[i - 1]
      if (stepResults[prevStep.id]?.status === 'failed') {
        stepResults[step.id] = {
          status: 'skipped',
          error: 'Previous step failed'
        }
        continue
      }
    }

    try {
      console.log(`[ExecuteSteps] Executing step ${step.order}: ${step.description}`)

      // P6.11R: Validate step type before using runSimpleAgentTask
      // Only reasoning/analysis steps can use simple execution
      // Download/install/browser/deploy steps MUST NOT use runSimpleAgentTask
      if (!isStepSafeForSimpleExecution(step.description) && !isStepSafeForSimpleExecution(step.input)) {
        console.log(`[ExecuteSteps P6.11R] Step ${step.order} is NOT safe for simple execution: ${step.description}`)
        stepResults[step.id] = {
          status: 'failed',
          error: 'Step requires queue execution (download/install/browser/deploy not allowed via simple task)'
        }
        failedStepId = step.id
        console.log(`[ExecuteSteps P6.11R] Step ${step.order} blocked - requires queue/workflow execution`)
        continue
      }

      console.log(`[ExecuteSteps P6.11R] Step ${step.order} is safe for simple execution`)

      const taskResult = await runSimpleAgentTask({
        message: step.input,
        tenantId
      })

      if (taskResult.success) {
        stepResults[step.id] = {
          status: 'completed',
          result: taskResult.result
        }
        completedSteps.push(step.id)
        console.log(`[ExecuteSteps] Step ${step.order} completed successfully`)
      } else {
        stepResults[step.id] = {
          status: 'failed',
          error: taskResult.error || 'Step execution failed'
        }
        failedStepId = step.id
        console.log(`[ExecuteSteps] Step ${step.order} failed: ${taskResult.error}`)
        // Don't break - let dependent steps handle it
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      stepResults[step.id] = {
        status: 'failed',
        error: errorMsg
      }
      failedStepId = step.id
      console.log(`[ExecuteSteps] Step ${step.order} threw error: ${errorMsg}`)
    }
  }

  // Check if all steps completed
  const taskCompleted = steps.every(s =>
    stepResults[s.id]?.status === 'completed' ||
    stepResults[s.id]?.status === 'skipped'
  ) && completedSteps.length > 0

  return {
    success: !failedStepId,
    completedSteps,
    failedStepId,
    stepResults,
    taskCompleted,
    error: failedStepId ? `Step ${failedStepId} failed` : undefined
  }
}

/**
 * P6.10: POST /tasks/:id/reconcile - Manually reconcile task with its queue job
 */
export function handleReconcileTask(_req: IncomingMessage, res: ServerResponse, taskId: string, context: AuthContext | null): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  // First verify task exists and belongs to tenant
  const task = getTask(taskId)

  if (!task) {
    notFound(res, 'Task not found')
    return
  }

  if (task.tenantId !== context.tenant.id) {
    notFound(res, 'Task not found')
    return
  }

  // Perform reconciliation
  reconcileTaskWithJob(taskId).then((result) => {
    ok(res, {
      success: result.success,
      taskId,
      message: result.message,
      jobId: result.jobId,
      previousStatus: result.previousStatus,
      newStatus: result.newStatus
    })
  }).catch((err) => {
    badRequest(res, err instanceof Error ? err.message : 'Reconciliation failed')
  })
}

/**
 * P6.10: POST /tasks/reconcile-all - Reconcile all orphaned tasks
 */
export function handleReconcileAllTasks(_req: IncomingMessage, res: ServerResponse, context: AuthContext | null): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  reconcileAllOrphanedTasks(context.tenant.id).then((result) => {
    ok(res, {
      success: true,
      total: result.total,
      reconciled: result.reconciled,
      errors: result.errors,
      details: result.details
    })
  }).catch((err) => {
    badRequest(res, err instanceof Error ? err.message : 'Reconciliation failed')
  })
}

// ============================================================================
// P6.12: RETRY, CANCEL, REPAIR OPERATIONS
// ============================================================================

/**
 * P6.12: Retry mode for task retry
 */
export type RetryMode =
  | 'retry_same_plan'       // Retry with same execution plan
  | 'retry_from_failed_step' // Retry from the step that failed
  | 'retry_replan'          // Create new plan and retry
  | 'retry_as_simple'       // Retry as simple task (only if safe)

/**
 * P6.12: Determine best retry mode for a task
 */
function determineRetryMode(task: { status?: string; source?: string; input?: string; executionTrace?: unknown[] }): { mode: RetryMode; reason: string } {
  // If task failed by validation/planner, replan
  if (task.source === 'validation' || task.source === 'planner-failed') {
    return { mode: 'retry_replan', reason: 'Previous plan failed validation' }
  }

  // If task failed by guard, must use queue
  if (task.source === 'guard' || task.source === 'error') {
    return { mode: 'retry_replan', reason: 'Task requires queue execution' }
  }

  // If task has execution trace with failed step, retry from there
  if (task.executionTrace && Array.isArray(task.executionTrace)) {
    const trace = task.executionTrace as Array<{ status?: string }>
    const failedStep = trace.find(s => s.status === 'error' || s.status === 'failed')
    if (failedStep) {
      return { mode: 'retry_from_failed_step', reason: 'Retry from failed step' }
    }
  }

  // Check if task is safe for simple execution
  if (task.input) {
    const intent = classifyIntent(task.input)
    const executionMode = classifyExecutionMode(intent)
    if (!executionMode.useQueue && !intent.isMultiStep) {
      return { mode: 'retry_as_simple', reason: 'Task is safe for simple execution' }
    }
  }

  // Default: replan
  return { mode: 'retry_replan', reason: 'Default to replanning' }
}

/**
 * P6.12: POST /tasks/:id/retry - Retry a failed task
 */
export function handleRetryTask(
  req: IncomingMessage,
  res: ServerResponse,
  taskId: string,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  // Load task
  const task = getTask(taskId)
  if (!task) {
    notFound(res, 'Task not found')
    return
  }

  if (task.tenantId !== context.tenant.id) {
    notFound(res, 'Task not found')
    return
  }

  // Check if task can be retried
  if (task.status === 'running' || task.status === 'queued') {
    badRequest(res, 'Task is still running, cannot retry')
    return
  }

  // Parse optional body for retry options
  let body = ''
  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', async () => {
    try {
      const options = body ? JSON.parse(body) : {}
      const forceMode = options.mode as RetryMode | undefined

      // Determine retry mode
      const { mode: retryMode, reason: modeReason } = forceMode
        ? { mode: forceMode, reason: 'User specified' }
        : determineRetryMode(task)

      console.log(`[TaskRetry P6.12] Task ${taskId} retry mode: ${retryMode} (${modeReason})`)

      // Get original input
      const originalInput = task.input || ''
      if (!originalInput) {
        badRequest(res, 'Task has no input to retry')
        return
      }

      // Classify intent for execution mode
      const intent = classifyIntent(originalInput)
      const executionMode = classifyExecutionMode(intent)

      // Determine if we need queue execution
      const needsQueue = executionMode.useQueue || intent.isMultiStep || retryMode === 'retry_replan'

      if (needsQueue) {
        // Build new plan
        const planResult = buildCompositeExecutionPlan({
          input: originalInput,
          tenantId: context.tenant.id,
          userId: context.user.id
        })

        if (!planResult.plan) {
          console.log(`[TaskRetry P6.12] Planner failed: ${planResult.reason}`)

          // Update task status
          updateTask(taskId, {
            status: 'error',
            source: 'validation',
            error: `Retry failed: ${planResult.reason}`,
            retryCount: (task.retryCount || 0) + 1
          })

          ok(res, {
            success: false,
            error: `No se pudo crear plan para reintento: ${planResult.reason}`,
            plannerFailed: true,
            taskId,
            retryMode
          })
          return
        }

        // P6.17R4: Check for capability gate BEFORE enqueueing
        // If blockingCapabilities exist, DO NOT enqueue - keep task blocked
        if (planResult.blockingCapabilities && planResult.blockingCapabilities.length > 0) {
          const blockedCaps = planResult.blockingCapabilities.map(c => c.capability || c.capabilityKey).join(', ')
          console.log(`[TaskRetry P6.17R4] Retry BLOCKED by capability gate: ${blockedCaps}`)

          // Build failure explanation from capability data
          const failureExplanation = buildCapabilityGateFailureExplanation({
            blockingCapabilities: planResult.blockingCapabilities,
            taskInput: originalInput,
            provider: 'validation'
          })

          // P6.17R5: Build complete result with plan evidence
          const capabilityGateResultObj = buildCapabilityGateResult({
            blockingCapabilities: planResult.blockingCapabilities,
            plan: planResult.plan ? {
              id: planResult.plan.id,
              sourceInput: planResult.plan.sourceInput,
              steps: planResult.plan.steps.map(s => ({
                stepId: s.stepId,
                order: s.order,
                actionType: s.actionType,
                targetEntity: s.targetEntity,
                capabilityKey: s.capabilityKey,
                description: s.description
              }))
            } : undefined,
            reason: `Capacidades no disponibles: ${blockedCaps}`
          })

          // Update task - keep blocked status, update failureExplanation
          updateTask(taskId, {
            status: 'blocked',
            source: 'validation',
            result: capabilityGateResultObj,
            error: `Retry blocked: capabilities not available (${blockedCaps})`,
            retryCount: (task.retryCount || 0) + 1,
            failureExplanation
          })

          ok(res, {
            success: false,
            retryBlocked: true,
            capabilityGate: true,
            blockingCapabilities: planResult.blockingCapabilities,
            error: `Reintento bloqueado: capacidades no disponibles (${blockedCaps})`,
            taskId,
            retryMode,
            // No jobId - task was not enqueued
            failureExplanation: {
              code: failureExplanation.code,
              title: failureExplanation.title,
              canRetry: failureExplanation.canRetry
            }
          })
          return
        }

        // Enqueue composite task
        const queueResult = enqueueCompositeTask(
          {
            planId: planResult.plan.id,
            plan: planResult.plan,
            input: originalInput,
            taskId: taskId, // Link to original task
            threadId: task.threadId,
            context: {
              tenantId: context.tenant.id,
              userId: context.user.id,
              intentKind: intent.kind,
              executionMode: executionMode.mode,
              requiresEvidence: executionMode.requiresEvidence
            }
          },
          {
            tenantId: context.tenant.id,
            userId: context.user.id,
            correlationId: task.requestId
          },
          {
            priority: 'normal',
            tags: ['retry', `retry-of-${taskId}`, intent.kind]
          }
        )

        if (!queueResult.queued || !queueResult.jobId) {
          console.log(`[TaskRetry P6.12] Queue failed`)

          updateTask(taskId, {
            status: 'error',
            source: 'queue',
            error: 'Retry failed: could not enqueue',
            retryCount: (task.retryCount || 0) + 1
          })

          ok(res, {
            success: false,
            error: 'No se pudo encolar el reintento',
            queueFailed: true,
            taskId,
            retryMode
          })
          return
        }

        // Update task status
        updateTask(taskId, {
          status: 'queued',
          source: 'queue',
          retryCount: (task.retryCount || 0) + 1,
          lastRetryJobId: queueResult.jobId
        })

        // Add message to thread if exists
        if (task.threadId) {
          try {
            addMessage({
              threadId: task.threadId,
              role: 'system',
              content: `Reintentando tarea (modo: ${retryMode}). Job ID: ${queueResult.jobId}`
            })
          } catch {
            // Thread might not exist, that's ok
          }
        }

        // Emit WS event
        emitQueueEvent('task:retry:started', 'Task retry enqueued', {
          taskId,
          jobId: queueResult.jobId,
          retryMode,
          planId: planResult.plan.id,
          steps: planResult.plan.steps.length
        })

        ok(res, {
          success: true,
          message: 'Reintento encolado',
          taskId,
          jobId: queueResult.jobId,
          planId: planResult.plan.id,
          steps: planResult.plan.steps.length,
          retryMode,
          status: 'queued'
        })
      } else {
        // Simple retry - use runSimpleAgentTask
        console.log(`[TaskRetry P6.12] Simple retry for task ${taskId}`)

        // Update task status
        updateTask(taskId, {
          status: 'running',
          retryCount: (task.retryCount || 0) + 1
        })

        const result = await runSimpleAgentTask({
          message: originalInput,
          tenantId: context.tenant.id
        })

        // Update task with result
        updateTask(taskId, {
          status: result.success ? 'success' : 'error',
          source: result.source || 'openclaw',
          outputs: result.result ? [{ type: 'text', value: JSON.stringify(result.result) }] : undefined,
          error: result.error
        })

        // Emit WS event
        emitQueueEvent('task:retry:completed', 'Task retry completed', {
          taskId,
          success: result.success,
          retryMode
        })

        ok(res, {
          success: result.success,
          message: result.success ? 'Reintento completado' : 'Reintento falló',
          taskId,
          result: result.result,
          error: result.error,
          retryMode,
          status: result.success ? 'success' : 'error'
        })
      }
    } catch (err) {
      console.error('[TaskRetry P6.12] Error:', err)
      serverError(res, 'Error al reintentar tarea')
    }
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}

/**
 * P6.12: POST /tasks/:id/cancel - Cancel a running task
 */
export function handleCancelTask(
  _req: IncomingMessage,
  res: ServerResponse,
  taskId: string,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const task = getTask(taskId)
  if (!task) {
    notFound(res, 'Task not found')
    return
  }

  if (task.tenantId !== context.tenant.id) {
    notFound(res, 'Task not found')
    return
  }

  // Check if task can be cancelled
  if (task.status !== 'running' && task.status !== 'queued') {
    badRequest(res, `Task cannot be cancelled (status: ${task.status})`)
    return
  }

  try {
    // Try to cancel queue job if exists
    if (task.lastRetryJobId) {
      const queue = getQueue()
      queue.markCancelled(task.lastRetryJobId)
    }

    // Update task status
    updateTask(taskId, {
      status: 'error',
      source: 'cancelled',
      error: 'Task cancelled by user'
    })

    // Emit WS event
    emitQueueEvent('task:cancelled', 'Task cancelled', { taskId })

    ok(res, {
      success: true,
      message: 'Task cancelled',
      taskId,
      status: 'cancelled'
    })
  } catch (err) {
    console.error('[TaskCancel P6.12] Error:', err)
    serverError(res, 'Error al cancelar tarea')
  }
}

/**
 * P6.12: POST /tasks/:id/repair - Repair task/thread/job inconsistencies
 */
export function handleRepairTask(
  _req: IncomingMessage,
  res: ServerResponse,
  taskId: string,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const task = getTask(taskId)
  if (!task) {
    notFound(res, 'Task not found')
    return
  }

  if (task.tenantId !== context.tenant.id) {
    notFound(res, 'Task not found')
    return
  }

  const repairReport: {
    taskId: string
    issues: string[]
    repairs: string[]
    success: boolean
  } = {
    taskId,
    issues: [],
    repairs: [],
    success: true
  }

  try {
    // Check 1: Task has thread but thread doesn't exist
    if (task.threadId) {
      const thread = getThread(task.threadId)
      if (!thread) {
        repairReport.issues.push('Thread not found')
        updateTask(taskId, { threadId: undefined })
        repairReport.repairs.push('Cleared orphan threadId')
      }
    }

    // Check 2: Task is queued/running but no job
    if ((task.status === 'queued' || task.status === 'running') && !task.lastRetryJobId) {
      repairReport.issues.push('Task queued/running without job')
      updateTask(taskId, { status: 'error', error: 'Orphaned task (no job found)' })
      repairReport.repairs.push('Marked orphaned task as error')
    }

    // Check 3: Task has job but job is terminal
    if (task.lastRetryJobId && (task.status === 'queued' || task.status === 'running')) {
      const queue = getQueue()
      const job = queue.get(task.lastRetryJobId)
      if (job && (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled')) {
        repairReport.issues.push(`Task status mismatch (task: ${task.status}, job: ${job.status})`)
        const newStatus = job.status === 'completed' ? 'success' : 'error'
        updateTask(taskId, { status: newStatus as 'success' | 'error' })
        repairReport.repairs.push(`Updated task status to ${newStatus}`)
      }
    }

    // Check 4: Run reconciliation
    reconcileTaskWithJob(taskId).then((reconcileResult) => {
      if (!reconcileResult.success) {
        repairReport.issues.push('Reconciliation found issues')
      }
      if (reconcileResult.newStatus !== reconcileResult.previousStatus) {
        repairReport.repairs.push(`Reconciled: ${reconcileResult.previousStatus} -> ${reconcileResult.newStatus}`)
      }

      // Emit WS event
      emitQueueEvent('task:repaired', 'Task repaired', { taskId, repairs: repairReport.repairs })

      ok(res, {
        success: repairReport.success,
        taskId,
        report: repairReport
      })
    }).catch((err) => {
      repairReport.success = false
      repairReport.issues.push(`Reconciliation error: ${err instanceof Error ? err.message : 'Unknown'}`)
      ok(res, {
        success: false,
        taskId,
        report: repairReport
      })
    })
  } catch (err) {
    console.error('[TaskRepair P6.12] Error:', err)
    serverError(res, 'Error al reparar tarea')
  }
}

/**
 * P6.12: GET /tasks/:id/truth - Get execution truth for a task
 */
export function handleGetTaskTruth(
  _req: IncomingMessage,
  res: ServerResponse,
  taskId: string,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const task = getTask(taskId)
  if (!task) {
    notFound(res, 'Task not found')
    return
  }

  if (task.tenantId !== context.tenant.id) {
    notFound(res, 'Task not found')
    return
  }

  // Get all related data
  const result = getTaskResult(taskId)
  const thread = task.threadId ? getThread(task.threadId) : null
  const queue = getQueue()
  const job = task.lastRetryJobId ? queue.get(task.lastRetryJobId) : null

  // P6.17R5: Extract capability gate data from task.result
  const taskResultData = task.result as Record<string, unknown> | undefined

  // P6.17: Enhanced truth response with reconciliation and execution details
  ok(res, {
    success: true,
    taskId,
    truth: {
      task: {
        id: task.id,
        status: task.status,
        humanStatus: task.humanStatus,
        source: task.source,
        input: task.input,
        retryCount: task.retryCount || 0,
        error: task.error,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        // P6.17R5: Include task.result for capability gate evidence
        result: taskResultData
      },
      // P6.17: Reconciliation (top-level for direct access)
      reconciliation: task.reconciliation || null,
      // P6.17: Execution evidence
      executionEvidence: task.executionEvidence || null,
      evidenceValidated: task.evidenceValidated || false,
      thread: thread ? {
        id: thread.id,
        status: thread.status,
        messageCount: thread.messages?.length || 0
      } : null,
      job: job ? {
        id: job.id,
        status: job.status,
        type: job.type,
        retryCount: job.retryCount,
        lastError: job.lastError
      } : null,
      result: result ? {
        status: result.status,
        summary: result.summary,
        hasArtifacts: (result.artifacts?.length || 0) > 0,
        hasOutputs: (result.outputs?.length || 0) > 0,
        // P6.17: Detailed artifacts summary
        artifacts: result.artifacts?.map(a => ({
          type: a.type,
          name: a.name,
          mimeType: a.mimeType,
          size: a.size
        })),
        // P6.17: Outputs summary
        outputs: result.outputs?.map(o => ({
          type: o.type,
          label: o.label
        }))
      } : null,
      // P6.17: Failure explanation for UI
      failureExplanation: task.failureExplanation || null,
      // P6.17R3: Include blockingCapabilities for capability-gated tasks
      blockingCapabilities: taskResultData?.blockingCapabilities || null,
      // P6.17R3: Include capabilityGate flag
      capabilityGate: taskResultData?.capabilityGate || false,
      // P6.17R5: Include targetEntity and planSummary for capability-gated tasks
      targetEntity: taskResultData?.targetEntity || null,
      planSummary: taskResultData?.planSummary || null,
      planId: taskResultData?.planId || null,
      sourceInput: taskResultData?.sourceInput || null
    }
  })
}
