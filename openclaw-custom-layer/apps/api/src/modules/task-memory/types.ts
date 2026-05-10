/**
 * Task Memory Types
 * FEATURE 130: Advanced Tasks (Persistent, Reusable, Optimized Execution)
 * FIX 130.1: Safe Task Memory Matching & Validation
 * P6.7: Execution Evidence & Artifact Validation
 *
 * Types for task pattern storage and reuse.
 *
 * IMPORTANT (P6.7): Task-memory is a PLANNER ACCELERATOR, not an execution cache.
 * A pattern match means "use this strategy" NOT "execution completed".
 * Real execution must still happen, and evidence must be collected.
 */

import type { TaskStep } from '../task-planner/types'

/**
 * FIX 130.1: Current pattern schema version
 * Increment when schema changes to invalidate old patterns
 */
export const CURRENT_TASK_PATTERN_VERSION = 2  // P6.7: Bumped for evidence model

/**
 * FIX 130.1: Action types for intent classification
 */
export type TaskActionType =
  | 'open_app'
  | 'close_app'
  | 'install_app'
  | 'uninstall_app'
  | 'download_file'
  | 'upload_file'
  | 'search_web'
  | 'search_file'
  | 'copy_file'
  | 'move_file'
  | 'delete_file'
  | 'create_file'
  | 'edit_file'
  | 'run_command'
  | 'navigate_url'
  | 'send_message'
  | 'configure_setting'
  | 'general_task'
  | 'unknown'

/**
 * FIX 130.1: Environment fingerprint for context matching
 */
export interface EnvironmentFingerprint {
  platform?: 'darwin' | 'win32' | 'linux'
  os?: string
  hostname?: string
  provider?: string
}

/**
 * FIX 130.1: A learned task pattern that can be reused (SAFE version)
 */
export interface TaskPattern {
  id: string
  tenantId: string                    // Required: tenant isolation
  userId?: string                     // Optional: user-specific patterns
  inputSignature: string              // Normalized signature for matching
  normalizedIntent: string            // Canonical intent form
  actionType: TaskActionType          // Classified action type
  targetEntity?: string               // Target of action (app name, file, etc.)
  environmentFingerprint: EnvironmentFingerprint
  originalInputs: string[]            // Original inputs that mapped here (max 10)
  steps: TaskStep[]                   // Learned execution steps
  successRate: number                 // 0-1, success ratio
  confidence: number                  // 0-1, matching confidence
  useCount: number                    // Times successfully reused
  failureCount: number                // Times failed after reuse
  version: number                     // Pattern schema version
  invalidated: boolean                // Whether pattern is invalidated
  invalidationReason?: string         // Why invalidated
  lastUsedAt: string                  // ISO timestamp
  createdAt: string                   // ISO timestamp
  updatedAt: string                   // ISO timestamp
  avgDuration: number                 // Average execution time in ms
  lastError?: string                  // Last error if any
  metadata?: TaskPatternMetadata      // Additional metadata
}

/**
 * Additional metadata for task patterns
 */
export interface TaskPatternMetadata {
  category?: string                   // Task category (install, open, search, etc.)
  requiredScopes?: string[]           // OpenClaw scopes needed
  isMultiStep?: boolean               // Whether task has multiple steps
  language?: 'es' | 'en'              // Detected language
  capabilityKey?: string              // Associated capability
  scopeKey?: string                   // Associated scope
}

/**
 * FIX 130.1: Result of intent normalization
 */
export interface NormalizedIntent {
  signature: string                   // Unique signature (actionType:targetEntity)
  actionType: TaskActionType          // Classified action
  targetEntity?: string               // Target entity extracted
  normalizedIntent: string            // Full normalized intent string
  confidence: number                  // 0-1, confidence in classification
  language: 'es' | 'en'               // Detected language
}

/**
 * FIX 130.1: Precondition check result
 */
export interface PreconditionCheckResult {
  ok: boolean
  warnings: string[]
  reason?: string
  skipExecution?: boolean
  optimizedResult?: 'already_installed' | 'file_exists' | 'app_running'
}

/**
 * Persistent state for task memory
 */
export interface TaskMemoryState {
  version: number
  patterns: TaskPattern[]
  lastUpdated: string
  stats: TaskMemoryStats
}

/**
 * Global stats for task memory
 */
export interface TaskMemoryStats {
  totalPatterns: number
  totalExecutions: number
  tokensEstimatedSaved: number
  avgSuccessRate: number
  invalidatedPatterns: number
  totalFailures: number
}

