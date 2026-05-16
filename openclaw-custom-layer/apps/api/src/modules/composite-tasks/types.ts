/**
 * Composite Tasks Types
 * FEATURE 130.2: Composite Tasks & Intelligent Task Chaining
 *
 * Types for composite task composition, chaining, and workflow execution.
 */

import type { TaskActionType, NormalizedIntent } from '../task-memory/types'

/**
 * Current version for composite task schema migration
 */
export const CURRENT_COMPOSITE_TASK_VERSION = 1

/**
 * Step execution source
 */
export type CompositeStepType =
  | 'task_memory'    // Reuse learned pattern
  | 'capability'     // Execute local capability
  | 'openclaw'       // Delegate to OpenClaw
  | 'manual'         // Requires user action

/**
 * Step execution status
 * FEATURE 130.3: Added validation_failed
 */
export type CompositeStepStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'skipped'
  | 'blocked'
  | 'validation_failed'   // Step executed but validation failed

/**
 * A single step within a composite task
 * FEATURE 130.3: Extended with validation fields
 */
export interface CompositeTaskStep {
  stepId: string
  order: number
  type: CompositeStepType
  actionType: TaskActionType
  targetEntity?: string
  description: string
  // Reference to existing pattern/capability
  taskPatternId?: string
  capabilityKey?: string
  // Execution requirements
  requiresAi: boolean
  requiresConfirmation: boolean
  dependsOnPrevious: boolean
  // Estimates
  estimatedDurationMs?: number
  // FEATURE 130.3: Validation requirements
  validationRequired?: boolean         // If true, validate after execution
  validationType?: string              // 'file_downloaded', 'app_installed', 'app_opened', etc.
  validationTarget?: string            // Specific target to validate
  validationCritical?: boolean         // If true, stop workflow on validation failure
  // Runtime state (not persisted in pattern)
  status?: CompositeStepStatus
  error?: string
  result?: unknown
  startedAt?: string
  completedAt?: string
  skippedReason?: string
  // FEATURE 130.3: Validation results (runtime)
  validationResult?: {
    ok: boolean
    reason?: string
    warnings: string[]
    evidence: string[]
    attempts: number
  }
}

/**
 * A composite task pattern (persisted)
 */
export interface CompositeTask {
  id: string
  tenantId: string
  userId?: string
  name: string
  // Intent matching
  normalizedIntent: string
  signature: string                    // Combined signature e.g. "download_file:vlc|install_app:vlc|open_app:vlc"
  triggerPatterns: string[]            // Alternative input patterns
  // Steps definition
  steps: CompositeTaskStep[]
  // Statistics
  successRate: number
  executionCount: number
  failureCount: number
  avgDurationMs: number
  tokensEstimatedSaved: number
  // Versioning
  version: number
  invalidated: boolean
  invalidationReason?: string
  // Timestamps
  createdAt: string
  updatedAt: string
  lastUsedAt?: string
}

/**
 * Execution plan for a composite task (runtime)
 */
export interface CompositeExecutionPlan {
  id: string
  tenantId: string
  userId?: string
  sourceInput: string
  // Plan details
  compositeTaskId?: string             // If reusing existing composite
  steps: CompositeTaskStep[]
  // Analysis
  confidence: number
  estimatedDurationMs: number
  requiresAi: boolean
  tokenSavingEstimate: number
  reusedPatternIds: string[]
  reusedCapabilityKeys: string[]
  // Optimization
  skippableSteps: string[]             // Steps that can be skipped (already done)
  // Timestamps
  createdAt: string
}

/**
 * Result of composite task execution
 * FEATURE 130.3: Extended with validation results
 */
export interface CompositeExecutionResult {
  planId: string
  compositeTaskId?: string
  success: boolean
  // Step results
  completedSteps: string[]
  failedStep?: {
    stepId: string
    error: string
    recoverable: boolean
  }
  skippedSteps: string[]
  // FEATURE 130.3: Validation results
  validationFailedSteps: string[]      // Steps that executed but failed validation
  validatedSteps: string[]             // Steps that passed validation
  // Metrics
  executionStatus: 'completed' | 'partial' | 'failed' | 'blocked' | 'validation_failed'
  totalDurationMs: number
  tokenSaving: number
  // Learning
  learnedAsComposite: boolean
  learnedCompositeId?: string
  // FEATURE 130.3: Learning rejection reason
  learnRejectedReason?: string
}

