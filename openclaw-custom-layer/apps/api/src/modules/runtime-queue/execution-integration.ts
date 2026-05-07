/**
 * Execution Integration
 * H1.1: Runtime Integration Finalization
 *
 * Bridges execution flows to runtime queue for queue-first execution.
 * Long-running operations are enqueued rather than executed directly.
 */

import type { QueuedJob, JobHandler, JobHandlerResult, JobContext } from './types'
import { getQueue } from './queue'
import { registerHandler } from './scheduler'
import { emitQueueEvent, emitSystemEvent } from '../observability'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Execution types that can be queued
 */
export type QueuedExecutionType =
  | 'dag-execution'
  | 'composite-task'
  | 'simple-task'
  | 'validation'
  | 'repair-flow'
  | 'replay'

/**
 * Enqueue options
 */
export interface EnqueueExecutionOptions {
  priority?: 'critical' | 'high' | 'normal' | 'low' | 'background'
  deadlineMs?: number
  tags?: string[]
  /** If true, execute synchronously without queue (for trivial tasks) */
  bypassQueue?: boolean
}

/**
 * Enqueue result
 */
export interface EnqueueResult {
  queued: boolean
  jobId?: string
  /** If bypassed, contains the direct execution result */
  directResult?: unknown
  message: string
}

/**
 * Execution criteria for shouldEnqueueExecution
 */
export interface ExecutionCriteria {
  /** Estimated duration in ms */
  estimatedDurationMs?: number
  /** Number of nodes/steps */
  nodeCount?: number
  /** Uses external services (OpenClaw, HTTP, etc) */
  usesExternalServices?: boolean
  /** Is a retry attempt */
  isRetry?: boolean
  /** Is a repair/recovery flow */
  isRepairFlow?: boolean
  /** Contains validation steps */
  hasValidation?: boolean
  /** Force queue regardless of criteria */
  forceQueue?: boolean
  /** Force bypass regardless of criteria */
  forceBypass?: boolean
}

// ============================================================================
// QUEUE DECISION LOGIC
// ============================================================================

/**
 * Thresholds for queue decision
 */
const QUEUE_THRESHOLDS = {
  /** Min duration to queue (5 seconds) */
  minDurationMs: 5000,
  /** Min nodes to queue */
  minNodeCount: 3,
  /** Always queue if external services involved */
  alwaysQueueExternal: true,
  /** Always queue retries */
  alwaysQueueRetries: true,
  /** Always queue repair flows */
  alwaysQueueRepairs: true
}

/**
 * Determine if an execution should be enqueued vs executed directly
 *
 * RULES:
 * - Force flags override all other criteria
 * - External services → queue
 * - Retries → queue
 * - Repair flows → queue
 * - Long duration (>5s) → queue
 * - Many nodes (>3) → queue
 * - Everything else → direct execution
 */
export function shouldEnqueueExecution(criteria: ExecutionCriteria): {
  shouldQueue: boolean
  reason: string
} {
  // Force flags
  if (criteria.forceQueue) {
    return { shouldQueue: true, reason: 'Forced queue by caller' }
  }
  if (criteria.forceBypass) {
    return { shouldQueue: false, reason: 'Forced bypass by caller' }
  }

  // Retries always queue
  if (criteria.isRetry && QUEUE_THRESHOLDS.alwaysQueueRetries) {
    return { shouldQueue: true, reason: 'Retry attempts must be queued' }
  }

  // Repair flows always queue
  if (criteria.isRepairFlow && QUEUE_THRESHOLDS.alwaysQueueRepairs) {
    return { shouldQueue: true, reason: 'Repair flows must be queued' }
  }

  // External services
  if (criteria.usesExternalServices && QUEUE_THRESHOLDS.alwaysQueueExternal) {
    return { shouldQueue: true, reason: 'External service calls must be queued' }
  }

  // Duration check
  if (criteria.estimatedDurationMs && criteria.estimatedDurationMs >= QUEUE_THRESHOLDS.minDurationMs) {
    return { shouldQueue: true, reason: `Estimated duration ${criteria.estimatedDurationMs}ms exceeds threshold` }
  }

  // Node count check
  if (criteria.nodeCount && criteria.nodeCount >= QUEUE_THRESHOLDS.minNodeCount) {
    return { shouldQueue: true, reason: `Node count ${criteria.nodeCount} exceeds threshold` }
  }

  // Default: direct execution for trivial tasks
  return { shouldQueue: false, reason: 'Trivial task - direct execution' }
}

