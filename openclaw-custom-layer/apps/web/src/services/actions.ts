/**
 * Actions Service
 * P6.1: Product Shell Action Wiring & Functional Buttons
 *
 * Canonical action model for all UI actions.
 * Every button click goes through this service.
 */

import { apiFetch, isApiConnectionError, ApiNonJsonError } from './api'

/**
 * Action result - canonical response for all actions
 */
export interface ActionResult<T = unknown> {
  success: boolean
  status: 'queued' | 'executed' | 'failed' | 'requires_approval' | 'not_available'
  message: string
  data?: T
  jobId?: string
  workflowId?: string
  taskId?: string
  notificationId?: string
  error?: string
}

/**
 * Task creation input
 * P6.2: Fixed - backend expects "message" not "input"
 */
export interface CreateTaskInput {
  message: string
  mode?: 'safe' | 'free'
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  channelId?: string
  dryRun?: boolean
  requireApproval?: boolean
}

/**
 * Create a new task
 */
export async function createTask(input: CreateTaskInput): Promise<ActionResult<{ taskId: string; jobId?: string }>> {
  try {
    const response = await apiFetch<{
      success: boolean
      task?: { id: string }
      jobId?: string
      queued?: boolean
      error?: string
    }>('/orchestrator/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: input.message,
        mode: input.mode || 'safe',
        priority: input.priority || 'normal',
        channelId: input.channelId,
        dryRun: input.dryRun,
        requireApproval: input.requireApproval
      })
    })

    if (response.success) {
      return {
        success: true,
        status: response.queued ? 'queued' : 'executed',
        message: response.queued ? 'Tarea encolada' : 'Tarea iniciada',
        data: {
          taskId: response.task?.id || '',
          jobId: response.jobId
        },
        taskId: response.task?.id,
        jobId: response.jobId
      }
    }

    return {
      success: false,
      status: 'failed',
      message: response.error || 'Error al crear tarea',
      error: response.error
    }
  } catch (err) {
    return handleActionError<{ taskId: string; jobId?: string }>(err, 'crear tarea')
  }
}

/**
 * Retry a failed task
 */
export async function retryTask(taskId: string): Promise<ActionResult> {
  try {
    const response = await apiFetch<{ success: boolean; jobId?: string; error?: string }>(
      `/queue/jobs/${taskId}/retry`,
      { method: 'POST' }
    )

    if (response.success) {
      return {
        success: true,
        status: 'queued',
        message: 'Reintento encolado',
        jobId: response.jobId
      }
    }

    return {
      success: false,
      status: 'failed',
      message: response.error || 'Error al reintentar',
      error: response.error
    }
  } catch (err) {
    return handleActionError(err, 'reintentar tarea')
  }
}

/**
 * Cancel a running task
 */
export async function cancelTask(taskId: string): Promise<ActionResult> {
  try {
    const response = await apiFetch<{ success: boolean; error?: string }>(
      `/queue/jobs/${taskId}/cancel`,
      { method: 'POST' }
    )

    if (response.success) {
      return {
        success: true,
        status: 'executed',
        message: 'Tarea cancelada'
      }
    }

    return {
      success: false,
      status: 'failed',
      message: response.error || 'Error al cancelar',
      error: response.error
    }
  } catch (err) {
    return handleActionError(err, 'cancelar tarea')
  }
}

/**
 * Approve a pending approval
 */
export async function approveRequest(approvalId: string): Promise<ActionResult> {
  try {
    const response = await apiFetch<{ success: boolean; error?: string }>(
      `/tool-proposals/${approvalId}/approve`,
      { method: 'POST' }
    )

    if (response.success) {
      return {
        success: true,
        status: 'executed',
        message: 'Aprobado correctamente'
      }
    }

    return {
      success: false,
      status: 'failed',
      message: response.error || 'Error al aprobar',
      error: response.error
    }
  } catch (err) {
    return handleActionError(err, 'aprobar solicitud')
  }
}

/**
 * Deny a pending approval
 */
export async function denyRequest(approvalId: string): Promise<ActionResult> {
  try {
    const response = await apiFetch<{ success: boolean; error?: string }>(
      `/tool-proposals/${approvalId}/reject`,
      { method: 'POST' }
    )

    if (response.success) {
      return {
        success: true,
        status: 'executed',
        message: 'Denegado correctamente'
      }
    }

    return {
      success: false,
      status: 'failed',
      message: response.error || 'Error al denegar',
      error: response.error
    }
  } catch (err) {
    return handleActionError(err, 'denegar solicitud')
  }
}

/**
 * Pause the runtime queue
 */
export async function pauseQueue(): Promise<ActionResult> {
  try {
    const response = await apiFetch<{ success: boolean; error?: string }>(
      '/queue/pause',
      { method: 'POST' }
    )

    if (response.success) {
      return {
        success: true,
        status: 'executed',
        message: 'Cola pausada'
      }
    }

    return {
      success: false,
      status: 'failed',
      message: response.error || 'Error al pausar cola',
      error: response.error
    }
  } catch (err) {
    return handleActionError(err, 'pausar cola')
  }
}

/**
 * Resume the runtime queue
 */
export async function resumeQueue(): Promise<ActionResult> {
  try {
    const response = await apiFetch<{ success: boolean; error?: string }>(
      '/queue/resume',
      { method: 'POST' }
    )

    if (response.success) {
      return {
        success: true,
        status: 'executed',
        message: 'Cola reanudada'
      }
    }

    return {
      success: false,
      status: 'failed',
      message: response.error || 'Error al reanudar cola',
      error: response.error
    }
  } catch (err) {
    return handleActionError(err, 'reanudar cola')
  }
}