/**
 * Input for finding or building a composite plan
 */
export interface BuildCompositePlanInput {
  input: string
  tenantId: string
  userId?: string
  // Options
  allowPartialReuse?: boolean          // Allow partial pattern matching
  skipOptimization?: boolean           // Don't skip already-done steps
  forceOpenClaw?: boolean              // Force OpenClaw for all steps
}

/**
 * P6.14: Capability readiness summary for plan result
 * P6.17R: Extended to support both single-action and multistep plans
 */
export interface CapabilityReadinessSummary {
  capability?: string
  capabilityKey?: string  // P6.17R: Alternative key format for multistep
  implemented?: boolean
  configured?: boolean
  available: boolean
  statusMessage?: string
  reason?: string         // P6.17R: Alternative to statusMessage
  canTest?: boolean       // P6.17R: Whether capability can be tested
  recommendedAction?: string // P6.17R: Recommended action for user
}

/**
 * P6.14: Security warning for risky requests
 */
export interface SecurityWarning {
  type: 'suspicious_download' | 'untrusted_source' | 'high_risk_action'
  riskLevel: 'low' | 'medium' | 'high'
  message: string
  recommendedAction?: string
}

/**
 * Result of composite plan building
 */
export interface BuildCompositePlanResult {
  found: boolean
  plan?: CompositeExecutionPlan
  existingComposite?: CompositeTask
  reason: string
  confidence: number
  // Analysis
  stepsFromTaskMemory: number
  stepsFromCapabilities: number
  stepsRequiringAi: number
  estimatedTokenSaving: number
  // P6.14 + P6.17R: Capability readiness for single-action or multistep plans
  // Single value for single-action, array for multistep
  capabilityReadiness?: CapabilityReadinessSummary | CapabilityReadinessSummary[]
  blockingCapabilities?: CapabilityReadinessSummary[]
  // P6.14: Security warnings for risky requests
  securityWarnings?: SecurityWarning[]
}

/**
 * Input for executing a composite plan
 */
export interface ExecuteCompositePlanInput {
  plan: CompositeExecutionPlan
  tenantId: string
  userId?: string
  sessionId?: string
  /** P6.17: Task ID for event emission */
  taskId?: string
  /** P6.17: Job ID for event emission */
  jobId?: string
  // Options
  stopOnFirstFailure?: boolean
  allowPartialCompletion?: boolean
  retryFailedSteps?: boolean
  maxRetries?: number
}

/**
 * Step precondition check result
 */
export interface StepPreconditionResult {
  canExecute: boolean
  shouldSkip: boolean
  skipReason?: string
  warnings: string[]
}

/**
 * Composite task state (persisted)
 */
export interface CompositeTaskState {
  version: number
  tasks: CompositeTask[]
  lastUpdated: string
  stats: CompositeTaskStats
}

/**
 * Composite task statistics
 */
export interface CompositeTaskStats {
  totalTasks: number
  totalExecutions: number
  avgSuccessRate: number
  tokensEstimatedSaved: number
  invalidatedTasks: number
}

/**
 * Default state
 */
export const DEFAULT_COMPOSITE_TASK_STATE: CompositeTaskState = {
  version: 1,
  tasks: [],
  lastUpdated: new Date().toISOString(),
  stats: {
    totalTasks: 0,
    totalExecutions: 0,
    avgSuccessRate: 0,
    tokensEstimatedSaved: 0,
    invalidatedTasks: 0
  }
}

/**
 * Debug info for composite execution
 */
export interface CompositeDebugInfo {
  compositeTaskChecked: boolean
  compositeTaskUsed: boolean
  compositeTaskId?: string
  planId?: string
  reusedPatterns: number
  reusedCapabilities: number
  skippedSteps: number
  tokenSaving: number
  reason: string
}
