/**
 * Runtime Queue Routes
 * PHASE H1: Runtime Hardening & Platform Stabilization
 *
 * API endpoints for queue management, monitoring, and debugging.
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { ok, badRequest, serverError, notFound } from '../../shared/response'
import type { AuthContext } from '../auth'
import { getQueue } from './queue'
import { getSchedulerState, pauseScheduler, resumeScheduler } from './scheduler'
import {
  listDeadLetter,
  getDeadLetterJob,
  requeueJob,
  deleteDeadLetterEntry,
  clearAllDeadLetter,
  getDeadLetterStats,
  analyzeDeadLetter
} from './dead-letter'
import { checkQueueHealth } from './startup-recovery'
import { eventBus, emitQueueEvent } from '../observability'
import type { JobFilter } from './types'

/**
 * GET /queue/stats
 * Get queue statistics
 */
export function handleGetQueueStats(
  _req: IncomingMessage,
  res: ServerResponse,
  _context: AuthContext | null
): void {
  try {
    const queue = getQueue()
    const stats = queue.getStats()
    const scheduler = getSchedulerState()
    const health = checkQueueHealth(queue)

    ok(res, {
      success: true,
      stats,
      scheduler: {
        running: scheduler.running,
        paused: scheduler.paused,
        activeJobs: scheduler.activeJobs.size,
        processedCount: scheduler.processedCount,
        failedCount: scheduler.failedCount,
        lastPollAt: scheduler.lastPollAt
      },
      health
    })
  } catch (err) {
    console.error('[QueueRoutes] Error getting stats:', err)
    serverError(res, 'Error al obtener estadísticas de cola')
  }
}

/**
 * GET /queue/jobs
 * List jobs with optional filtering
 */
export function handleListJobs(
  req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null
): void {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`)
    const params = url.searchParams

    const filter: JobFilter = {}

    if (params.has('status')) {
      filter.status = params.get('status')!.split(',') as JobFilter['status']
    }
    if (params.has('type')) {
      filter.type = params.get('type')!.split(',')
    }
    if (params.has('priority')) {
      filter.priority = params.get('priority')!.split(',') as JobFilter['priority']
    }
    if (context?.tenant?.id) {
      filter.tenantId = context.tenant.id
    }
    if (params.has('limit')) {
      filter.limit = parseInt(params.get('limit')!, 10)
    }
    if (params.has('offset')) {
      filter.offset = parseInt(params.get('offset')!, 10)
    }

    const queue = getQueue()
    const jobs = queue.query(filter)

    ok(res, {
      success: true,
      jobs,
      count: jobs.length,
      filter
    })
  } catch (err) {
    console.error('[QueueRoutes] Error listing jobs:', err)
    serverError(res, 'Error al listar trabajos')
  }
}

/**
 * GET /queue/jobs/:id
 * Get a specific job
 */
export function handleGetJob(
  _req: IncomingMessage,
  res: ServerResponse,
  jobId: string,
  _context: AuthContext | null
): void {
  try {
    const queue = getQueue()
    const job = queue.get(jobId)

    if (!job) {
      notFound(res, 'Trabajo no encontrado')
      return
    }

    // Get related events
    const events = eventBus.getEventsForEntity(jobId, 50)

    ok(res, {
      success: true,
      job,
      events
    })
  } catch (err) {
    console.error('[QueueRoutes] Error getting job:', err)
    serverError(res, 'Error al obtener trabajo')
  }
}

/**
 * POST /queue/jobs/:id/cancel
 * Cancel a job
 */
export function handleCancelJob(
  _req: IncomingMessage,
  res: ServerResponse,
  jobId: string,
  context: AuthContext | null
): void {
  if (!context) {
    badRequest(res, 'Authentication required')
    return
  }

  try {
    const queue = getQueue()
    const job = queue.markCancelled(jobId)

    if (!job) {
      notFound(res, 'Trabajo no encontrado o no cancelable')
      return
    }

    ok(res, {
      success: true,
      message: 'Trabajo cancelado',
      job
    })
  } catch (err) {
    console.error('[QueueRoutes] Error cancelling job:', err)
    serverError(res, 'Error al cancelar trabajo')
  }
}

/**
 * POST /queue/pause
 * Pause the scheduler
 */
export function handlePauseQueue(
  _req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null
): void {
  if (!context) {
    badRequest(res, 'Authentication required')
    return
  }

  try {
    pauseScheduler()

    ok(res, {
      success: true,
      message: 'Cola pausada'
    })
  } catch (err) {
    console.error('[QueueRoutes] Error pausing queue:', err)
    serverError(res, 'Error al pausar cola')
  }
}

/**
 * POST /queue/resume
 * Resume the scheduler
 */
export function handleResumeQueue(
  _req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null
): void {
  if (!context) {
    badRequest(res, 'Authentication required')
    return
  }

  try {
    resumeScheduler()

    ok(res, {
      success: true,
      message: 'Cola reanudada'
    })
  } catch (err) {
    console.error('[QueueRoutes] Error resuming queue:', err)
    serverError(res, 'Error al reanudar cola')
  }
}

/**
 * GET /queue/dead-letter
 * List dead letter entries
 */
export function handleListDeadLetter(
  req: IncomingMessage,
  res: ServerResponse,
  _context: AuthContext | null
): void {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`)
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)
    const offset = parseInt(url.searchParams.get('offset') || '0', 10)

    const entries = listDeadLetter(limit, offset)
    const stats = getDeadLetterStats()
    const analysis = analyzeDeadLetter()

    ok(res, {
      success: true,
      entries,
      count: entries.length,
      stats,
      analysis
    })
  } catch (err) {
    console.error('[QueueRoutes] Error listing dead letter:', err)
    serverError(res, 'Error al listar dead letter')
  }
}

