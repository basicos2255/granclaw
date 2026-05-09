/**
 * Tasks Routes
 * FEATURE 080: Task System v1
 * FIX 126: Timeout Recovery & Multistep Task Execution
 * P6.3: Added structured result endpoint
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { ok, badRequest, unauthorized, notFound } from '../../shared/response'
import type { AuthContext } from '../auth'
import { listTasks, getTask } from './service'
import { getTaskResult } from '../task-results'
import { runSimpleAgentTask } from '../orchestrator/service'
import type { TaskStepInfo, ExecuteStepsResult } from '../orchestrator/types'

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
