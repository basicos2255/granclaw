/**
 * Task Planner Types
 * FIX 126: Timeout Recovery & Multistep Task Execution
 *
 * Types for splitting complex tasks into steps and tracking execution.
 */

/**
 * A single step in a multistep task
 */
export interface TaskStep {
  /** Step identifier */
  id: string
  /** Step order (1-based) */
  order: number
  /** Step description */
  description: string
  /** Input command for this step */
  input: string
  /** Step status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  /** Result of execution (if completed) */
  result?: unknown
  /** Error message (if failed) */
  error?: string
  /** Whether this step depends on previous step's result */
  dependsOnPrevious: boolean
  /** Estimated duration category */
  estimatedDuration: 'quick' | 'medium' | 'long'
}

/**
 * Result of splitting a task into steps
 */
export interface SplitTaskResult {
  /** Whether the task was split */
  isSplittable: boolean
  /** Original input */
  originalInput: string
  /** Steps (if splittable) */
  steps: TaskStep[]
  /** Total estimated duration category */
  totalDuration: 'quick' | 'medium' | 'long'
  /** Reason for classification */
  reason: string
}

/**
 * Input for task splitting
 */
export interface SplitTaskInput {
  /** User input command */
  input: string
  /** Tenant ID */
  tenantId: string
  /** User ID */
  userId?: string
  /** Scope key if known */
  scopeKey?: string
  /** Capability key if known */
  capabilityKey?: string
}

/**
 * Task execution context for step execution
 */
export interface StepExecutionContext {
  /** Task ID */
  taskId: string
  /** Step ID being executed */
  stepId: string
  /** Previous step results (for dependent steps) */
  previousResults: Record<string, unknown>
  /** Tenant context */
  tenantId: string
  /** User context */
  userId?: string
}

/**
 * Result of executing a step
 */
export interface StepExecutionResult {
  /** Step ID */
  stepId: string
  /** Whether execution succeeded */
  success: boolean
  /** Result data */
  result?: unknown
  /** Error if failed */
  error?: string
  /** Execution status */
  status: 'completed' | 'failed' | 'timeout' | 'skipped'
}

/**
 * Timeout recovery info
 */
export interface TimeoutRecoveryInfo {
  /** Original input that timed out */
  originalInput: string
  /** Tenant ID */
  tenantId: string
  /** User ID */
  userId?: string
  /** Timestamp of timeout */
  timeoutAt: string
  /** Suggested steps for recovery */
  suggestedSteps: TaskStep[]
  /** Capability key if known */
  capabilityKey?: string
  /** Scope key if known */
  scopeKey?: string
  /** Error that caused timeout */
  originalError?: string
}

/**
 * Multistep patterns for detection
 */
export interface MultistepPattern {
  /** Pattern name */
  name: string
  /** Regex or keywords */
  pattern: RegExp
  /** Connector words */
  connectors: string[]
  /** Example */
  example: string
}
