/**
 * Task Memory Integration
 * FEATURE 130: Advanced Tasks (Persistent, Reusable, Optimized Execution)
 *
 * Integrates task memory with orchestrator for pattern reuse.
 */

import {
  findPatternByInput,
  savePattern,
  recordPatternReuse,
  normalizeTaskInput,
  generateInputSignature,
  detectTaskCategory,
  detectLanguage,
  type FindPatternResult,
  type TaskPattern
} from '../task-memory'
import type { TaskStep } from '../task-planner/types'

/**
 * Input for checking task memory
 */
export interface CheckTaskMemoryInput {
  input: string
  tenantId?: string
  userId?: string
}

/**
 * Result of task memory check
 */
export interface CheckTaskMemoryResult {
  hasPattern: boolean
  pattern?: TaskPattern
  confidence: number
  matchType: 'exact' | 'normalized' | 'similar' | 'none'
  canReuse: boolean
  reason: string
}

/**
 * Check task memory for a reusable pattern
 * Call this BEFORE sending to OpenClaw
 */
export function checkTaskMemory(params: CheckTaskMemoryInput): CheckTaskMemoryResult {
  const { input, tenantId } = params

  // Find matching pattern
  const result: FindPatternResult = findPatternByInput({ input, tenantId })

  if (!result.found || !result.pattern) {
    return {
      hasPattern: false,
      confidence: 0,
      matchType: 'none',
      canReuse: false,
      reason: 'No se encontró patrón previo'
    }
  }

  const pattern = result.pattern

  // Check if we can reuse (high success rate and confidence)
  const canReuse = pattern.successRate >= 0.7 &&
                   result.confidence >= 0.8 &&
                   pattern.executionCount >= 1

  if (!canReuse) {
    return {
      hasPattern: true,
      pattern,
      confidence: result.confidence,
      matchType: result.matchType,
      canReuse: false,
      reason: pattern.successRate < 0.7
        ? `Tasa de éxito baja (${(pattern.successRate * 100).toFixed(0)}%)`
        : `Confianza insuficiente (${(result.confidence * 100).toFixed(0)}%)`
    }
  }

  console.log(`[TaskMemory] Pattern reuse available: ${pattern.id} (${pattern.executionCount} ejecuciones, ${(pattern.successRate * 100).toFixed(0)}% éxito)`)

  return {
    hasPattern: true,
    pattern,
    confidence: result.confidence,
    matchType: result.matchType,
    canReuse: true,
    reason: `Patrón reutilizable (${pattern.executionCount} ejecuciones previas)`
  }
}

/**
 * Input for learning from execution
 */
export interface LearnFromExecutionInput {
  originalInput: string
  steps: TaskStep[]
  success: boolean
  duration: number
  error?: string
  scopeKey?: string
  capabilityKey?: string
}

/**
 * Result of learning
 */
export interface LearnFromExecutionResult {
  learned: boolean
  patternId: string
  isNew: boolean
  reason: string
}

/**
 * Learn from a successful (or failed) execution
 * Call this AFTER OpenClaw execution completes
 */
export function learnFromExecution(params: LearnFromExecutionInput): LearnFromExecutionResult {
  const {
    originalInput,
    steps,
    success,
    duration,
    error,
    scopeKey,
    capabilityKey
  } = params

  // Don't learn from empty steps
  if (!steps || steps.length === 0) {
    return {
      learned: false,
      patternId: '',
      isNew: false,
      reason: 'Sin pasos para aprender'
    }
  }

  // Normalize and generate signature
  const normalizedInput = normalizeTaskInput(originalInput)
  const inputSignature = generateInputSignature(originalInput)

  // Detect metadata
  const category = detectTaskCategory(originalInput)
  const language = detectLanguage(originalInput)

  // Save pattern
  const pattern = savePattern({
    originalInput,
    normalizedInput,
    inputSignature,
    steps,
    duration,
    success,
    error,
    metadata: {
      category,
      language,
      isMultiStep: steps.length > 1,
      requiredScopes: scopeKey ? [scopeKey] : undefined
    }
  })

  const isNew = pattern.executionCount === 1

  console.log(`[TaskMemory] ${isNew ? 'New' : 'Updated'} pattern: ${pattern.id} (category: ${category})`)

  return {
    learned: true,
    patternId: pattern.id,
    isNew,
    reason: isNew
      ? 'Nuevo patrón aprendido'
      : `Patrón actualizado (${pattern.executionCount} ejecuciones)`
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
  const tokensEstimatedSaved = 500 // Conservative estimate

  console.log(`[TaskMemory] Providing execution plan from pattern ${pattern.id} (${steps.length} steps)`)

  return {
    steps,
    estimatedDuration: pattern.avgDuration,
    tokensEstimatedSaved,
    patternId: pattern.id
  }
}

/**
 * Record that a pattern was reused
 * Call this after successfully executing a cached pattern
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
}

/**
 * Get summary for UI display
 */
export function getTaskMemorySummary(): TaskMemorySummary {
  // Import stats function
  const { getTaskMemoryStats } = require('../task-memory')
  const stats = getTaskMemoryStats()

  return {
    patternsAvailable: stats.totalPatterns,
    totalExecutions: stats.totalExecutions,
    tokensEstimatedSaved: stats.tokensEstimatedSaved,
    avgSuccessRate: stats.avgSuccessRate
  }
}
