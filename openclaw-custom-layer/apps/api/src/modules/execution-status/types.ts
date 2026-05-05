/**
 * Execution Status Types
 * FIX 124: Final Execution Status Resolution
 *
 * Separates Hub decision from execution status and final UI status.
 */

/**
 * Hub/Security decision - whether the action was allowed or blocked by policy
 */
export type HubDecisionStatus = 'allowed' | 'blocked'

/**
 * Actual execution status - what happened during execution
 */
export type ExecutionStatus =
  | 'not_started'
  | 'executed'
  | 'pending_confirmation'
  | 'setup_required'
  | 'reauthorization_required'
  | 'failed'
  | 'partial'
  | 'skipped'

/**
 * Final UI status - what to show to the user
 */
export type FinalUiStatus =
  | 'allowed'
  | 'executed'
  | 'pending_confirmation'
  | 'setup_required'
  | 'reauthorization_required'
  | 'failed'
  | 'partial'
  | 'blocked'

/**
 * Severity level for UI display
 */
export type StatusSeverity = 'success' | 'warning' | 'error' | 'info'

/**
 * Resolved execution status with all context for UI
 */
export interface ResolvedExecutionStatus {
  /** Hub/policy decision */
  hubDecision: HubDecisionStatus
  /** Actual execution outcome */
  executionStatus: ExecutionStatus
  /** Final status to display in UI */
  finalUiStatus: FinalUiStatus
  /** Whether execution was actually confirmed */
  executionConfirmed: boolean
  /** Whether this is considered a success */
  isSuccess: boolean
  /** Visual severity */
  severity: StatusSeverity
  /** Human-readable title */
  title: string
  /** Human-readable message */
  message: string
  /** Technical reason for this status */
  reason: string
}

/**
 * Input for status resolution
 */
export interface StatusResolverInput {
  /** Hub allowed the action */
  hubAllowed?: boolean
  /** Hub blocked the action */
  hubBlocked?: boolean
  /** Hub reason/decision log */
  hubReason?: string
  /** Execution result */
  result?: unknown
  /** Error from execution */
  error?: string
  /** Response meta */
  meta?: {
    executionConfirmed?: boolean
    requiresReauth?: boolean
    requiresSetup?: boolean
    source?: string
    provider?: string
    pendingConfirmation?: boolean
  }
  /** Debug snapshot */
  debugSnapshot?: {
    executionConfirmed?: boolean
    error?: string
    source?: string
  }
  /** Execution status from response */
  executionStatus?: string
  /** Source of result */
  source?: string
}
