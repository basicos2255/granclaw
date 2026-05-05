/**
 * Task Service
 * FEATURE 080: Task System v1
 * Persistencia de tareas en JSON
 */

import { read, write, getById, update as dbUpdate } from '../../storage/file-db'
import type { GranClawTask, CreateTaskInput, UpdateTaskInput, TaskStatus } from './types'

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
  return updateTask(id, {
    status,
    result,
    source,
    executionTrace,
    debugSnapshot,
    executionDurationMs,
    reason,
    error
  })
}

/**
 * Obtiene las últimas N tareas de un tenant
 */
export function getRecentTasks(tenantId: string, limit: number = 50): GranClawTask[] {
  const tasks = listTasks(tenantId)
  return tasks.slice(0, limit)
}
