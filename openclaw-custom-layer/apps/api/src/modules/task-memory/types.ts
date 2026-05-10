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
