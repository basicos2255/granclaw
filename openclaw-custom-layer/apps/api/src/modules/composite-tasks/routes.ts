/**
 * Composite Tasks Routes
 * FEATURE 130.2: Composite Tasks & Intelligent Task Chaining
 * FIX 131.1: Wire DAG Engine into Composite Execution
 *
 * API endpoints for composite task management.
 * Uses native http (not Express) to match project conventions.
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { ok, badRequest, serverError, notFound } from '../../shared/response'
import type { AuthContext } from '../auth'
import {
  getCompositeTasks,
  getAllCompositeTasks,
  getCompositeById,
  getCompositeTaskStats,
  invalidateCompositeTask,
  validateCompositeTask,
  deleteCompositeTask,
  clearCompositeTasks
} from './service'
import { buildCompositeExecutionPlan, isCompositeCandidate } from './planner'
import { executeCompositePlan } from './executor'
// FIX 131.1: DAG Execution integration
import {
  shouldUseDagExecution,
  dagResultToResponse,
  buildExecutionGraph,
  executeGraph,
  getDagConfig,
  type DAGExecutionResponse
} from '../dag-execution'
import { saveGraphExecution, getGraphExecution } from '../dag-execution/persistence'

/**
 * GET /composite-tasks
 * Get all composite tasks for tenant
 */
export function handleGetCompositeTasks(
  req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null
): void {
  try {
    if (!context) {
      badRequest(res, 'Authentication required')
      return
    }

    const tasks = getCompositeTasks(context.tenant.id)

    ok(res, {
      success: true,
      tasks,
      count: tasks.length
    })
  } catch (err) {
    console.error('[CompositeTasks] Error getting tasks:', err)
    serverError(res, 'Error al obtener tareas compuestas')
  }
}

/**
 * GET /composite-tasks/stats
 * Get composite task statistics
 */
export function handleGetCompositeStats(
  _req: IncomingMessage,
  res: ServerResponse
): void {
  try {
    const stats = getCompositeTaskStats()

    ok(res, {
      success: true,
      stats
    })
  } catch (err) {
    console.error('[CompositeTasks] Error getting stats:', err)
    serverError(res, 'Error al obtener estadísticas')
  }
}

/**
 * GET /composite-tasks/:id
 * Get a specific composite task
 */
export function handleGetCompositeById(
  _req: IncomingMessage,
  res: ServerResponse,
  taskId: string,
  _context: AuthContext | null
): void {
  try {
    const task = getCompositeById(taskId)

    if (!task) {
      notFound(res, 'Tarea compuesta no encontrada')
      return
    }

    ok(res, {
      success: true,
      task
    })
  } catch (err) {
    console.error('[CompositeTasks] Error getting task:', err)
    serverError(res, 'Error al obtener tarea compuesta')
  }
}

/**
 * POST /composite-tasks/find
 * Find or build a composite plan for input
 */
export function handleFindCompositePlan(
  req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null
): void {
  if (!context) {
    badRequest(res, 'Authentication required')
    return
  }

  let body = ''

  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', () => {
    try {
      const data = body ? JSON.parse(body) : {}
      const { input, skipOptimization, forceOpenClaw } = data

      if (!input || typeof input !== 'string') {
        badRequest(res, 'Se requiere input')
        return
      }

      // Check if input is a composite candidate
      if (!isCompositeCandidate(input)) {
        ok(res, {
          success: true,
          isComposite: false,
          reason: 'Input es tarea simple, no composite'
        })
        return
      }

      const result = buildCompositeExecutionPlan({
        input,
        tenantId: context.tenant.id,
        userId: context.user.id,
        skipOptimization,
        forceOpenClaw
      })

      ok(res, {
        success: true,
        isComposite: result.found,
        ...result
      })
    } catch (err) {
      console.error('[CompositeTasks] Error finding plan:', err)
      serverError(res, 'Error al buscar plan compuesto')
    }
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}

/**
 * POST /composite-tasks/execute
 * Execute a composite plan
 * FIX 131.1: Uses DAG execution when applicable
 */
