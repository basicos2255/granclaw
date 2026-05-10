/**
 * Task Service
 * FEATURE 080: Task System v1
 * P6.3: Added structured result capture
 * P6.7: Execution Evidence & Artifact Validation
 * Persistencia de tareas en JSON
 */

import { read, write, getById, update as dbUpdate } from '../../storage/file-db'
import type { GranClawTask, CreateTaskInput, UpdateTaskInput, TaskStatus, HumanTaskStatus } from './types'
import type { ExecutionEvidence, TaskActionType } from '../task-memory/types'
import { validateExecutionEvidence } from '../task-memory/types'
import { formatTaskResult, saveTaskResult } from '../task-results'

const ENTITY = 'tasks'

/**
 * Genera ID único para tarea
 */
function generateTaskId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `task-${timestamp}-${random}`
}

/**
 * Lista todas las tareas (opcionalmente filtrado por tenant)
 */
export function listTasks(tenantId?: string): GranClawTask[] {
  const tasks = read<GranClawTask>(ENTITY)
  if (tenantId) {
    return tasks.filter(t => t.tenantId === tenantId).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }
  return tasks.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

/**
 * Obtiene una tarea por ID
 */
export function getTask(id: string): GranClawTask | null {
  return getById<GranClawTask>(ENTITY, id)
}

/**
 * Crea una nueva tarea
 */
export function createTask(input: CreateTaskInput): GranClawTask {
  const now = new Date().toISOString()
  const task: GranClawTask = {
    id: generateTaskId(),
    status: 'running',
    tenantId: input.tenantId,
    userId: input.userId,
    requestId: input.requestId,
    input: input.input,
    createdAt: now,
    updatedAt: now
  }

  const tasks = read<GranClawTask>(ENTITY)
  tasks.push(task)
  write(ENTITY, tasks)

  return task
}

/**
 * Actualiza una tarea existente
 */
export function updateTask(id: string, updates: UpdateTaskInput): GranClawTask | null {
  const task = getById<GranClawTask>(ENTITY, id)
  if (!task) {
    return null
  }

  const updated: GranClawTask = {
    ...task,
    ...updates,
    updatedAt: new Date().toISOString()
  }

  return dbUpdate<GranClawTask>(ENTITY, id, updated)
}

/**
 * Actualiza el estado de una tarea
 */
export function setTaskStatus(id: string, status: TaskStatus): GranClawTask | null {
  return updateTask(id, { status })
}

/**
 * Completa una tarea con resultado
 * P6.3: Also generates and saves structured TaskResult
 */
export function completeTask(
  id: string,
  status: TaskStatus,
  result?: unknown,
  source?: string,
  executionTrace?: GranClawTask['executionTrace'],
  debugSnapshot?: GranClawTask['debugSnapshot'],
  executionDurationMs?: number,
  reason?: string,
  error?: string
): GranClawTask | null {
  // P6.3: Generate structured result
  const taskResult = formatTaskResult({
    taskId: id,
    status,
    rawResult: result,
    provider: source,
    durationMs: executionDurationMs,
    error
  })

  // Save structured result
  saveTaskResult(taskResult)

  // Update task with structured fields
  return updateTask(id, {
    status,
    result,
    source,
    executionTrace,
    debugSnapshot,
    executionDurationMs,
    reason,
    error,
    // P6.3: Include structured result fields in task
    summary: taskResult.summary,
    outputs: taskResult.outputs,
    artifacts: taskResult.artifacts,
    provider: taskResult.provider
  })
}

/**
 * Obtiene las últimas N tareas de un tenant
 */
export function getRecentTasks(tenantId: string, limit: number = 50): GranClawTask[] {
  const tasks = listTasks(tenantId)
  return tasks.slice(0, limit)
}

// ============================================================================
// P6.7: EXECUTION EVIDENCE FUNCTIONS
// ============================================================================

/**
 * P6.7: Input for completing a task with evidence
 */
export interface CompleteTaskWithEvidenceInput {
  taskId: string
  actionType: TaskActionType
  evidence: ExecutionEvidence
  result?: unknown
  source?: string
  executionTrace?: GranClawTask['executionTrace']
  debugSnapshot?: GranClawTask['debugSnapshot']
  reason?: string
  usedPattern?: boolean
  patternId?: string
}

/**
 * P6.7: Result of completing task with evidence
 */
export interface CompleteTaskWithEvidenceResult {
  success: boolean
  task?: GranClawTask
  status: TaskStatus
  humanStatus: HumanTaskStatus
  evidenceValid: boolean
  missingEvidence: string[]
  warnings: string[]
  error?: string
}

/**
 * P6.7: Complete a task WITH execution evidence validation
 *
 * This function enforces the execution guarantee rule:
 * - A task can ONLY be marked 'success' if evidence is valid
 * - Missing artifacts/outputs = appropriate failure state
 * - Pattern reuse is tracked but doesn't bypass evidence check
 */
export function completeTaskWithEvidence(
  input: CompleteTaskWithEvidenceInput
): CompleteTaskWithEvidenceResult {
  const {
    taskId,
    actionType,
    evidence,
    result,
    source,
    executionTrace,
    debugSnapshot,
    reason,
    usedPattern,
    patternId
  } = input

  // Validate evidence
  const validation = validateExecutionEvidence({
    evidence,
    actionType
  })

  // Determine status based on evidence
  let status: TaskStatus
  let humanStatus: HumanTaskStatus

  if (validation.canMarkSuccess) {
    status = 'success'
    humanStatus = 'completed'
  } else if (validation.suggestedState === 'needs_artifacts') {
    status = 'blocked'  // Waiting for artifacts
    humanStatus = 'needs_artifacts'
  } else if (validation.suggestedState === 'needs_outputs') {
    status = 'blocked'  // Waiting for outputs
    humanStatus = 'needs_outputs'
  } else {
    status = 'error'
    humanStatus = 'failed'
  }

  // Generate structured result
  const taskResult = formatTaskResult({
    taskId,
    status,
    rawResult: result,
    provider: source,
    durationMs: evidence.durationMs,
    error: evidence.error
  })

  // Save structured result
  saveTaskResult(taskResult)

  // Update task with evidence
  const updatedTask = updateTask(taskId, {
    status,
    result,
    source,
    executionTrace,
    debugSnapshot,
    executionDurationMs: evidence.durationMs,
    reason: validation.canMarkSuccess ? reason : validation.missingEvidence.join(', '),
    error: evidence.error,
    // P6.3 fields
    summary: taskResult.summary,
    outputs: taskResult.outputs,
    artifacts: taskResult.artifacts,
    provider: taskResult.provider,
    // P6.7 fields
    humanStatus,
    executionEvidence: evidence,
    usedPattern,
    patternId,
    evidenceValidated: true
  })

  if (!updatedTask) {
    return {
      success: false,
      status: 'error',
      humanStatus: 'failed',
      evidenceValid: false,
      missingEvidence: ['Task not found'],
      warnings: [],
      error: `Task ${taskId} not found`
    }
  }

  console.log(`[TaskService] P6.7: Task ${taskId} completed with evidence. Status=${status}, HumanStatus=${humanStatus}, EvidenceValid=${validation.valid}`)

  if (!validation.valid) {
    console.log(`[TaskService] P6.7: Missing evidence: ${validation.missingEvidence.join(', ')}`)
  }

  return {
    success: validation.canMarkSuccess,
    task: updatedTask,
    status,
    humanStatus,
    evidenceValid: validation.valid,
    missingEvidence: validation.missingEvidence,
    warnings: validation.warnings
  }
}

/**
 * P6.7: Set task to a semantic state
 */
export function setTaskHumanStatus(
  taskId: string,
  humanStatus: HumanTaskStatus,
  reason?: string
): GranClawTask | null {
  // Map humanStatus to technical status
  let status: TaskStatus
  switch (humanStatus) {
    case 'completed':
      status = 'success'
      break
    case 'failed':
    case 'needs_artifacts':
    case 'needs_outputs':
      status = 'error'
      break
    case 'cancelled':
    case 'paused':
      status = 'blocked'
      break
    case 'waiting_approval':
    case 'waiting_input':
      status = 'unconfirmed'
      break
    default:
      status = 'running'
  }

  return updateTask(taskId, {
    status,
    humanStatus,
    reason
  })
}

/**
 * P6.7: Create execution evidence from execution context
 */
export function createExecutionEvidence(params: {
  provider: ExecutionEvidence['provider']
  startedAt: string
  workerId?: string
  actionsExecuted?: number
  outputs?: unknown[]
  artifacts?: unknown[]
  error?: string
  externalRef?: string
}): ExecutionEvidence {
  const now = new Date().toISOString()
  const startTime = new Date(params.startedAt).getTime()
  const endTime = Date.now()

  return {
    executionId: `exec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    provider: params.provider,
    workerId: params.workerId,
    startedAt: params.startedAt,
    completedAt: now,
    actionsExecuted: params.actionsExecuted ?? 0,
    outputsGenerated: (params.outputs?.length ?? 0) > 0,
    outputCount: params.outputs?.length ?? 0,
    artifactsGenerated: (params.artifacts?.length ?? 0) > 0,
    artifactCount: params.artifacts?.length ?? 0,
    durationMs: endTime - startTime,
    externalRef: params.externalRef,
    error: params.error,
    validationStatus: 'pending'
  }
}
