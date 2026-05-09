/**
 * Task System Types
 * FEATURE 080: Task System v1
 * P6.3: Added structured result support
 */

import type { DebugSnapshot } from '../orchestrator/trace'
import type { TaskOutput, TaskArtifact } from '../task-results/types'

/**
 * Estado de una tarea
 */
export type TaskStatus = 'pending' | 'running' | 'success' | 'blocked' | 'error' | 'unconfirmed'

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
}
