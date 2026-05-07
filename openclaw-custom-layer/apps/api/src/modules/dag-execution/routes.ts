/**
 * DAG Execution Routes
 * FIX 131.1: Wire DAG Engine into Composite Execution
 *
 * API endpoints for DAG execution management.
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { ok, badRequest, serverError, notFound } from '../../shared/response'
import type { AuthContext } from '../auth'
import {
  listGraphExecutions,
  getGraphExecution,
  getGraphExecutionByGraphId,
  deleteGraphExecution,
  clearGraphExecutions
} from './persistence'
import { buildExecutionGraph, executeGraph, retryNode } from './index'
import { getDagConfig, setDagConfig, createGraphSummary } from './dag-helper'
// H1.1: Queue-first execution
import {
  shouldEnqueueExecution,
  enqueueDagExecution
} from '../runtime-queue'

// In-memory graph cache for retry operations
const graphCache: Map<string, import('./types').ExecutionGraph> = new Map()

/**
 * GET /dag/executions
 * List recent DAG executions
 */
export function handleListDagExecutions(
  req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null
): void {
  try {
    const tenantId = context?.tenant?.id
    const executions = listGraphExecutions(tenantId, 50)

    ok(res, {
      success: true,
      executions,
      count: executions.length
    })
  } catch (err) {
    console.error('[DAGRoutes] Error listing executions:', err)
    serverError(res, 'Error al listar ejecuciones DAG')
  }
}

/**
 * GET /dag/executions/:id
 * Get a specific DAG execution
 */
export function handleGetDagExecution(
  _req: IncomingMessage,
  res: ServerResponse,
  executionId: string,
  _context: AuthContext | null
): void {
  try {
    const execution = getGraphExecution(executionId)

    if (!execution) {
      notFound(res, 'Ejecución DAG no encontrada')
      return
    }

    ok(res, {
      success: true,
      execution
    })
  } catch (err) {
    console.error('[DAGRoutes] Error getting execution:', err)
    serverError(res, 'Error al obtener ejecución DAG')
  }
}

/**
 * GET /dag/config
 * Get current DAG configuration
 */
export function handleGetDagConfig(
  _req: IncomingMessage,
  res: ServerResponse,
  _context: AuthContext | null
): void {
  try {
    const config = getDagConfig()

    ok(res, {
      success: true,
      config
    })
  } catch (err) {
    console.error('[DAGRoutes] Error getting config:', err)
    serverError(res, 'Error al obtener configuración DAG')
  }
}

/**
 * POST /dag/config
 * Update DAG configuration
 */
export function handleSetDagConfig(
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
      const {
        enableDagExecution,
        maxParallelLocal,
        maxParallelOpenClaw,
        maxConcurrentDownloads,
        maxConcurrentInstalls
      } = data

      const updates: Record<string, unknown> = {}
      if (typeof enableDagExecution === 'boolean') updates.enableDagExecution = enableDagExecution
      if (typeof maxParallelLocal === 'number') updates.maxParallelLocal = maxParallelLocal
      if (typeof maxParallelOpenClaw === 'number') updates.maxParallelOpenClaw = maxParallelOpenClaw
      if (typeof maxConcurrentDownloads === 'number') updates.maxConcurrentDownloads = maxConcurrentDownloads
      if (typeof maxConcurrentInstalls === 'number') updates.maxConcurrentInstalls = maxConcurrentInstalls

      setDagConfig(updates)

      ok(res, {
        success: true,
        message: 'Configuración DAG actualizada',
        config: getDagConfig()
      })
    } catch (err) {
      console.error('[DAGRoutes] Error setting config:', err)
      serverError(res, 'Error al actualizar configuración DAG')
    }
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}

/**
 * POST /dag/execute
 * Execute a DAG directly or via queue
 * H1.1: Queue-first execution for complex graphs
 *
 * Body params:
 * - steps: array of execution steps
 * - sourceInput: original input
 * - async: if true, queue and return job ID (default: false for backward compat)
 * - forceQueue: always use queue regardless of graph complexity
 */