/**
 * POST /queue/dead-letter/:id/requeue
 * Requeue a dead letter entry
 */
export function handleRequeueDeadLetter(
  req: IncomingMessage,
  res: ServerResponse,
  jobId: string,
  context: AuthContext | null
): void {
  if (!context) {
    badRequest(res, 'Authentication required')
    return
  }

  let body = ''

  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', () => {
    try {
      const data = body ? JSON.parse(body) : {}
      const queue = getQueue()

      const newJob = requeueJob(queue, jobId, {
        resetRetryCount: data.resetRetryCount,
        priority: data.priority,
        payload: data.payload
      })

      if (!newJob) {
        notFound(res, 'Entrada no encontrada en dead letter')
        return
      }

      ok(res, {
        success: true,
        message: 'Trabajo reencolado',
        newJobId: newJob.id
      })
    } catch (err) {
      console.error('[QueueRoutes] Error requeuing:', err)
      serverError(res, 'Error al reencolar trabajo')
    }
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}

/**
 * DELETE /queue/dead-letter/:id
 * Delete a dead letter entry
 */
export function handleDeleteDeadLetter(
  _req: IncomingMessage,
  res: ServerResponse,
  jobId: string,
  context: AuthContext | null
): void {
  if (!context) {
    badRequest(res, 'Authentication required')
    return
  }

  try {
    const deleted = deleteDeadLetterEntry(jobId)

    if (!deleted) {
      notFound(res, 'Entrada no encontrada')
      return
    }

    ok(res, {
      success: true,
      message: 'Entrada eliminada'
    })
  } catch (err) {
    console.error('[QueueRoutes] Error deleting dead letter:', err)
    serverError(res, 'Error al eliminar entrada')
  }
}

/**
 * POST /queue/dead-letter/clear
 * Clear all dead letter entries
 */
export function handleClearDeadLetter(
  req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null
): void {
  if (!context) {
    badRequest(res, 'Authentication required')
    return
  }

  let body = ''

  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', () => {
    try {
      const data = body ? JSON.parse(body) : {}

      if (data.confirm !== 'CLEAR_ALL') {
        badRequest(res, 'Se requiere confirmación: { "confirm": "CLEAR_ALL" }')
        return
      }

      const count = clearAllDeadLetter()

      ok(res, {
        success: true,
        message: `${count} entradas eliminadas`
      })
    } catch (err) {
      console.error('[QueueRoutes] Error clearing dead letter:', err)
      serverError(res, 'Error al limpiar dead letter')
    }
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}

/**
 * GET /queue/events
 * Get event history
 */
