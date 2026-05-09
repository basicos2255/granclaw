/**
 * Task Results Types
 * P6.3: Operational UX, Result Visibility & Real Task Outcomes
 *
 * Structured result model for task execution outcomes.
 */

/**
 * Output type enumeration
 */
export type TaskOutputType =
  | 'text'
  | 'link'
  | 'json'
  | 'file'
  | 'image'
  | 'table'
  | 'warning'
  | 'code'
  | 'list'

/**
 * Artifact type enumeration
 */
export type TaskArtifactType =
  | 'file'
  | 'download'
  | 'screenshot'
  | 'report'
  | 'url'
  | 'log'

/**
 * Single output item
 */
export interface TaskOutput {
  type: TaskOutputType
  label?: string
  value: unknown
}

/**
 * Artifact - file or resource created by task
 */
export interface TaskArtifact {
  type: TaskArtifactType
  name: string
  path?: string
  url?: string
  size?: number
  mimeType?: string
  metadata?: Record<string, unknown>
}

/**
 * Workflow step result
 */
export interface WorkflowStepResult {
  stepId: string
  name: string
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped'
  startedAt?: string
  completedAt?: string
  durationMs?: number
  output?: TaskOutput[]
  error?: string
}

/**
 * Validation status
 */
export type ValidationStatus =
  | 'valid'
  | 'invalid'
  | 'warning'
  | 'not_validated'

/**
 * Complete task result - canonical result model
 */
export interface TaskResult {
  taskId: string
  workflowId?: string
  status: string

  // Human-readable summary
  summary: string
  details?: string

  // Structured outputs
  outputs: TaskOutput[]

  // Files/resources created
  artifacts: TaskArtifact[]

  // Workflow step breakdown
  steps?: WorkflowStepResult[]

  // Execution metadata
  provider?: string
  executionMode?: string
  retryCount?: number
  fallbackUsed?: boolean

  // Timing
  durationMs?: number
  queuedAt?: string
  startedAt?: string
  completedAt?: string

  // Validation
  validationStatus?: ValidationStatus
  validationMessage?: string

  // Raw result (for debugging)
  rawResult?: unknown

  createdAt: string
}

/**
 * Input for creating task result
 */
export interface CreateTaskResultInput {
  taskId: string
  workflowId?: string
  status: string
  rawResult?: unknown
  provider?: string
  executionMode?: string
  durationMs?: number
  error?: string
}
