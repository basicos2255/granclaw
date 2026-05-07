/**
 * Task Memory Integration
 * FEATURE 130: Advanced Tasks (Persistent, Reusable, Optimized Execution)
 * FIX 130.1: Safe Task Memory Matching & Validation
 *
 * Integrates task memory with orchestrator for SAFE pattern reuse.
 */

import {
  findPatternByInput,
  savePattern,
  recordPatternReuse,
  normalizeTaskInput,
  getCurrentEnvironment,
  runPreconditionChecks,
  type FindPatternResult,
  type TaskPattern,
  type NormalizedIntent,
  type TaskMemoryDebugInfo,
  type PreconditionCheckResult
} from '../task-memory'
import type { TaskStep } from '../task-planner/types'

/**
 * FIX 130.1: Input for checking task memory (safe)
 */
export interface CheckTaskMemoryInput {
  input: string
  tenantId: string          // Required for safe matching
  userId?: string
}

/**
 * FIX 130.1: Result of task memory check (safe)
 */
export interface CheckTaskMemoryResult {
  hasPattern: boolean
  pattern?: TaskPattern
  confidence: number
  matchType: 'exact' | 'normalized' | 'similar' | 'none'
  canReuse: boolean
  reason: string
  normalizedIntent: NormalizedIntent
  preconditions?: PreconditionCheckResult
  debugInfo: TaskMemoryDebugInfo
}

/**
 * FIX 130.1: Check task memory for a reusable pattern (SAFE)
 * Call this BEFORE sending to OpenClaw
 */
export function checkTaskMemory(params: CheckTaskMemoryInput): CheckTaskMemoryResult {
  const { input, tenantId, userId } = params
  const environment = getCurrentEnvironment()

  // Normalize input
  const normalizedIntent = normalizeTaskInput(input)

  // Find matching pattern with SAFE criteria
  const result: FindPatternResult = findPatternByInput({
    input,
    tenantId,
    userId,
    environment
  })

  // Build debug info
  const debugInfo: TaskMemoryDebugInfo = {
    taskMemoryChecked: true,
    taskMemoryUsed: false,
    signature: normalizedIntent.signature,
    actionType: normalizedIntent.actionType,
    targetEntity: normalizedIntent.targetEntity,
    matchConfidence: result.confidence,
    tokenSaving: false,
    reason: result.reason
  }

  if (!result.found || !result.pattern) {
    return {
      hasPattern: false,
      confidence: 0,
      matchType: 'none',
      canReuse: false,
      reason: result.reason,
      normalizedIntent,
      debugInfo
    }
  }

  const pattern = result.pattern

  // FIX 130.1: Check preconditions before allowing reuse
  const preconditions = result.preconditions || runPreconditionChecks(pattern, environment)

  // Determine if we can safely reuse
  // Must pass preconditions or have very high success rate
  const canReuse = preconditions.ok || pattern.successRate >= 0.95

  if (!canReuse) {
    debugInfo.preconditionWarnings = preconditions.warnings
    return {
      hasPattern: true,
      pattern,
      confidence: result.confidence,
      matchType: result.matchType,
      canReuse: false,
      reason: preconditions.reason || 'Preconditions failed',
      normalizedIntent,
      preconditions,
      debugInfo
    }
  }

  // Safe to reuse
  debugInfo.taskMemoryUsed = true
  debugInfo.patternId = pattern.id
  debugInfo.tokenSaving = true
  debugInfo.preconditionWarnings = preconditions.warnings

  console.log(`[TaskMemory] Safe pattern reuse: ${pattern.id} (${pattern.useCount} uses, ${(pattern.successRate * 100).toFixed(0)}% success)`)

  return {
    hasPattern: true,
    pattern,
    confidence: result.confidence,
    matchType: result.matchType,
    canReuse: true,
    reason: `Patrón reutilizable (${pattern.useCount} usos, ${(pattern.successRate * 100).toFixed(0)}% éxito)`,
    normalizedIntent,
    preconditions,
    debugInfo
  }
}

/**
 * FIX 130.1: Input for learning from execution (safe)
 */
export interface LearnFromExecutionInput {
  originalInput: string
  tenantId: string
  userId?: string
  steps: TaskStep[]
  success: boolean
  executionConfirmed: boolean   // Must be true to learn
  duration: number
  error?: string
  scopeKey?: string
  capabilityKey?: string
  // FIX 130.1: Status checks
  finalUiStatus?: string
  requiresSetup?: boolean
  requiresReauth?: boolean
  timeout?: boolean
  partial?: boolean
  classifierOverride?: boolean
}

/**
 * FIX 130.1: Result of learning
 */
export interface LearnFromExecutionResult {
  learned: boolean
  patternId: string
  isNew: boolean
  reason: string
}

/**
 * FIX 130.1: Learn from a successful execution (SAFE)
 * Only learns from confirmed executed results
 */