export function handleGetEvents(
  req: IncomingMessage,
  res: ServerResponse,
  _context: AuthContext | null
): void {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`)
    const params = url.searchParams

    const limit = parseInt(params.get('limit') || '100', 10)
    const category = params.get('category')
    const entityId = params.get('entityId')

    let events
    if (entityId) {
      events = eventBus.getEventsForEntity(entityId, limit)
    } else if (category) {
      events = eventBus.getHistory({ categories: [category as any] }, limit)
    } else {
      events = eventBus.getHistory({}, limit)
    }

    const stats = eventBus.getStats()

    ok(res, {
      success: true,
      events,
      count: events.length,
      stats
    })
  } catch (err) {
    console.error('[QueueRoutes] Error getting events:', err)
    serverError(res, 'Error al obtener eventos')
  }
}

/**
 * GET /queue/events/:correlationId
 * Get events by correlation ID (for replay/debugging)
 */
export function handleGetEventsByCorrelation(
  _req: IncomingMessage,
  res: ServerResponse,
  correlationId: string,
  _context: AuthContext | null
): void {
  try {
    const events = eventBus.getEventsByCorrelationId(correlationId)

    ok(res, {
      success: true,
      correlationId,
      events,
      count: events.length,
      timeline: events.map(e => ({
        timestamp: e.timestamp,
        type: e.type,
        category: e.category,
        message: e.message
      }))
    })
  } catch (err) {
    console.error('[QueueRoutes] Error getting events by correlation:', err)
    serverError(res, 'Error al obtener eventos')
  }
}

/**
 * GET /queue/health
 * Health check endpoint
 */
export function handleQueueHealth(
  _req: IncomingMessage,
  res: ServerResponse,
  _context: AuthContext | null
): void {
  try {
    const queue = getQueue()
    const health = checkQueueHealth(queue)
    const scheduler = getSchedulerState()

    const status = health.healthy && scheduler.running && !scheduler.paused
      ? 200
      : 503

    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      success: health.healthy,
      status: status === 200 ? 'healthy' : 'unhealthy',
      health,
      scheduler: {
        running: scheduler.running,
        paused: scheduler.paused
      }
    }))
  } catch (err) {
    console.error('[QueueRoutes] Error checking health:', err)
    serverError(res, 'Error al verificar salud')
  }
}

/**
 * P6.12: POST /queue/jobs/:id/retry
 * Retry a queue job
 *
 * If jobId looks like a taskId (starts with "task-"), suggests using /tasks/:id/retry instead.
 */
export function handleRetryJob(
  req: IncomingMessage,
  res: ServerResponse,
  jobId: string,
  context: AuthContext | null
): void {
  if (!context) {
    badRequest(res, 'Authentication required')
    return
  }

  // P6.12: Check if jobId is actually a taskId
  if (jobId.startsWith('task-')) {
    // Return helpful error with suggested endpoint
    ok(res, {
      success: false,
      error: 'El ID proporcionado es un taskId, no un jobId',
      suggestion: {
        message: 'Use /tasks/:id/retry para reintentar tareas',
        endpoint: `/tasks/${jobId}/retry`,
        method: 'POST'
      },
      taskId: jobId
    })
    return
  }

  let body = ''

  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', () => {
    try {
      const options = body ? JSON.parse(body) : {}
      const queue = getQueue()

      // Find original job
      const originalJob = queue.get(jobId)

      if (!originalJob) {
        // Check dead letter
        const deadLetterJob = getDeadLetterJob(jobId)
        if (deadLetterJob) {
          // Suggest using requeue endpoint
          ok(res, {
            success: false,
            error: 'El trabajo está en dead-letter',
            suggestion: {
              message: 'Use /queue/dead-letter/:id/requeue para reencolar',
              endpoint: `/queue/dead-letter/${jobId}/requeue`,
              method: 'POST'
            }
          })
          return
        }

        notFound(res, 'Trabajo no encontrado')
        return
      }

      // Check if job can be retried
      if (originalJob.status === 'pending' || originalJob.status === 'running') {
        badRequest(res, `El trabajo no puede reintentarse (estado: ${originalJob.status})`)
        return
      }

      // Clone payload safely
      const payload = JSON.parse(JSON.stringify(originalJob.payload))

      // Create retry job
      const retryJob = queue.enqueue(
        originalJob.type,
        {
          ...payload,
          retryOfJobId: originalJob.id
        },
        originalJob.context,
        {
          priority: options.priority || originalJob.priority,
          tags: [...(originalJob.tags || []), 'retry', `retry-of-${originalJob.id}`]
        }
      )

      // Emit event
      emitQueueEvent('job:retried', 'Queue job retried', {
        originalJobId: originalJob.id,
        retryJobId: retryJob.id,
        type: originalJob.type,
        tenantId: originalJob.context.tenantId
      })

      ok(res, {
        success: true,
        message: 'Trabajo reencolado',
        retryJobId: retryJob.id,
        originalJobId: originalJob.id,
        type: originalJob.type,
        status: 'queued',
        // P6.12: Include taskId if available
        taskId: payload.taskId
      })
    } catch (err) {
      console.error('[QueueRoutes] Error retrying job:', err)
      serverError(res, 'Error al reintentar trabajo')
    }
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}