export function handleExecuteCompositePlan(
  req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null
): void {
  if (!context) {
    badRequest(res, 'Authentication required')
    return
  }

  let body = ''

  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', async () => {
    try {
      const data = body ? JSON.parse(body) : {}
      const {
        input,
        planId,
        stopOnFirstFailure = true,
        allowPartialCompletion = true,
        retryFailedSteps = false,
        maxRetries = 1,
        forceLegacy = false  // FIX 131.1: Allow forcing legacy execution
      } = data

      // Either provide input to build plan, or existing planId
      if (!input && !planId) {
        badRequest(res, 'Se requiere input o planId')
        return
      }

      let plan

      if (planId) {
        // TODO: Implement plan caching/retrieval
        badRequest(res, 'planId retrieval not implemented yet')
        return
      } else {
        // Build plan from input
        const planResult = buildCompositeExecutionPlan({
          input,
          tenantId: context.tenant.id,
          userId: context.user.id
        })

        if (!planResult.found || !planResult.plan) {
          ok(res, {
            success: false,
            error: 'No se pudo crear plan compuesto',
            reason: planResult.reason,
            executionMode: 'none'
          })
          return
        }

        plan = planResult.plan
      }

      // FIX 131.1: Determine execution mode
      const useDag = !forceLegacy && shouldUseDagExecution(plan)

      if (useDag) {
        // Execute via DAG engine
        console.log(`[CompositeTasks] Using DAG execution for plan ${plan.id}`)

        const graphResult = buildExecutionGraph({
          compositeTaskId: plan.compositeTaskId,
          steps: plan.steps,
          sourceInput: plan.sourceInput,
          tenantId: context.tenant.id,
          userId: context.user.id
        })

        if (!graphResult.success || !graphResult.graph) {
          // Fallback to legacy if DAG build fails
          console.warn('[CompositeTasks] DAG build failed, falling back to legacy:', graphResult.error)
          const legacyResult = await executeCompositePlan({
            plan,
            tenantId: context.tenant.id,
            userId: context.user.id,
            sessionId: 'composite-execution',
            stopOnFirstFailure,
            allowPartialCompletion,
            retryFailedSteps,
            maxRetries
          })

          ok(res, {
            success: legacyResult.success,
            result: legacyResult,
            plan,
            executionMode: 'legacy',
            dagFallbackReason: graphResult.error
          })
          return
        }

        // Execute DAG
        const dagConfig = getDagConfig()
        const dagResult = await executeGraph({
          graph: graphResult.graph,
          tenantId: context.tenant.id,
          userId: context.user.id,
          sessionId: 'composite-dag-execution',
          config: {
            resourceLimits: {
              maxParallelLocal: dagConfig.maxParallelLocal,
              maxParallelOpenClaw: dagConfig.maxParallelOpenClaw,
              maxConcurrentDownloads: dagConfig.maxConcurrentDownloads,
              maxConcurrentInstalls: dagConfig.maxConcurrentInstalls,
              maxConcurrentProcesses: 5,
              globalConcurrencyLimit: 6
            }
          },
          stopOnFirstFailure,
          allowPartialCompletion
        })

        // Convert to compatible response
        const response = dagResultToResponse(plan, dagResult, graphResult.graph.metadata)

        // Save execution for history
        saveGraphExecution(
          graphResult.graph,
          dagResult,
          response.graphSummary!,
          context.tenant.id,
          context.user.id
        )

        ok(res, {
          success: dagResult.success,
          result: response,
          plan,
          executionMode: 'dag',
          graphId: dagResult.graphId,
          graphSummary: response.graphSummary
        })
      } else {
        // Execute legacy
        console.log(`[CompositeTasks] Using legacy execution for plan ${plan.id}`)

        const result = await executeCompositePlan({
          plan,
          tenantId: context.tenant.id,
          userId: context.user.id,
          sessionId: 'composite-execution',
          stopOnFirstFailure,
          allowPartialCompletion,
          retryFailedSteps,
          maxRetries
        })

        ok(res, {
          success: result.success,
          result,
          plan,
          executionMode: 'legacy'
        })
      }
    } catch (err) {
      console.error('[CompositeTasks] Error executing plan:', err)
      serverError(res, 'Error al ejecutar plan compuesto')
    }
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}

/**
 * POST /composite-tasks/:id/invalidate
 * Invalidate a composite task
 */
export function handleInvalidateComposite(
  req: IncomingMessage,
  res: ServerResponse,
  taskId: string,
  _context: AuthContext | null
): void {
  let body = ''

  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', () => {
    try {
      const data = body ? JSON.parse(body) : {}
      const reason = data.reason || 'Invalidado manualmente'

      const success = invalidateCompositeTask(taskId, reason)

      if (success) {
        ok(res, {
          success: true,
          message: 'Tarea compuesta invalidada',
          taskId,
          reason
        })
      } else {
        notFound(res, 'Tarea compuesta no encontrada')
      }
    } catch (err) {
      console.error('[CompositeTasks] Error invalidating:', err)
      serverError(res, 'Error al invalidar tarea compuesta')
    }
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}

/**
 * POST /composite-tasks/:id/validate
 * Revalidate an invalidated composite task
 */
export function handleValidateComposite(
  _req: IncomingMessage,
  res: ServerResponse,
  taskId: string,
  _context: AuthContext | null
): void {
  try {
    const success = validateCompositeTask(taskId)

    if (success) {
      ok(res, {
        success: true,
        message: 'Tarea compuesta revalidada',
        taskId
      })
    } else {
      notFound(res, 'Tarea compuesta no encontrada')
    }
  } catch (err) {
    console.error('[CompositeTasks] Error validating:', err)
    serverError(res, 'Error al validar tarea compuesta')
  }
}

/**
 * DELETE /composite-tasks/:id
 * Delete a composite task
 */
export function handleDeleteComposite(
  _req: IncomingMessage,
  res: ServerResponse,
  taskId: string,
  _context: AuthContext | null
): void {
  try {
    const success = deleteCompositeTask(taskId)

    if (success) {
      ok(res, {
        success: true,
        message: 'Tarea compuesta eliminada',
        taskId
      })
    } else {
      notFound(res, 'Tarea compuesta no encontrada')
    }
  } catch (err) {
    console.error('[CompositeTasks] Error deleting:', err)
    serverError(res, 'Error al eliminar tarea compuesta')
  }
}

/**
 * POST /composite-tasks/clear
 * Clear all composite tasks for tenant
 */
export function handleClearCompositeTasks(
  req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null
): void {
  if (!context) {
    badRequest(res, 'Authentication required')
    return
  }

  let body = ''

  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', () => {
    try {
      const data = body ? JSON.parse(body) : {}
      const { confirm } = data

      if (confirm !== 'CLEAR_ALL') {
        badRequest(res, 'Se requiere confirmación: { "confirm": "CLEAR_ALL" }')
        return
      }

      clearCompositeTasks(context.tenant.id)

      ok(res, {
        success: true,
        message: 'Todas las tareas compuestas eliminadas'
      })
    } catch (err) {
      console.error('[CompositeTasks] Error clearing:', err)
      serverError(res, 'Error al limpiar tareas compuestas')
    }
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}