/**
 * Default empty state
 */
export const DEFAULT_TASK_MEMORY_STATE: TaskMemoryState = {
  version: CURRENT_TASK_PATTERN_VERSION,
  patterns: [],
  lastUpdated: new Date().toISOString(),
  stats: {
    totalPatterns: 0,
    totalExecutions: 0,
    tokensEstimatedSaved: 0,
    avgSuccessRate: 0,
    invalidatedPatterns: 0,
    totalFailures: 0
  }
}

/**
 * FIX 130.1: Input for finding a matching pattern (safe)
 */
export interface FindPatternInput {
  input: string
  tenantId: string                    // Required for safe matching
  userId?: string
  environment?: EnvironmentFingerprint
}

/**
 * FIX 130.1: Result of pattern lookup (safe)
 */
export interface FindPatternResult {
  found: boolean
  pattern?: TaskPattern
  confidence: number
  matchType: 'exact' | 'normalized' | 'similar' | 'none'
  reason: string                      // Why matched or not matched
  preconditions?: PreconditionCheckResult
}

/**
 * FIX 130.1: Input for saving/updating a pattern (safe)
 */
export interface SavePatternInput {
  tenantId: string                    // Required
  userId?: string
  originalInput: string
  normalizedIntent: NormalizedIntent
  steps: TaskStep[]
  duration: number
  success: boolean
  executionConfirmed: boolean         // Must be true to learn
  error?: string
  environment?: EnvironmentFingerprint
  metadata?: TaskPatternMetadata
}

/**
 * Result of execution using a pattern
 */
export interface PatternExecutionResult {
  success: boolean
  usedPattern: boolean
  patternId?: string
  steps: TaskStep[]
  duration: number
  tokensEstimatedSaved?: number
  error?: string
  preconditionWarnings?: string[]
}

/**
 * FIX 130.1: Debug info for task memory decisions
 */
export interface TaskMemoryDebugInfo {
  taskMemoryChecked: boolean
  taskMemoryUsed: boolean
  patternId?: string
  signature?: string
  actionType?: TaskActionType
  targetEntity?: string
  matchConfidence?: number
  preconditionWarnings?: string[]
  tokenSaving: boolean
  reason: string
}

// ============================================================================
// P6.7: EXECUTION EVIDENCE MODEL
// ============================================================================

/**
 * P6.7: Evidence that a task was actually executed
 *
 * This model ensures that tasks cannot be marked as "success" without
 * proof of real execution. Pattern reuse accelerates PLANNING, not execution.
 */
export interface ExecutionEvidence {
  /** Unique execution ID */
  executionId: string

  /** Provider that executed the task */
  provider: 'openclaw' | 'granclaw' | 'local' | 'capability' | 'mock'

  /** Worker/session that ran the execution */
  workerId?: string

  /** When execution started */
  startedAt: string

  /** When execution completed */
  completedAt: string

  /** Number of actions/steps actually executed */
  actionsExecuted: number

  /** Whether outputs were generated */
  outputsGenerated: boolean

  /** Number of outputs generated */
  outputCount: number

  /** Whether artifacts were generated */
  artifactsGenerated: boolean

  /** Number of artifacts generated */
  artifactCount: number

  /** Total execution duration in ms */
  durationMs: number

  /** External reference (e.g., OpenClaw request ID) */
  externalRef?: string

  /** Error if execution failed */
  error?: string

  /** Validation status */
  validationStatus?: 'pending' | 'passed' | 'failed' | 'skipped'

  /** Validation reason */
  validationReason?: string
}

/**
 * P6.7: Action types that REQUIRE artifacts to be considered successful
 */
export const ARTIFACT_REQUIRED_ACTIONS: TaskActionType[] = [
  'download_file',
  'install_app',
  'create_file',
  'copy_file'
]

/**
 * P6.7: Action types that REQUIRE outputs to be considered successful
 */
export const OUTPUT_REQUIRED_ACTIONS: TaskActionType[] = [
  'search_web',
  'search_file',
  'run_command'
]

/**
 * P6.7: Action types that require user confirmation for automation
 */
export const CONFIRMATION_REQUIRED_ACTIONS: TaskActionType[] = [
  'install_app',
  'uninstall_app',
  'delete_file',
  'download_file'
]

/**
 * P6.7: Check if action type requires artifacts
 */
