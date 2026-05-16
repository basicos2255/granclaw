/**
 * Task System Types
 * FEATURE 080: Task System v1
 * P6.3: Added structured result support
 * P6.7: Execution Evidence & Semantic States
 * P6.13: Validation Explainability & Failure Reasons
 */

import type { DebugSnapshot } from '../orchestrator/trace'
import type { TaskOutput, TaskArtifact } from '../task-results/types'
import type { ExecutionEvidence, SemanticExecutionState } from '../task-memory/types'

/**
 * P6.13: Canonical validation failure reasons
 * Used to explain WHY a task failed validation
 */
export type ValidationFailureReason =
  | 'missing_required_artifact'
  | 'missing_required_output'
  | 'missing_execution_evidence'
  | 'provider_unavailable'
  | 'capability_not_configured'
  | 'capability_not_implemented'
  | 'permission_required'
  | 'approval_required'
  | 'auth_required'
  | 'pairing_required'
  | 'unsupported_action'
  | 'unsafe_action_blocked'
  | 'download_failed'
  | 'browser_failed'
  | 'planner_failed'
  | 'queue_failed'
  | 'execution_timeout'
  | 'no_actions_executed'
  | 'mock_provider_used'
  | 'unknown'

/**
 * P6.13: Recovery action types
 * Tells UI what actions are available for user
 */
export type RecoveryActionType =
  | 'retry'
  | 'retry_with_browser'
  | 'retry_with_replan'
  | 'configure_capability'
  | 'test_capability'
  | 'approve_action'
  | 'provide_source'
  | 'provide_input'
  | 'repair_connection'
  | 'contact_support'
  | 'view_details'
  | 'cancel'

/**
 * P6.13: Recovery action for UI
 */
export interface RecoveryAction {
  type: RecoveryActionType
  label: string
  description?: string
  /** API endpoint to call (if applicable) */
  endpoint?: string
  /** Navigation path (if applicable) */
  navigateTo?: string
  /** Whether this is the primary suggested action */
  primary?: boolean
}

/**
 * P6.13: Human-readable task failure explanation
 * Used to explain validation failures to users
 */
export interface TaskFailureExplanation {
  /** Canonical failure code */
  code: ValidationFailureReason
  /** Human-readable title (short) */
  title: string
  /** Human-readable explanation (user-friendly) */
  humanMessage: string
  /** Technical message (for debugging) */
  technicalMessage?: string
  /** Which step failed (if multi-step) */
  failedStep?: string
  /** Which capability was involved */
  capability?: string
  /** Which provider was used/expected */
  provider?: string
  /** What artifact was required but missing */
  requiredArtifact?: string
  /** What output was required but missing */
  requiredOutput?: string
  /** Available recovery actions */
  recoveryActions: RecoveryAction[]
  /** Can user retry this task */
  canRetry: boolean
  /** Can user repair the capability */
  canRepair: boolean
  /** Can user request replanning */
  canReplan: boolean
}

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

  // P6.13: Failure explanation for validation errors
  /** Human-readable failure explanation */
  failureExplanation?: TaskFailureExplanation

  // P6.17: Reconciliation info (top-level for easy access)
  /** Reconciliation result from task-reconciliation */
  reconciliation?: TaskReconciliation
}

/**
 * P6.17: Task reconciliation info
 * Persisted at top-level for easy frontend access
 */
export interface TaskReconciliation {
  phase: string
  isSuccess: boolean
  reason: string
  executionStatus?: 'completed' | 'partial' | 'failed' | 'blocked' | 'validation_failed'
  validationFailedSteps?: string[]
  validatedSteps?: string[]
  completedSteps?: string[]
  failedStep?: {
    stepId: string
    error: string
    recoverable: boolean
  }
  skippedSteps?: string[]
  totalDurationMs?: number
  tokenSaving?: number
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

  // P6.13: Failure explanation
  failureExplanation?: TaskFailureExplanation

  // P6.17: Reconciliation info
  reconciliation?: TaskReconciliation
}