/**
 * Requeue a dead-lettered job
 */
export async function requeueDeadLetter(jobId: string): Promise<ActionResult> {
  try {
    const response = await apiFetch<{ success: boolean; newJobId?: string; error?: string }>(
      `/queue/dead-letter/${jobId}/requeue`,
      { method: 'POST' }
    )

    if (response.success) {
      return {
        success: true,
        status: 'queued',
        message: 'Re-encolado correctamente',
        jobId: response.newJobId
      }
    }

    return {
      success: false,
      status: 'failed',
      message: response.error || 'Error al re-encolar',
      error: response.error
    }
  } catch (err) {
    return handleActionError(err, 're-encolar job')
  }
}

/**
 * Clear all dead letters
 */
export async function clearDeadLetters(): Promise<ActionResult> {
  try {
    const response = await apiFetch<{ success: boolean; cleared?: number; error?: string }>(
      '/queue/dead-letter/clear',
      { method: 'POST' }
    )

    if (response.success) {
      return {
        success: true,
        status: 'executed',
        message: `${response.cleared || 0} dead letters eliminados`
      }
    }

    return {
      success: false,
      status: 'failed',
      message: response.error || 'Error al limpiar dead letters',
      error: response.error
    }
  } catch (err) {
    return handleActionError(err, 'limpiar dead letters')
  }
}

/**
 * Test a channel connection
 */
export async function testChannel(channelId: string): Promise<ActionResult<{ healthy: boolean; issues?: string[] }>> {
  try {
    const response = await apiFetch<{ success: boolean; healthy?: boolean; issues?: string[]; error?: string }>(
      `/channels/${channelId}/check`,
      { method: 'POST' }
    )

    if (response.success) {
      return {
        success: true,
        status: 'executed',
        message: response.healthy ? 'Canal saludable' : 'Canal con problemas',
        data: {
          healthy: response.healthy || false,
          issues: response.issues
        }
      }
    }

    return {
      success: false,
      status: 'not_available',
      message: response.error || 'Canal no disponible para test',
      error: response.error
    }
  } catch (err) {
    // For channels, treat 404 as "not available" not "failed"
    if (err instanceof Error && err.message.includes('404')) {
      return {
        success: false,
        status: 'not_available',
        message: 'Test de canal no implementado',
        error: 'Endpoint no disponible'
      }
    }
    return handleActionError<{ healthy: boolean; issues?: string[] }>(err, 'testear canal')
  }
}

/**
 * Toggle automation enabled/disabled
 */
export async function toggleAutomation(automationId: string, enabled: boolean): Promise<ActionResult> {
  const endpoint = enabled ? `/automations/${automationId}/enable` : `/automations/${automationId}/disable`
  try {
    const response = await apiFetch<{ success: boolean; error?: string }>(
      endpoint,
      { method: 'POST' }
    )

    if (response.success) {
      return {
        success: true,
        status: 'executed',
        message: enabled ? 'Automatizacion activada' : 'Automatizacion pausada'
      }
    }

    return {
      success: false,
      status: 'not_available',
      message: response.error || 'Error al cambiar estado',
      error: response.error
    }
  } catch (err) {
    // Automations may not have endpoints yet
    if (err instanceof Error && err.message.includes('404')) {
      return {
        success: false,
        status: 'not_available',
        message: 'Automatizaciones no disponible aun',
        error: 'Endpoint no implementado'
      }
    }
    return handleActionError(err, 'cambiar automatizacion')
  }
}

/**
 * Run automation now (manual trigger)
 */
export async function runAutomationNow(automationId: string): Promise<ActionResult> {
  try {
    const response = await apiFetch<{ success: boolean; jobId?: string; error?: string }>(
      `/automations/${automationId}/run-now`,
      { method: 'POST' }
    )

    if (response.success) {
      return {
        success: true,
        status: 'queued',
        message: 'Ejecucion manual encolada',
        jobId: response.jobId
      }
    }

    return {
      success: false,
      status: 'not_available',
      message: response.error || 'Error al ejecutar',
      error: response.error
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('404')) {
      return {
        success: false,
        status: 'not_available',
        message: 'Ejecucion manual no disponible aun',
        error: 'Endpoint no implementado'
      }
    }
    return handleActionError(err, 'ejecutar automatizacion')
  }
}

/**
 * Common error handler for actions
 */
function handleActionError<T = unknown>(err: unknown, action: string): ActionResult<T> {
  if (err instanceof ApiNonJsonError) {
    return {
      success: false,
      status: 'failed',
      message: `Error al ${action}: respuesta no-JSON`,
      error: err.message
    }
  }

  if (isApiConnectionError(err)) {
    return {
      success: false,
      status: 'failed',
      message: `No se pudo conectar con el servidor para ${action}`,
      error: 'Error de conexion'
    }
  }

  if (err instanceof Error) {
    // Check for 404 errors
    if (err.message.includes('404') || err.message.includes('Not Found')) {
      return {
        success: false,
        status: 'not_available',
        message: `Accion no disponible: ${action}`,
        error: 'Endpoint no implementado'
      }
    }

    return {
      success: false,
      status: 'failed',
      message: `Error al ${action}: ${err.message}`,
      error: err.message
    }
  }

  return {
    success: false,
    status: 'failed',
    message: `Error desconocido al ${action}`,
    error: 'Error desconocido'
  }
}
