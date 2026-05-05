/**
 * Task System Types
 * FEATURE 080: Task System v1
 */

import type { DebugSnapshot } from '../orchestrator/trace'

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
}
