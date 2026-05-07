/**
 * Channel Workers Routes
 * P5: Durable Operational Workers & Real Connectors
 *
 * HTTP endpoints for worker management and health.
 */

import type { ChannelType } from '../channels-runtime/types'
import {
  getSystemHealth,
  getAllWorkerHealth,
  getWorkerHealth,
  getWorkersNeedingAttention,
  isSystemOperational,
  getHealthMetrics
} from './health'
import {
  getManagerStatus,
  listWorkers,
  findWorker,
  createWorker,
  destroyWorker,
  rebootWorker
} from './worker-manager'
import type { WorkerCredentials } from './types'

/**
 * Request/Response types for API
 */
export interface WorkerCreateRequest {
  channelType: ChannelType
  channelId: string
  tenantId: string
  credentials: WorkerCredentials
  options?: {
    reconnectDelayMs?: number
    maxReconnectAttempts?: number
    heartbeatIntervalMs?: number
    healthCheckIntervalMs?: number
    persistStateIntervalMs?: number
  }
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  timestamp: string
}

/**
 * GET /api/workers/health
 * System-wide health status
 */
export function handleGetSystemHealth(): ApiResponse<ReturnType<typeof getSystemHealth>> {
  try {
    const health = getSystemHealth()
    return {
      success: true,
      data: health,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * GET /api/workers/health/all
 * All workers health status
 */
export function handleGetAllWorkersHealth(): ApiResponse<ReturnType<typeof getAllWorkerHealth>> {
  try {
    const health = getAllWorkerHealth()
    return {
      success: true,
      data: health,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * GET /api/workers/health/:workerId
 * Single worker health status
 */
export function handleGetWorkerHealth(
  workerId: string
): ApiResponse<ReturnType<typeof getWorkerHealth>> {
  try {
    const health = getWorkerHealth(workerId)
    if (!health) {
      return {
        success: false,
        error: 'Worker not found',
        timestamp: new Date().toISOString()
      }
    }
    return {
      success: true,
      data: health,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * GET /api/workers/health/attention
 * Workers needing attention
 */
export function handleGetWorkersNeedingAttention(): ApiResponse<ReturnType<typeof getWorkersNeedingAttention>> {
  try {
    const workers = getWorkersNeedingAttention()
    return {
      success: true,
      data: workers,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * GET /api/workers/operational
 * Check if system is operational
 */
export function handleCheckOperational(): ApiResponse<{ operational: boolean }> {
  try {
    const operational = isSystemOperational()
    return {
      success: true,
      data: { operational },
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * GET /api/workers/metrics
 * Health metrics for monitoring
 */
export function handleGetMetrics(): ApiResponse<ReturnType<typeof getHealthMetrics>> {
  try {
    const metrics = getHealthMetrics()
    return {
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * GET /api/workers/status
 * Manager status
 */
export function handleGetManagerStatus(): ApiResponse<ReturnType<typeof getManagerStatus>> {
  try {
    const status = getManagerStatus()
    return {
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * GET /api/workers
 * List all workers
 */
export function handleListWorkers(filters?: {
  channelType?: ChannelType
  tenantId?: string
  status?: string
}): ApiResponse<ReturnType<typeof listWorkers>> {
  try {
    const workers = listWorkers(filters as Parameters<typeof listWorkers>[0])
    return {
      success: true,
      data: workers,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * GET /api/workers/:workerId
 * Get single worker
 */
export function handleGetWorker(
  workerId: string
): ApiResponse<ReturnType<typeof findWorker>> {
  try {
    const worker = findWorker(workerId)
    if (!worker) {
      return {
        success: false,
        error: 'Worker not found',
        timestamp: new Date().toISOString()
      }
    }
    return {
      success: true,
      data: worker,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * POST /api/workers
 * Create new worker
 */
export async function handleCreateWorker(
  request: WorkerCreateRequest
): Promise<ApiResponse<Awaited<ReturnType<typeof createWorker>>>> {
  try {
    const worker = await createWorker(
      request.channelType,
      request.channelId,
      request.tenantId,
      request.credentials,
      request.options
    )

    if (!worker) {
      return {
        success: false,
        error: 'Failed to create worker',
        timestamp: new Date().toISOString()
      }
    }

    return {
      success: true,
      data: worker,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * DELETE /api/workers/:workerId
 * Stop and remove worker
 */
export async function handleDeleteWorker(
  workerId: string
): Promise<ApiResponse<{ deleted: boolean }>> {
  try {
    const deleted = await destroyWorker(workerId)
    return {
      success: true,
      data: { deleted },
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * POST /api/workers/:workerId/restart
 * Restart worker
 */
export async function handleRestartWorker(
  workerId: string,
  newCredentials?: WorkerCredentials
): Promise<ApiResponse<Awaited<ReturnType<typeof rebootWorker>>>> {
  try {
    const worker = await rebootWorker(workerId, newCredentials)

    if (!worker) {
      return {
        success: false,
        error: 'Failed to restart worker',
        timestamp: new Date().toISOString()
      }
    }

    return {
      success: true,
      data: worker,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }
  }
}