export function handleExecuteDag(
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
        steps,
        sourceInput,
        stopOnFirstFailure = false,
        allowPartialCompletion = true,
        // H1.2: Queue-first options (queue by default for non-trivial DAGs)
        forceQueue = false,
        forceDirect = false
      } = data

      if (!steps || !Array.isArray(steps) || steps.length === 0) {
        badRequest(res, 'Se requieren steps')
        return
      }

      if (!sourceInput) {
        badRequest(res, 'Se requiere sourceInput')
        return
      }

      // Build graph
      const graphResult = buildExecutionGraph({
        steps,
        sourceInput,
        tenantId: context.tenant.id,
        userId: context.user.id
      })

      if (!graphResult.success || !graphResult.graph) {
        ok(res, {
          success: false,
          error: 'Error construyendo grafo DAG',
          details: graphResult.error,
          warnings: graphResult.warnings
        })
        return
      }

      // Cache graph for retry
      graphCache.set(graphResult.graph.id, graphResult.graph)

      // H1.2: Queue-first by default for non-trivial DAGs
      const nodeCount = graphResult.graph.nodes.size
      const queueDecision = shouldEnqueueExecution({
        nodeCount,
        usesExternalServices: true, // DAGs typically use external services
        forceQueue,
        forceBypass: forceDirect // Only bypass if explicitly forced
      })

      // H1.2: Queue by default unless forceDirect
      if (queueDecision.shouldQueue && !forceDirect) {
        console.log(`[DAGRoutes] queueFirst: true, graphId=${graphResult.graph.id}, nodeCount=${nodeCount}, reason=${queueDecision.reason}`)
        const enqueueResult = enqueueDagExecution(
          {
            graphId: graphResult.graph.id,
            graph: graphResult.graph
          },
          {
            tenantId: context.tenant.id,
            userId: context.user.id
          },
          { priority: 'normal' }
        )

        ok(res, {
          success: true,
          queued: true,
          queueFirst: true,  // H1.2: Trace
          jobId: enqueueResult.jobId,
          graphId: graphResult.graph.id,
          executionMode: 'queued-dag',
          message: enqueueResult.message,
          queueReason: queueDecision.reason
        })
        return
      }

      // Direct execution only for trivial DAGs or when forceDirect=true
      const dagConfig = getDagConfig()
      const result = await executeGraph({
        graph: graphResult.graph,
        tenantId: context.tenant.id,
        userId: context.user.id,
        sessionId: 'dag-direct-execution',
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

      ok(res, {
        success: result.success,
        result,
        graphId: graphResult.graph.id,
        graphSummary: createGraphSummary(result, graphResult.graph.metadata)
      })
    } catch (err) {
      console.error('[DAGRoutes] Error executing DAG:', err)
      serverError(res, 'Error al ejecutar DAG')
    }
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}

/**
 * POST /dag/executions/:id/retry-node
 * Retry a specific node in an execution
 */
export function handleRetryDagNode(
  req: IncomingMessage,
  res: ServerResponse,
  executionId: string,
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
      const { nodeId } = data

      if (!nodeId) {
        badRequest(res, 'Se requiere nodeId')
        return
      }

      // Get execution
      const execution = getGraphExecution(executionId)
      if (!execution) {
        notFound(res, 'Ejecución no encontrada')
        return
      }

      // Get cached graph
      const graph = graphCache.get(execution.graphId)
      if (!graph) {
        badRequest(res, 'Grafo no disponible para retry (expirado)')
        return
      }

      // Retry node
      const result = await retryNode(
        graph,
        nodeId,
        context.tenant.id,
        context.user.id,
        'dag-retry'
      )

      ok(res, {
        success: result.success,
        nodeId,
        result: result.result,
        error: result.error
      })
    } catch (err) {
      console.error('[DAGRoutes] Error retrying node:', err)
      serverError(res, 'Error al reintentar nodo')
    }
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}

/**
 * POST /dag/executions/:id/cancel
 * Cancel a running execution
 */
export function handleCancelDagExecution(
  _req: IncomingMessage,
  res: ServerResponse,
  executionId: string,
  _context: AuthContext | null
): void {
  try {
    const execution = getGraphExecution(executionId)
    if (!execution) {
      notFound(res, 'Ejecución no encontrada')
      return
    }

    if (execution.status !== 'running') {
      badRequest(res, 'La ejecución no está en curso')
      return
    }

    // Get cached graph and stop it
    const graph = graphCache.get(execution.graphId)
    if (graph) {
      graph.status = 'cancelled'
    }

    // Update execution state
    execution.status = 'cancelled'
    execution.completedAt = new Date().toISOString()

    ok(res, {
      success: true,
      message: 'Ejecución cancelada',
      executionId
    })
  } catch (err) {
    console.error('[DAGRoutes] Error cancelling execution:', err)
    serverError(res, 'Error al cancelar ejecución')
  }
}

/**
 * DELETE /dag/executions/:id
 * Delete a DAG execution record
 */
export function handleDeleteDagExecution(
  _req: IncomingMessage,
  res: ServerResponse,
  executionId: string,
  _context: AuthContext | null
): void {
  try {
    const success = deleteGraphExecution(executionId)

    if (success) {
      ok(res, {
        success: true,
        message: 'Ejecución eliminada',
        executionId
      })
    } else {
      notFound(res, 'Ejecución no encontrada')
    }
  } catch (err) {
    console.error('[DAGRoutes] Error deleting execution:', err)
    serverError(res, 'Error al eliminar ejecución')
  }
}

/**
 * POST /dag/clear
 * Clear all DAG executions for tenant
 */
export function handleClearDagExecutions(
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

      const count = clearGraphExecutions(context.tenant.id)

      ok(res, {
        success: true,
        message: `${count} ejecuciones eliminadas`
      })
    } catch (err) {
      console.error('[DAGRoutes] Error clearing executions:', err)
      serverError(res, 'Error al limpiar ejecuciones')
    }
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}
