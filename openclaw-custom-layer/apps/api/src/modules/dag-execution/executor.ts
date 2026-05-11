/**
 * DAG Executor
 * FEATURE 131: DAG Execution Engine & Parallel Tasks
 *
 * Main execution engine for DAG-based workflows with:
 * - Parallel node execution
 * - Resource management
 * - Artifact validation
 * - Retry handling
 * - Progress tracking
 */

import type {
  ExecutionGraph,
  WorkflowNode,
  ExecuteGraphInput,
  ExecuteGraphResult,
  ExecutionProgressEvent,
  SchedulerConfig,
  RetryPolicy
} from './types'
import { DEFAULT_SCHEDULER_CONFIG, DEFAULT_RETRY_POLICY } from './types'
import { createScheduler, DAGScheduler } from './scheduler'
import { ResourceManager } from './resource-manager'
import { ArtifactLockManager, acquireNodeLocks, releaseNodeLocks } from './artifact-locks'
import { validateWorkflowStep } from '../workflow-validation'
import { dispatchCapabilityExecution, getEnabledCapabilityByKey } from '../capabilities'
// P6.9R: Use executeProviderTask (no guard) for internal node execution
import { executeProviderTask } from '../orchestrator/service'
import {
  checkTaskMemory,
  getExecutionPlanFromPattern,
  recordPatternExecution
} from '../orchestrator/task-memory-integration'
import { saveCompositeTask } from '../composite-tasks/service'
import { shouldLearnWorkflow } from '../workflow-validation/service'

/**
 * Progress event handler type
 */
export type ProgressHandler = (event: ExecutionProgressEvent) => void

/**
 * Execute a single node
 */