// ============================================================================
// ENQUEUE HELPERS
// ============================================================================

/**
 * Create job context from execution context
 */
function createJobContext(
  tenantId: string,
  userId?: string,
  correlationId?: string
): JobContext {
  return {
    tenantId,
    userId: userId || 'system',
    correlationId: correlationId || crypto.randomUUID()
  }
}

/**
 * Enqueue a DAG execution
 */
export function enqueueDagExecution(
  payload: {
    graphId: string
    graph: unknown
    executionId?: string
  },
  context: { tenantId: string; userId?: string; correlationId?: string },
  options: EnqueueExecutionOptions = {}
): EnqueueResult {
  const queue = getQueue()
  const jobContext = createJobContext(context.tenantId, context.userId, context.correlationId)

  const job = queue.enqueue(
    'dag-execution',
    payload,
    jobContext,
    {
      priority: options.priority || 'normal',
      deadlineAt: options.deadlineMs
        ? new Date(Date.now() + options.deadlineMs).toISOString()
        : undefined,
      tags: ['dag', ...(options.tags || [])]
    }
  )

  emitQueueEvent('job:enqueued', 'DAG execution enqueued', {
    jobId: job.id,
    graphId: payload.graphId,
    tenantId: context.tenantId
  })

  return {
    queued: true,
    jobId: job.id,
    message: `DAG execution queued as job ${job.id}`
  }
}

/**
 * Enqueue a composite task execution
 */
export function enqueueCompositeTask(
  payload: {
    planId: string
    plan: unknown
    input: string
    context: unknown
  },
  context: { tenantId: string; userId?: string; correlationId?: string },
  options: EnqueueExecutionOptions = {}
): EnqueueResult {
  const queue = getQueue()
  const jobContext = createJobContext(context.tenantId, context.userId, context.correlationId)

  const job = queue.enqueue(
    'composite-task',
    payload,
    jobContext,
    {
      priority: options.priority || 'normal',
      deadlineAt: options.deadlineMs
        ? new Date(Date.now() + options.deadlineMs).toISOString()
        : undefined,
      tags: ['composite', ...(options.tags || [])]
    }
  )

  emitQueueEvent('job:enqueued', 'Composite task enqueued', {
    jobId: job.id,
    planId: payload.planId,
    tenantId: context.tenantId
  })

  return {
    queued: true,
    jobId: job.id,
    message: `Composite task queued as job ${job.id}`
  }
}

/**
 * Enqueue a simple agent task
 */
export function enqueueSimpleTask(
  payload: {
    message: string
    agentId?: string
    sessionId?: string
    tenantId: string
  },
  options: EnqueueExecutionOptions = {}
): EnqueueResult {
  const queue = getQueue()
  const jobContext = createJobContext(payload.tenantId)

  const job = queue.enqueue(
    'simple-task',
    payload,
    jobContext,
    {
      priority: options.priority || 'normal',
      deadlineAt: options.deadlineMs
        ? new Date(Date.now() + options.deadlineMs).toISOString()
        : undefined,
      tags: ['simple', ...(options.tags || [])]
    }
  )

  emitQueueEvent('job:enqueued', 'Simple task enqueued', {
    jobId: job.id,
    message: payload.message.substring(0, 50),
    tenantId: payload.tenantId
  })

  return {
    queued: true,
    jobId: job.id,
    message: `Task queued as job ${job.id}`
  }
}