export function learnFromExecution(params: LearnFromExecutionInput): LearnFromExecutionResult {
  const {
    originalInput,
    tenantId,
    userId,
    steps,
    success,
    executionConfirmed,
    duration,
    error,
    scopeKey,
    capabilityKey,
    finalUiStatus,
    requiresSetup,
    requiresReauth,
    timeout,
    partial,
    classifierOverride
  } = params

  // FIX 130.1: Only learn from robust successes
  // Check all failure conditions
  if (!success) {
    return {
      learned: false,
      patternId: '',
      isNew: false,
      reason: 'Execution failed'
    }
  }

  if (!executionConfirmed) {
    return {
      learned: false,
      patternId: '',
      isNew: false,
      reason: 'Execution not confirmed'
    }
  }

  // FIX 130.1: Block learning for specific statuses
  if (finalUiStatus && finalUiStatus !== 'executed') {
    return {
      learned: false,
      patternId: '',
      isNew: false,
      reason: `Status not executed: ${finalUiStatus}`
    }
  }

  if (requiresSetup) {
    return {
      learned: false,
      patternId: '',
      isNew: false,
      reason: 'Requires setup - not learning'
    }
  }

  if (requiresReauth) {
    return {
      learned: false,
      patternId: '',
      isNew: false,
      reason: 'Requires reauth - not learning'
    }
  }

  if (timeout) {
    return {
      learned: false,
      patternId: '',
      isNew: false,
      reason: 'Timeout - not learning'
    }
  }

  if (partial) {
    return {
      learned: false,
      patternId: '',
      isNew: false,
      reason: 'Partial execution - not learning'
    }
  }

  if (classifierOverride) {
    return {
      learned: false,
      patternId: '',
      isNew: false,
      reason: 'Classifier override detected - not learning'
    }
  }

  // Don't learn from empty steps
  if (!steps || steps.length === 0) {
    return {
      learned: false,
      patternId: '',
      isNew: false,
      reason: 'No steps to learn'
    }
  }

  // Normalize input
  const normalizedIntent = normalizeTaskInput(originalInput)

  // Save pattern
  const pattern = savePattern({
    tenantId,
    userId,
    originalInput,
    normalizedIntent,
    steps,
    duration,
    success: true,
    executionConfirmed: true,
    error,
    environment: getCurrentEnvironment(),
    metadata: {
      category: normalizedIntent.actionType,
      language: normalizedIntent.language,
      isMultiStep: steps.length > 1,
      requiredScopes: scopeKey ? [scopeKey] : undefined,
      capabilityKey,
      scopeKey
    }
  })

  if (!pattern) {
    return {
      learned: false,
      patternId: '',
      isNew: false,
      reason: 'Pattern save failed'
    }
  }

  const isNew = pattern.useCount === 1

  console.log(`[TaskMemory] ${isNew ? 'New' : 'Updated'} pattern: ${pattern.id} (${normalizedIntent.signature})`)

  return {
    learned: true,
    patternId: pattern.id,
    isNew,
    reason: isNew
      ? 'Nuevo patrón aprendido'
      : `Patrón actualizado (${pattern.useCount} ejecuciones)`
  }
}

/**
 * Execute using a cached pattern
 * Returns the steps to execute without AI
 */
export interface ExecuteFromPatternInput {
  pattern: TaskPattern
  tenantId?: string
  userId?: string
}

export interface ExecuteFromPatternResult {
  steps: TaskStep[]
  estimatedDuration: number
  tokensEstimatedSaved: number
  patternId: string
  actionType: string
  targetEntity?: string
}

/**
 * Get execution plan from a cached pattern
 */
export function getExecutionPlanFromPattern(params: ExecuteFromPatternInput): ExecuteFromPatternResult {
  const { pattern } = params

  // Clone steps to avoid mutation
  const steps: TaskStep[] = pattern.steps.map(step => ({
    ...step,
    status: 'pending' as const
  }))

  // Estimate tokens saved (based on typical AI call)
  const tokensEstimatedSaved = 500

  console.log(`[TaskMemory] Execution plan from pattern ${pattern.id} (${steps.length} steps, ${pattern.actionType}:${pattern.targetEntity || 'none'})`)

  return {
    steps,
    estimatedDuration: pattern.avgDuration,
    tokensEstimatedSaved,
    patternId: pattern.id,
    actionType: pattern.actionType,
    targetEntity: pattern.targetEntity
  }
}

/**
 * FIX 130.1: Record pattern execution result
 * Handles both success and failure with proper invalidation
 */
export function recordPatternExecution(
  patternId: string,
  success: boolean,
  duration: number
): void {
  recordPatternReuse(patternId, success, duration)
  console.log(`[TaskMemory] Recorded pattern execution: ${patternId} (success: ${success})`)
}

/**
 * Summary of task memory for display
 */
export interface TaskMemorySummary {
  patternsAvailable: number
  totalExecutions: number
  tokensEstimatedSaved: number
  avgSuccessRate: number
  invalidatedPatterns: number
  totalFailures: number
}

/**
 * Get summary for UI display
 */
export function getTaskMemorySummary(): TaskMemorySummary {
  const { getTaskMemoryStats } = require('../task-memory')
  const stats = getTaskMemoryStats()

  return {
    patternsAvailable: stats.totalPatterns,
    totalExecutions: stats.totalExecutions,
    tokensEstimatedSaved: stats.tokensEstimatedSaved,
    avgSuccessRate: stats.avgSuccessRate,
    invalidatedPatterns: stats.invalidatedPatterns,
    totalFailures: stats.totalFailures
  }
}
