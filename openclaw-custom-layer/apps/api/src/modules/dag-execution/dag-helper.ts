/**
 * DAG Execution Helper
 * FIX 131.1: Wire DAG Engine into Composite Execution
 *
 * Helpers for determining when to use DAG execution vs legacy.
 */

import type { CompositeExecutionPlan, CompositeTaskStep } from '../composite-tasks/types'
import type { ExecutionGraph, ExecuteGraphResult, GraphMetadata } from './types'

/**
 * DAG execution config
 */
export interface DAGExecutionConfig {
  enableDagExecution: boolean
  maxParallelLocal: number
  maxParallelOpenClaw: number
  maxConcurrentDownloads: number
  maxConcurrentInstalls: number
}

/**
 * Default DAG config
 */
export const DEFAULT_DAG_CONFIG: DAGExecutionConfig = {
  enableDagExecution: true,
  maxParallelLocal: 3,
  maxParallelOpenClaw: 2,
  maxConcurrentDownloads: 2,
  maxConcurrentInstalls: 1
}

// Runtime config (can be updated via settings)
let currentConfig: DAGExecutionConfig = { ...DEFAULT_DAG_CONFIG }

/**
 * Get current DAG config
 */
export function getDagConfig(): DAGExecutionConfig {
  return { ...currentConfig }
}

/**
 * Update DAG config
 */
export function setDagConfig(config: Partial<DAGExecutionConfig>): void {
  currentConfig = { ...currentConfig, ...config }
}

/**
 * Graph summary for API responses
 */
export interface GraphSummary {
  totalNodes: number
  completedNodes: number
  failedNodes: number
  skippedNodes: number
  blockedNodes: number
  validatedNodes: number
  validationFailedNodes: number
  queuedNodes: number
  durationMs: number
  parallelGroups: number
  tokenSavingEstimate: number
  criticalPathLength: number
  timeSavedMs: number
}

/**
 * Extended execution result with DAG info
 */
export interface DAGExecutionResponse {
  // Original fields preserved for compatibility
  planId: string
  compositeTaskId?: string
  success: boolean
  completedSteps: string[]
  failedStep?: {
    stepId: string
    error: string
    recoverable: boolean
  }
  skippedSteps: string[]
  validationFailedSteps: string[]
  validatedSteps: string[]
  executionStatus: 'completed' | 'partial' | 'failed' | 'blocked' | 'validation_failed'
  totalDurationMs: number
  tokenSaving: number
  learnedAsComposite: boolean
  learnedCompositeId?: string
  learnRejectedReason?: string
  // DAG-specific fields
  executionMode: 'dag' | 'legacy'
  graphId?: string
  graphExecution?: ExecuteGraphResult
  graphSummary?: GraphSummary
}

/**
 * Determine if DAG execution should be used
 */
export function shouldUseDagExecution(plan: CompositeExecutionPlan): boolean {
  // Check config
  if (!currentConfig.enableDagExecution) {
    return false
  }

  // Must have more than 1 step
  if (plan.steps.length <= 1) {
    return false
  }

  // Check for parallelizable steps
  const hasIndependentSteps = hasIndependentTasks(plan.steps)
  if (hasIndependentSteps) {
    return true
  }

  // Check for validation requirements
  const hasValidation = plan.steps.some(s => s.validationRequired)
  if (hasValidation) {
    return true
  }

  // Check for dependency complexity
  const hasDependencies = plan.steps.some(s => s.dependsOnPrevious)
  if (hasDependencies && plan.steps.length > 2) {
    return true
  }

  // Check for retry policy (implicit)
  // DAG provides better retry handling
  if (plan.steps.length >= 3) {
    return true
  }

  // Default to DAG for plans with multiple steps
  return plan.steps.length > 1
}

/**
 * Check if plan has independent (parallelizable) tasks
 */
function hasIndependentTasks(steps: CompositeTaskStep[]): boolean {
  // Group by target entity
  const byEntity = new Map<string, CompositeTaskStep[]>()
  let noEntityCount = 0

  for (const step of steps) {
    const key = step.targetEntity?.toLowerCase()
    if (!key) {
      noEntityCount++
      continue
    }
    if (!byEntity.has(key)) {
      byEntity.set(key, [])
    }
    byEntity.get(key)!.push(step)
  }

  // If we have multiple distinct entities, they can run in parallel
  if (byEntity.size > 1) {
    return true
  }

  // If we have steps without entity, they might be independent
  if (noEntityCount > 0 && byEntity.size > 0) {
    return true
  }

  // Check for parallel-safe action types
  const parallelSafeActions = ['download_file', 'navigate_url', 'search_web', 'search_file']
  const parallelCount = steps.filter(s => parallelSafeActions.includes(s.actionType)).length

  return parallelCount >= 2
}

/**
 * Create graph summary from execution result
 */
export function createGraphSummary(
  result: ExecuteGraphResult,
  metadata: GraphMetadata
): GraphSummary {
  return {
    totalNodes: metadata.totalNodes,
    completedNodes: result.completedNodes.length,
    failedNodes: result.failedNodes.length,
    skippedNodes: result.skippedNodes.length,
    blockedNodes: result.blockedNodes.length,
    validatedNodes: result.validatedNodes.length,
    validationFailedNodes: result.validationFailedNodes.length,
    queuedNodes: 0, // At completion, no nodes are queued
    durationMs: result.totalDurationMs,
    parallelGroups: metadata.parallelizableGroups.length,
    tokenSavingEstimate: result.tokensSaved,
    criticalPathLength: metadata.criticalPath.length,
    timeSavedMs: result.timeSavedMs
  }
}

/**
 * Convert DAG result to legacy-compatible response
 */
export function dagResultToResponse(
  plan: CompositeExecutionPlan,
  graphResult: ExecuteGraphResult,
  metadata: GraphMetadata
): DAGExecutionResponse {
  return {
    planId: plan.id,
    compositeTaskId: plan.compositeTaskId || graphResult.learnedCompositeId,
    success: graphResult.success,
    completedSteps: graphResult.completedNodes,
    failedStep: graphResult.failedNodes.length > 0 ? {
      stepId: graphResult.failedNodes[0],
      error: 'Execution failed',
      recoverable: true
    } : undefined,
    skippedSteps: graphResult.skippedNodes,
    validationFailedSteps: graphResult.validationFailedNodes,
    validatedSteps: graphResult.validatedNodes,
    executionStatus: mapGraphStatusToExecution(graphResult.status),
    totalDurationMs: graphResult.totalDurationMs,
    tokenSaving: graphResult.tokensSaved,
    learnedAsComposite: graphResult.learnedAsComposite,
    learnedCompositeId: graphResult.learnedCompositeId,
    learnRejectedReason: graphResult.learnRejectedReason,
    // DAG-specific
    executionMode: 'dag',
    graphId: graphResult.graphId,
    graphExecution: graphResult,
    graphSummary: createGraphSummary(graphResult, metadata)
  }
}

/**
 * Map graph status to execution status
 */
function mapGraphStatusToExecution(
  status: ExecuteGraphResult['status']
): DAGExecutionResponse['executionStatus'] {
  switch (status) {
    case 'completed':
      return 'completed'
    case 'partial':
      return 'partial'
    case 'failed':
      return 'failed'
    case 'cancelled':
      return 'failed'
    default:
      return 'failed'
  }
}
