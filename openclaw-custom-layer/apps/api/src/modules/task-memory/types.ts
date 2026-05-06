/**
 * Task Memory Types
 * FEATURE 130: Advanced Tasks (Persistent, Reusable, Optimized Execution)
 *
 * Types for task pattern storage and reuse.
 */

import type { TaskStep } from '../task-planner/types'

/**
 * A learned task pattern that can be reused
 */
export interface TaskPattern {
  id: string
  inputSignature: string           // Normalized hash/key for matching
  normalizedInput: string          // Canonical form of the input
  originalInputs: string[]         // All original inputs that mapped to this pattern
  steps: TaskStep[]                // Learned execution steps
  successRate: number              // 0-1, success ratio
  lastUsedAt: string               // ISO timestamp
  createdAt: string                // ISO timestamp
  executionCount: number           // How many times executed
  avgDuration: number              // Average execution time in ms
  lastError?: string               // Last error if any
  metadata?: TaskPatternMetadata   // Additional metadata
}

/**
 * Additional metadata for task patterns
 */
export interface TaskPatternMetadata {
  category?: string                // Task category (install, open, search, etc.)
  requiredScopes?: string[]        // OpenClaw scopes needed
  isMultiStep?: boolean            // Whether task has multiple steps
  language?: 'es' | 'en'           // Detected language
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
  tokensEstimatedSaved: number     // Estimated AI tokens saved by reuse
  avgSuccessRate: number
}

/**
 * Default empty state
 */
export const DEFAULT_TASK_MEMORY_STATE: TaskMemoryState = {
  version: 1,
  patterns: [],
  lastUpdated: new Date().toISOString(),
  stats: {
    totalPatterns: 0,
    totalExecutions: 0,
    tokensEstimatedSaved: 0,
    avgSuccessRate: 0
  }
}

/**
 * Input for finding a matching pattern
 */
export interface FindPatternInput {
  input: string
  tenantId?: string
}

/**
 * Result of pattern lookup
 */
export interface FindPatternResult {
  found: boolean
  pattern?: TaskPattern
  confidence: number               // 0-1, how confident we are in the match
  matchType: 'exact' | 'normalized' | 'similar' | 'none'
}

/**
 * Input for saving/updating a pattern
 */
export interface SavePatternInput {
  originalInput: string
  normalizedInput: string
  inputSignature: string
  steps: TaskStep[]
  duration: number
  success: boolean
  error?: string
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
}