// ============================================================================
// JOB HANDLERS (to be registered with scheduler)
// ============================================================================

/**
 * Handler for dag-execution jobs
 */
const dagExecutionHandler: JobHandler = async (job, helpers) => {
  helpers.log('info', 'Starting DAG execution from queue')

  try {
    // Dynamic import to avoid circular dependency
    const { executeGraph } = await import('../dag-execution/executor')

    const payload = job.payload as {
      graphId: string
      graph: unknown
      executionId?: string
    }

    helpers.reportProgress(10, 'Initializing DAG execution')

    const result = await executeGraph({
      graph: payload.graph as any,
      tenantId: job.context.tenantId,
      userId: job.context.userId,
      sessionId: `queue-${job.id}`
    }, (progress) => {
      const pct = progress.progress ?? 0
      helpers.reportProgress(10 + (pct * 0.8), progress.message)
    })

    helpers.reportProgress(100, 'DAG execution completed')

    return {
      success: result.success,
      result
    }
  } catch (err) {
    helpers.log('error', 'DAG execution failed', err)
    return {
      success: false,
      error: {
        message: err instanceof Error ? err.message : String(err),
        category: 'internal' as const
      }
    }
  }
}

/**
 * Handler for composite-task jobs
 */
const compositeTaskHandler: JobHandler = async (job, helpers) => {
  helpers.log('info', 'Starting composite task from queue')

  try {
    const { executeCompositePlan } = await import('../composite-tasks/executor')

    const payload = job.payload as {
      planId: string
      plan: unknown
    }

    helpers.reportProgress(10, 'Initializing composite task')

    const result = await executeCompositePlan({
      plan: payload.plan as any,
      tenantId: job.context.tenantId,
      userId: job.context.userId,
      sessionId: `queue-${job.id}`
    })

    helpers.reportProgress(100, 'Composite task completed')

    return {
      success: result.success,
      result
    }
  } catch (err) {
    helpers.log('error', 'Composite task failed', err)
    return {
      success: false,
      error: {
        message: err instanceof Error ? err.message : String(err),
        category: 'internal' as const
      }
    }
  }
}

/**
 * Handler for simple-task jobs
 */
const simpleTaskHandler: JobHandler = async (job, helpers) => {
  helpers.log('info', 'Starting simple task from queue')

  try {
    const { runSimpleAgentTask } = await import('../orchestrator/service')

    const payload = job.payload as {
      message: string
      agentId?: string
      sessionId?: string
      tenantId?: string
    }

    helpers.reportProgress(10, 'Executing task')

    const result = await runSimpleAgentTask({
      message: payload.message,
      agentId: payload.agentId,
      sessionId: payload.sessionId || `queue-${job.id}`,
      tenantId: payload.tenantId || job.context.tenantId
    })

    helpers.reportProgress(100, 'Task completed')

    return {
      success: result.success,
      result
    }
  } catch (err) {
    helpers.log('error', 'Simple task failed', err)
    return {
      success: false,
      error: {
        message: err instanceof Error ? err.message : String(err),
        category: 'internal' as const
      }
    }
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

let initialized = false

/**
 * Initialize execution integration handlers
 * Must be called after runtime queue is initialized
 */
export function initializeExecutionHandlers(): void {
  if (initialized) {
    console.warn('[ExecutionIntegration] Already initialized')
    return
  }

  registerHandler('dag-execution', dagExecutionHandler)
  registerHandler('composite-task', compositeTaskHandler)
  registerHandler('simple-task', simpleTaskHandler)

  initialized = true

  emitSystemEvent('execution-integration-ready', 'Execution handlers registered', {
    handlers: ['dag-execution', 'composite-task', 'simple-task']
  })

  console.log('[ExecutionIntegration] Handlers registered: dag-execution, composite-task, simple-task')
}

/**
 * Check if execution integration is initialized
 */
export function isExecutionIntegrationReady(): boolean {
  return initialized
}
