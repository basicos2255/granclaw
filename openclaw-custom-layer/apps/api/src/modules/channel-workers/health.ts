/**
 * Worker Health Aggregation
 * P5: Durable Operational Workers & Real Connectors
 *
 * Aggregates health status across all workers.
 */

import type { WorkerStatus, WorkerHealth } from './types'
import { getAllWorkers, getWorker } from './worker-registry'

/**
 * Calculate health score from WorkerHealth
 */
function calculateHealthScore(health: WorkerHealth, status: WorkerStatus): number {
  if (!health.healthy) return 0
  if (status === 'failed') return 0
  if (status === 'degraded') return 50 - (health.consecutiveFailures * 10)
  if (status === 'reconnecting') return 60
  // Running and healthy
  const failurePenalty = health.consecutiveFailures * 5
  return Math.max(0, 100 - failurePenalty)
}

/**
 * System-wide health status
 */
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  totalWorkers: number
  runningWorkers: number
  degradedWorkers: number
  failedWorkers: number
  stoppedWorkers: number
  averageHealthScore: number
  oldestWorker?: string
  newestWorker?: string
  timestamp: string
}

/**
 * Worker health summary
 */
export interface WorkerHealthSummary {
  workerId: string
  channelType: string
  channelId: string
  status: WorkerStatus
  health: WorkerHealth
  uptime: number
  reconnectCount: number
  queuePressure: number
  lastActivity: string
}

/**
 * Get system-wide health status
 */
export function getSystemHealth(): SystemHealth {
  const workers = getAllWorkers()

  let running = 0
  let degraded = 0
  let failed = 0
  let stopped = 0
  let totalScore = 0
  let oldest: { id: string; time: number } | null = null
  let newest: { id: string; time: number } | null = null

  for (const entry of workers) {
    const { worker } = entry
    const startTime = new Date(worker.startedAt).getTime()

    // Count by status
    switch (worker.status) {
      case 'running':
        running++
        break
      case 'degraded':
      case 'reconnecting':
        degraded++
        break
      case 'failed':
        failed++
        break
      case 'stopped':
      case 'starting':
        stopped++
        break
    }

    // Aggregate health score
    totalScore += calculateHealthScore(worker.health, worker.status)

    // Track oldest/newest
    if (!oldest || startTime < oldest.time) {
      oldest = { id: worker.id, time: startTime }
    }
    if (!newest || startTime > newest.time) {
      newest = { id: worker.id, time: startTime }
    }
  }

  // Determine overall status
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  if (failed > 0 || (degraded > running && workers.length > 0)) {
    status = 'unhealthy'
  } else if (degraded > 0) {
    status = 'degraded'
  }

  return {
    status,
    totalWorkers: workers.length,
    runningWorkers: running,
    degradedWorkers: degraded,
    failedWorkers: failed,
    stoppedWorkers: stopped,
    averageHealthScore: workers.length > 0 ? totalScore / workers.length : 100,
    oldestWorker: oldest?.id,
    newestWorker: newest?.id,
    timestamp: new Date().toISOString()
  }
}

/**
 * Get health summary for all workers
 */
export function getAllWorkerHealth(): WorkerHealthSummary[] {
  const workers = getAllWorkers()

  return workers.map(entry => {
    const { worker } = entry
    const startTime = new Date(worker.startedAt).getTime()
    const uptime = Date.now() - startTime

    return {
      workerId: worker.id,
      channelType: worker.channelType,
      channelId: worker.channelId,
      status: worker.status,
      health: worker.health,
      uptime,
      reconnectCount: worker.reconnectCount,
      queuePressure: worker.queuePressure,
      lastActivity: worker.lastActivityAt
    }
  })
}

/**
 * Get health for specific worker
 */
export function getWorkerHealth(workerId: string): WorkerHealthSummary | null {
  const entry = getWorker(workerId)
  if (!entry) return null

  const { worker } = entry
  const startTime = new Date(worker.startedAt).getTime()
  const uptime = Date.now() - startTime

  return {
    workerId: worker.id,
    channelType: worker.channelType,
    channelId: worker.channelId,
    status: worker.status,
    health: worker.health,
    uptime,
    reconnectCount: worker.reconnectCount,
    queuePressure: worker.queuePressure,
    lastActivity: worker.lastActivityAt
  }
}

/**
 * Get workers by health status
 */
export function getWorkersByHealth(
  filter: 'healthy' | 'degraded' | 'unhealthy'
): WorkerHealthSummary[] {
  const all = getAllWorkerHealth()

  return all.filter(w => {
    const score = calculateHealthScore(w.health, w.status)
    if (filter === 'healthy') {
      return w.status === 'running' && score >= 80
    }
    if (filter === 'degraded') {
      return w.status === 'degraded' || w.status === 'reconnecting' ||
        (w.status === 'running' && score < 80)
    }
    return w.status === 'failed'
  })
}

/**
 * Get workers that need attention
 */
export function getWorkersNeedingAttention(): WorkerHealthSummary[] {
  const all = getAllWorkerHealth()

  return all.filter(w => {
    const score = calculateHealthScore(w.health, w.status)
    return (
      w.status === 'failed' ||
      w.status === 'degraded' ||
      score < 50 ||
      w.reconnectCount > 5 ||
      w.queuePressure > 0.8
    )
  })
}

/**
 * Check if system is healthy enough for operations
 */
export function isSystemOperational(): boolean {
  const health = getSystemHealth()
  return health.status !== 'unhealthy' && health.runningWorkers > 0
}

/**
 * Get health metrics for monitoring
 */
export function getHealthMetrics(): {
  gauges: Record<string, number>
  counters: Record<string, number>
} {
  const health = getSystemHealth()

  return {
    gauges: {
      'workers.total': health.totalWorkers,
      'workers.running': health.runningWorkers,
      'workers.degraded': health.degradedWorkers,
      'workers.failed': health.failedWorkers,
      'workers.stopped': health.stoppedWorkers,
      'health.score': health.averageHealthScore,
      'health.operational': isSystemOperational() ? 1 : 0
    },
    counters: {}
  }
}