export function requiresArtifacts(actionType: TaskActionType): boolean {
  return ARTIFACT_REQUIRED_ACTIONS.includes(actionType)
}

/**
 * P6.7: Check if action type requires outputs
 */
export function requiresOutputs(actionType: TaskActionType): boolean {
  return OUTPUT_REQUIRED_ACTIONS.includes(actionType)
}

/**
 * P6.7: Check if action type requires user confirmation
 */
export function requiresConfirmation(actionType: TaskActionType): boolean {
  return CONFIRMATION_REQUIRED_ACTIONS.includes(actionType)
}

/**
 * P6.7: Semantic execution states (more descriptive than technical states)
 */
export type SemanticExecutionState =
  | 'thinking'           // AI analyzing input
  | 'planning'           // Building execution plan
  | 'reusing_strategy'   // Found pattern, preparing to execute
  | 'queued'             // Waiting in execution queue
  | 'executing'          // Running steps
  | 'validating'         // Checking results
  | 'waiting_approval'   // Needs user confirmation
  | 'waiting_input'      // Needs additional user input
  | 'needs_artifacts'    // Execution done but missing artifacts
  | 'needs_outputs'      // Execution done but missing outputs
  | 'completed'          // Success with evidence
  | 'failed'             // Execution failed
  | 'cancelled'          // User cancelled
  | 'paused'             // User paused

/**
 * P6.7: Validate execution evidence for a given action type
 */
export interface ValidateEvidenceInput {
  evidence: ExecutionEvidence
  actionType: TaskActionType
  requireArtifacts?: boolean
  requireOutputs?: boolean
}

/**
 * P6.7: Result of evidence validation
 */
export interface ValidateEvidenceResult {
  valid: boolean
  canMarkSuccess: boolean
  missingEvidence: string[]
  warnings: string[]
  suggestedState: SemanticExecutionState
}

/**
 * P6.7: Validate that execution evidence is sufficient for the action type
 */
export function validateExecutionEvidence(input: ValidateEvidenceInput): ValidateEvidenceResult {
  const { evidence, actionType, requireArtifacts, requireOutputs } = input
  const missingEvidence: string[] = []
  const warnings: string[] = []

  // Basic execution checks
  if (!evidence.executionId) {
    missingEvidence.push('executionId')
  }
  if (!evidence.provider) {
    missingEvidence.push('provider')
  }
  if (!evidence.startedAt || !evidence.completedAt) {
    missingEvidence.push('execution timestamps')
  }
  if (evidence.actionsExecuted === 0) {
    missingEvidence.push('no actions executed')
  }

  // Mock provider warning
  if (evidence.provider === 'mock') {
    warnings.push('Executed via mock provider - no real execution')
  }

  // Artifact requirements
  const needsArtifacts = requireArtifacts ?? requiresArtifacts(actionType)
  if (needsArtifacts && !evidence.artifactsGenerated) {
    missingEvidence.push('artifacts required but not generated')
  }
  if (needsArtifacts && evidence.artifactCount === 0) {
    missingEvidence.push('artifact count is zero')
  }

  // Output requirements
  const needsOutputs = requireOutputs ?? requiresOutputs(actionType)
  if (needsOutputs && !evidence.outputsGenerated) {
    missingEvidence.push('outputs required but not generated')
  }
  if (needsOutputs && evidence.outputCount === 0) {
    missingEvidence.push('output count is zero')
  }

  // Error check
  if (evidence.error) {
    missingEvidence.push(`execution error: ${evidence.error}`)
  }

  // Validation status check
  if (evidence.validationStatus === 'failed') {
    missingEvidence.push(`validation failed: ${evidence.validationReason || 'unknown'}`)
  }

  const valid = missingEvidence.length === 0
  const canMarkSuccess = valid && warnings.length === 0

  // Determine suggested state
  let suggestedState: SemanticExecutionState
  if (valid) {
    suggestedState = 'completed'
  } else if (missingEvidence.some(m => m.includes('artifacts'))) {
    suggestedState = 'needs_artifacts'
  } else if (missingEvidence.some(m => m.includes('outputs'))) {
    suggestedState = 'needs_outputs'
  } else if (missingEvidence.some(m => m.includes('error'))) {
    suggestedState = 'failed'
  } else {
    suggestedState = 'failed'
  }

  return {
    valid,
    canMarkSuccess,
    missingEvidence,
    warnings,
    suggestedState
  }
}
