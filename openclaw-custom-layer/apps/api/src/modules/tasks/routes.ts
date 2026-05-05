/**
 * Tasks Routes
 * FEATURE 080: Task System v1
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { ok, unauthorized, notFound } from '../../shared/response'
import type { AuthContext } from '../auth'
import { listTasks, getTask } from './service'

/**
 * GET /tasks - Lista tareas del tenant
 */
export function handleGetTasks(_req: IncomingMessage, res: ServerResponse, context: AuthContext | null): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const tasks = listTasks(context.tenant.id)
  ok(res, tasks)
}

/**
 * GET /tasks/:id - Obtiene una tarea por ID
 * Signature compatible con DynamicRouteHandler: (req, res, param, context)
 */
export function handleGetTaskById(_req: IncomingMessage, res: ServerResponse, taskId: string, context: AuthContext | null): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const task = getTask(taskId)

  if (!task) {
    notFound(res, 'Task not found')
    return
  }

  // Verificar que la tarea pertenece al tenant
  if (task.tenantId !== context.tenant.id) {
    notFound(res, 'Task not found')
    return
  }

  ok(res, task)
}
