/**
 * Tipos del módulo orchestrator
 */

export interface RunTaskInput {
  message: string
  agentId?: string
  sessionId?: string
  tenantId?: string
}

export type TaskSource = 'mock' | 'openclaw' | 'tool' | 'guard' // P6.9: Added 'guard' for multistep guard rejections

export interface RunTaskResult {
  success: boolean
  result: unknown
  source: TaskSource
  agentId?: string
  presetId?: string
  sessionId?: string
  systemPrompt?: string
  toolId?: string
  error?: string
}

/**
 * Input para ACK task (antes llamado streaming)
 * NOTA: chat.send devuelve ACK, streaming real pendiente
 */
export interface StreamTaskInput {
  message: string
  agentId?: string
  sessionId?: string
  tenantId?: string
}

/**
 * Modo de ejecución
 * - ack: chat.send devuelve ACK, respuesta via eventos pendiente
 * - fallback: REST/mock cuando WS no disponible
 * - tool: ejecución de tool
 */
export type StreamMode = 'ack' | 'fallback' | 'tool'

/**
 * Resultado de ACK task
 * NOTA: streaming real pendiente de implementar
 */
export interface StreamTaskResult {
  success: boolean
  mode: StreamMode
  result: unknown
  sessionId?: string
  toolId?: string
  error?: string
}

/**
 * FIX 126: Timeout Recovery Types
 */

/**
 * Recovery type for different failure scenarios
 */
export type RecoveryType = 'timeout_recovery' | 'retry' | 'skip' | 'none'

/**
 * Task step for multistep execution
 */
export interface TaskStepInfo {
  id: string
  order: number
  description: string
  input: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  result?: unknown
  error?: string
  dependsOnPrevious: boolean
  estimatedDuration: 'quick' | 'medium' | 'long'
}

/**
 * Timeout recovery info returned when task times out
 */
export interface TimeoutRecoveryResult {
  /** Recovery type */
  recoveryType: RecoveryType
  /** Original input that timed out */
  originalInput: string
  /** Whether task is splittable into steps */
  isSplittable: boolean
  /** Suggested steps for recovery */
  steps: TaskStepInfo[]
  /** Reason for classification */
  reason: string
  /** Original error */
  originalError?: string
  /** Timestamp of timeout */
  timeoutAt: string
}

/**
 * Extended result with recovery info
 */
export interface RunTaskResultWithRecovery extends RunTaskResult {
  /** FIX 126: Recovery info if timeout occurred */
  recovery?: TimeoutRecoveryResult
}

/**
 * Input for step execution
 */
export interface ExecuteStepsInput {
  /** Task ID */
  taskId: string
  /** Steps to execute */
  steps: TaskStepInfo[]
  /** Starting step ID (optional, defaults to first pending) */
  startFromStepId?: string
  /** Tenant context */
  tenantId: string
  /** User context */
  userId?: string
  /** Session ID */
  sessionId?: string
}

/**
 * Result of step execution
 */
export interface ExecuteStepsResult {
  success: boolean
  /** Completed steps */
  completedSteps: string[]
  /** Failed step ID (if any) */
  failedStepId?: string
  /** Current step status */
  stepResults: Record<string, {
    status: 'completed' | 'failed' | 'skipped'
    result?: unknown
    error?: string
  }>
  /** Overall task completed */
  taskCompleted: boolean
  /** Error message */
  error?: string
}
