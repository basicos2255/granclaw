/**
 * Task System Types
 * FEATURE 080: Task System v1
 * P6.3: Added structured result support
 * P6.7: Execution Evidence & Semantic States
 */

import type { DebugSnapshot } from '../orchestrator/trace'
import type { TaskOutput, TaskArtifact } from '../task-results/types'
import type { ExecutionEvidence, SemanticExecutionState } from '../task-memory/types'

/**
 * Estado de una tarea (technical)
 * P6.7: 'success' now requires ExecutionEvidence
 * P6.9R: Added 'queued' for tasks in queue system
 */
export type TaskStatus = 'pending' | 'running' | 'success' | 'blocked' | 'error' | 'unconfirmed' | 'queued'

/**
 * P6.7: Human-readable task status for UI
 * Maps to SemanticExecutionState from task-memory
 */
export type HumanTaskStatus = SemanticExecutionState

/**
 * Paso de ejecución (copia de trace para independencia)
 */
export interface TaskExecutionTraceStep {
  id: string
  requestId?: string
  timestamp: string
  stage: string
  status: string
  label: string
  detail?: string
  durationMs?: number
}

/**
 * Tarea de GranClaw
 * P6.3: Added structured result fields
 * P6.7: Added execution evidence and human status
 */
export interface GranClawTask {
  id: string
  status: TaskStatus
  tenantId: string
  userId?: string
  requestId?: string
  input: string
  result?: unknown
  source?: string
  reason?: string
  error?: string
  executionTrace?: TaskExecutionTraceStep[]
  debugSnapshot?: DebugSnapshot
  executionDurationMs?: number
  createdAt: string
  updatedAt: string

  // P6.3: Structured result fields
  summary?: string
  outputs?: TaskOutput[]
  artifacts?: TaskArtifact[]
  provider?: string

  // P6.7: Execution evidence and semantic state
  humanStatus?: HumanTaskStatus
  executionEvidence?: ExecutionEvidence
  /** True if task used task-memory pattern (but still executed) */
  usedPattern?: boolean
  /** Pattern ID if used */
  patternId?: string
  /** Whether evidence was validated */
  evidenceValidated?: boolean

  // P6.12: Retry and thread tracking
  /** Associated thread ID */
  threadId?: string
  /** Number of retry attempts */
  retryCount?: number
  /** Last retry job ID in queue */
  lastRetryJobId?: string
}

/**
 * Input para crear tarea
 */
export interface CreateTaskInput {
  tenantId: string
  userId?: string
  requestId?: string
  input: string
}

/**
 * Input para actualizar tarea
 * P6.3: Added structured result fields
 * P6.7: Added execution evidence fields
 */
export interface UpdateTaskInput {
  status?: TaskStatus
  result?: unknown
  source?: string
  reason?: string
  error?: string
  executionTrace?: TaskExecutionTraceStep[]
  debugSnapshot?: DebugSnapshot
  executionDurationMs?: number

  // P6.3: Structured result fields
  summary?: string
  outputs?: TaskOutput[]
  artifacts?: TaskArtifact[]
  provider?: string

  // P6.7: Execution evidence fields
  humanStatus?: HumanTaskStatus
  executionEvidence?: ExecutionEvidence
  usedPattern?: boolean
  patternId?: string
  evidenceValidated?: boolean

  // P6.12: Retry and thread tracking
  threadId?: string
  retryCount?: number
  lastRetryJobId?: string
}