async function executeNode(
  node: WorkflowNode,
  tenantId: string,
  userId?: string,
  sessionId?: string
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  console.log(`[DAGExecutor] Executing node ${node.id} (${node.actionType}): ${node.description}`)

  try {
    switch (node.provider) {
      case 'task_memory': {
        if (!node.taskPatternId) {
          return { success: false, error: 'Missing taskPatternId' }
        }

        const memoryCheck = checkTaskMemory({
          input: node.description,
          tenantId,
          userId
        })

        if (memoryCheck.canReuse && memoryCheck.pattern) {
          const execPlan = getExecutionPlanFromPattern({
            pattern: memoryCheck.pattern,
            tenantId,
            userId
          })

          recordPatternExecution(execPlan.patternId, true, execPlan.estimatedDuration)

          return {
            success: true,
            result: {
              fromTaskMemory: true,
              patternId: execPlan.patternId
            }
          }
        }

        // Fallback to OpenClaw
        return await executeViaOpenClaw(node, tenantId, sessionId)
      }

      case 'capability': {
        if (!node.capabilityKey) {
          return { success: false, error: 'Missing capabilityKey' }
        }

        const capability = getEnabledCapabilityByKey(tenantId, node.capabilityKey)
        if (!capability) {
          return await executeViaOpenClaw(node, tenantId, sessionId)
        }

        const dispatchResult = await dispatchCapabilityExecution(capability, {
          tenantId,
          userId: userId || 'system',
          sessionId: sessionId || 'dag-execution',
          mode: 'strict',
          requestedAction: node.description
        })

        if (dispatchResult.confirmationRequired) {
          return {
            success: false,
            error: 'Confirmation required',
            result: {
              confirmationRequired: true,
              confirmationId: dispatchResult.confirmationId
            }
          }
        }

        return {
          success: dispatchResult.success,
          result: dispatchResult.result,
          error: dispatchResult.error
        }
      }

      case 'openclaw': {
        return await executeViaOpenClaw(node, tenantId, sessionId)
      }

      case 'local': {
        // Local execution - depends on action type
        return await executeViaOpenClaw(node, tenantId, sessionId)
      }

      default:
        return { success: false, error: `Unknown provider: ${node.provider}` }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[DAGExecutor] Node ${node.id} error:`, err)
    return { success: false, error: errorMessage }
  }
}

/**
 * Execute via OpenClaw
 * P6.9R: Uses executeProviderTask (no guard) for internal node execution
 */
async function executeViaOpenClaw(
  node: WorkflowNode,
  tenantId: string,
  sessionId?: string
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  // P6.9R: Use executeProviderTask - no multistep guard for internal execution
  const result = await executeProviderTask({
    message: node.description,
    tenantId,
    sessionId
  })

  return {
    success: result.success,
    result: result.result,
    error: result.error
  }
}

/**
 * Validate node after execution
 */
async function validateNode(
  node: WorkflowNode,
  tenantId: string
): Promise<{
  ok: boolean
  reason?: string
  warnings: string[]
  evidence: string[]
  attempts: number
}> {
  if (!node.validationRequired) {
    return { ok: true, warnings: [], evidence: [], attempts: 0 }
  }

  const result = await validateWorkflowStep(
    node.id,
    0,  // stepOrder not relevant for DAG
    node.actionType,
    node.targetEntity,
    tenantId,
    node.validationType ? {
      required: true,
      type: node.validationType as 'file_exists' | 'file_downloaded' | 'app_installed' | 'app_opened' | 'process_running' | 'url_reachable' | 'directory_exists' | 'custom',
      target: node.validationTarget,
      critical: node.validationCritical ?? false
    } : undefined
  )

  return {
    ok: result.ok,
    reason: result.reason,
    warnings: result.warnings,
    evidence: result.evidence,
    attempts: result.validationAttempts
  }
}

/**
 * Execute with retry
 */
async function executeWithRetry(
  node: WorkflowNode,
  tenantId: string,
  userId?: string,
  sessionId?: string,
  retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY
): Promise<{ success: boolean; result?: unknown; error?: string; attempts: number }> {
  let lastError: string | undefined
  let lastResult: unknown
  let attempts = 0

  while (attempts <= retryPolicy.maxRetries) {
    attempts++
    node.attempts = attempts

    const result = await executeNode(node, tenantId, userId, sessionId)

    if (result.success) {
      return { success: true, result: result.result, attempts }
    }

    lastError = result.error
    lastResult = result.result

    // Check if retryable
    if (result.error?.includes('setup_required') ||
        result.error?.includes('reauthorization') ||
        result.error?.includes('Confirmation required')) {
      // Not retryable
      break
    }

    if (attempts <= retryPolicy.maxRetries) {
      // Calculate backoff
      const backoff = Math.min(
        retryPolicy.backoffMs * Math.pow(retryPolicy.backoffMultiplier || 1, attempts - 1),
        retryPolicy.maxBackoffMs || 30000
      )

      console.log(`[DAGExecutor] Node ${node.id} failed, retrying in ${backoff}ms (${attempts}/${retryPolicy.maxRetries})`)
      await new Promise(resolve => setTimeout(resolve, backoff))
    }
  }

  return { success: false, error: lastError, result: lastResult, attempts }
}

/**
 * Execute the DAG graph
 */
export async function executeGraph(
  input: ExecuteGraphInput,
  onProgress?: ProgressHandler
): Promise<ExecuteGraphResult> {
  const {
    graph,
    tenantId,
    userId,
    sessionId,
    config = {},
    stopOnFirstFailure = false,
    allowPartialCompletion = true
  } = input

  const startTime = Date.now()

  // Create scheduler
  const { scheduler, resourceManager, lockManager } = createScheduler(graph, config)

  // Track results
  const completedNodes: string[] = []
  const failedNodes: string[] = []
  const skippedNodes: string[] = []
  const blockedNodes: string[] = []
  const validatedNodes: string[] = []
  const validationFailedNodes: string[] = []

  // Emit progress
  const emit = (event: ExecutionProgressEvent) => {
    if (onProgress) {
      try {
        onProgress(event)
      } catch (e) {
        console.error('[DAGExecutor] Progress handler error:', e)
      }
    }
  }

  // Start scheduler
  scheduler.start()
  graph.status = 'running'
  graph.startedAt = new Date().toISOString()

  console.log(`[DAGExecutor] Starting graph ${graph.id} with ${graph.nodes.size} nodes`)

  // Main execution loop
  while (!scheduler.isComplete()) {
    // Get next batch of nodes
    const nextNodes = scheduler.getNextNodes(
      config.resourceLimits?.globalConcurrencyLimit || 6
    )

    if (nextNodes.length === 0) {
      // No nodes ready, wait a bit
      if (scheduler.getStats().running > 0 || scheduler.getStats().queued > 0) {
        await new Promise(resolve => setTimeout(resolve, 100))
        continue
      }

      // Nothing running or queued but not complete - check for deadlock
      const stats = scheduler.getStats()
      if (stats.pending > 0) {
        console.warn('[DAGExecutor] Possible deadlock detected')
        break
      }

      break
    }

    // Execute nodes in parallel
    const executions = nextNodes.map(async (nodeId) => {
      const node = graph.nodes.get(nodeId)
      if (!node) return

      try {
        // Acquire resources
        if (!resourceManager.tryAcquire(node)) {
          emit({
            type: 'node-queued',
            graphId: graph.id,
            nodeId,
            timestamp: new Date().toISOString(),
            message: 'Waiting for resources'
          })
          return
        }

        // Acquire locks
        await acquireNodeLocks(node, lockManager)

        // Mark running
        scheduler.markRunning(nodeId)
        emit({
          type: 'node-start',
          graphId: graph.id,
          nodeId,
          timestamp: new Date().toISOString(),
          message: `Starting: ${node.description}`
        })

        // Execute with retry
        const execResult = await executeWithRetry(
          node,
          tenantId,
          userId,
          sessionId,
          node.retryPolicy
        )

        node.result = execResult.result
        node.attempts = execResult.attempts

        if (!execResult.success) {
          node.error = execResult.error
          scheduler.markFailed(nodeId, execResult.error || 'Unknown error')
          failedNodes.push(nodeId)

          emit({
            type: 'node-failed',
            graphId: graph.id,
            nodeId,
            timestamp: new Date().toISOString(),
            error: execResult.error,
            message: `Failed: ${execResult.error}`
          })

          if (stopOnFirstFailure) {
            scheduler.stop()
          }

          return
        }

        // Validate if required
        if (node.validationRequired) {
          const validationResult = await validateNode(node, tenantId)
          node.validationResult = validationResult

          if (!validationResult.ok) {
            validationFailedNodes.push(nodeId)

            if (node.validationCritical) {
              scheduler.markValidationFailed(nodeId, validationResult.reason || 'Validation failed')
              failedNodes.push(nodeId)

              emit({
                type: 'node-failed',
                graphId: graph.id,
                nodeId,
                timestamp: new Date().toISOString(),
                error: `Validation failed: ${validationResult.reason}`,
                message: `Validation failed: ${validationResult.reason}`
              })

              if (stopOnFirstFailure) {
                scheduler.stop()
              }

              return
            }
          } else {
            validatedNodes.push(nodeId)
          }
        }

        // Success
        scheduler.markCompleted(nodeId, node.validationRequired)
        completedNodes.push(nodeId)

        emit({
          type: 'node-complete',
          graphId: graph.id,
          nodeId,
          timestamp: new Date().toISOString(),
          result: node.result,
          message: `Completed: ${node.description}`
        })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        scheduler.markFailed(nodeId, errorMessage)
        failedNodes.push(nodeId)

        emit({
          type: 'node-failed',
          graphId: graph.id,
          nodeId,
          timestamp: new Date().toISOString(),
          error: errorMessage
        })
      } finally {
        // Release locks
        releaseNodeLocks(node, lockManager)
      }
    })

    // Wait for batch to complete
    await Promise.all(executions)
  }

  // Stop scheduler
  scheduler.stop()

  // Get blocked nodes
  const state = scheduler.getState()
  blockedNodes.push(...state.blockedNodes)
  skippedNodes.push(...Array.from(graph.nodes.entries())
    .filter(([, n]) => n.status === 'skipped')
    .map(([id]) => id)
  )

  // Calculate metrics
  const totalDurationMs = Date.now() - startTime
  const parallelDurationMs = totalDurationMs
  const sequentialDurationMs = graph.metadata.estimatedDurationMs
  const timeSavedMs = Math.max(0, sequentialDurationMs - parallelDurationMs)

  const tokensSaved = Array.from(graph.nodes.values())
    .filter(n => n.status === 'completed' || n.status === 'validated')
    .filter(n => n.provider === 'task_memory' || n.provider === 'capability')
    .reduce((sum, n) => sum + n.estimatedTokenCost, 0)

  // Determine status
  const total = graph.nodes.size
  const successCount = completedNodes.length + skippedNodes.length
  const success = successCount === total && failedNodes.length === 0

  let status: ExecuteGraphResult['status']
  if (success) {
    status = 'completed'
  } else if (failedNodes.length === total) {
    status = 'failed'
  } else if (allowPartialCompletion && completedNodes.length > 0) {
    status = 'partial'
  } else {
    status = 'failed'
  }

  graph.status = status
  graph.completedAt = new Date().toISOString()

  // Learning decision
  let learnedAsComposite = false
  let learnedCompositeId: string | undefined
  let learnRejectedReason: string | undefined

  if (success && completedNodes.length >= 2 && !graph.compositeTaskId) {
    // Build validation results for learning check
    const validationResults = Array.from(graph.nodes.values())
      .filter(n => n.validationResult)
      .map(n => ({
        ok: n.validationResult!.ok,
        validationType: (n.validationType as 'file_exists' | 'file_downloaded' | 'app_installed' | 'app_opened' | 'process_running' | 'url_reachable' | 'directory_exists' | 'custom') || 'custom',
        reason: n.validationResult!.reason,
        warnings: n.validationResult!.warnings,
        evidence: n.validationResult!.evidence,
        checkedAt: n.completedAt || new Date().toISOString(),
        stepId: n.id,
        stepOrder: 0,
        actionType: n.actionType,
        targetEntity: n.targetEntity,
        validationAttempts: n.validationResult!.attempts
      }))

    const learnDecision = shouldLearnWorkflow(validationResults, tenantId)

    if (learnDecision.shouldLearn) {
      // Convert nodes to steps for composite
      const steps = Array.from(graph.nodes.values())
        .filter(n => n.status === 'completed' || n.status === 'validated')
        .map((n, idx) => ({
          stepId: n.stepId || n.id,
          order: idx,
          type: n.provider === 'task_memory' ? 'task_memory' as const :
                n.provider === 'capability' ? 'capability' as const :
                'openclaw' as const,
          actionType: n.actionType,
          targetEntity: n.targetEntity,
          description: n.description,
          taskPatternId: n.taskPatternId,
          capabilityKey: n.capabilityKey,
          requiresAi: n.provider === 'openclaw',
          requiresConfirmation: false,
          dependsOnPrevious: n.dependencies.length > 0,
          validationRequired: n.validationRequired,
          validationType: n.validationType,
          validationTarget: n.validationTarget,
          validationCritical: n.validationCritical
        }))

      const composite = saveCompositeTask({
        tenantId,
        userId,
        name: graph.sourceInput.substring(0, 50),
        normalizedIntent: graph.sourceInput,
        triggerPatterns: [graph.sourceInput.toLowerCase()],
        steps
      })

      learnedAsComposite = true
      learnedCompositeId = composite.id
      console.log(`[DAGExecutor] Learned as composite: ${composite.id}`)
    } else {
      learnRejectedReason = learnDecision.reason
      console.log(`[DAGExecutor] Learning rejected: ${learnDecision.reason}`)
    }
  }

  // Emit completion
  emit({
    type: 'graph-complete',
    graphId: graph.id,
    timestamp: new Date().toISOString(),
    message: `Graph ${status}: ${completedNodes.length}/${total} completed`,
    result: { status, completedNodes: completedNodes.length, failedNodes: failedNodes.length }
  })

  console.log(`[DAGExecutor] Graph ${graph.id} ${status}: ` +
    `${completedNodes.length}/${total} completed, ${failedNodes.length} failed, ` +
    `${blockedNodes.length} blocked, ${timeSavedMs}ms saved by parallelism`)

  return {
    graphId: graph.id,
    success,
    status,
    completedNodes,
    failedNodes,
    skippedNodes,
    blockedNodes,
    validatedNodes,
    validationFailedNodes,
    totalDurationMs,
    parallelDurationMs,
    sequentialDurationMs,
    timeSavedMs,
    tokensSaved,
    learnedAsComposite,
    learnedCompositeId,
    learnRejectedReason
  }
}

/**
 * Retry a failed node
 */
export async function retryNode(
  graph: ExecutionGraph,
  nodeId: string,
  tenantId: string,
  userId?: string,
  sessionId?: string
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const node = graph.nodes.get(nodeId)
  if (!node) {
    return { success: false, error: 'Node not found' }
  }

  node.status = 'pending'
  node.error = undefined
  node.result = undefined
  node.attempts = 0

  const result = await executeWithRetry(node, tenantId, userId, sessionId, node.retryPolicy)

  if (result.success) {
    node.status = 'completed'
    node.result = result.result
  } else {
    node.status = 'failed'
    node.error = result.error
  }

  return result
}

/**
 * Continue execution from current state
 */
export async function continueExecution(
  graph: ExecutionGraph,
  input: Omit<ExecuteGraphInput, 'graph'>,
  onProgress?: ProgressHandler
): Promise<ExecuteGraphResult> {
  // Reset pending/failed/blocked nodes
  for (const [, node] of graph.nodes) {
    if (node.status === 'failed' || node.status === 'blocked') {
      node.status = 'pending'
      node.error = undefined
    }
  }

  return executeGraph({ ...input, graph }, onProgress)
}
