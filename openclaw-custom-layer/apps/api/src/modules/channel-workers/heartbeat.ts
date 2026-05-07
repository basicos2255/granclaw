/**
 * Heartbeat Service
 * P5: Durable Operational Workers & Real Connectors
 *
 * Monitors worker health via periodic heartbeats.
 */

import type { HealthCheckResult, WorkerStatus } from './types'
import {
  getAllWorkers,
  updateWorkerStatus,
  recordHeartbeat,
  recordFailure
} from './worker-registry'
import { eventBus } from '../event-bus'

/**
 * Heartbeat configuration
 */
interface HeartbeatConfig {
  intervalMs: number
  timeoutMs: number
  maxConsecutiveFailures: number
  degradedThreshold: number
}

const DEFAULT_CONFIG: HeartbeatConfig = {
  intervalMs: 30000,      // 30 seconds
  timeoutMs: 10000,       // 10 seconds
  maxConsecutiveFailures: 5,
  degradedThreshold: 2
}

let heartbeatInterval: ReturnType<typeof setInterval> | null = null
let config: HeartbeatConfig = DEFAULT_CONFIG

/**
 * Check single worker health
 */
async function checkWorkerHealth(workerId: string): Promise<HealthCheckResult> {
  const startTime = Date.now()
  const entry = getAllWorkers().find(e => e.worker.id === workerId)

  if (!entry) {
    return {
      workerId,
      healthy: false,
      latencyMs: 0,
      error: 'Worker not found',
      checkedAt: new Date().toISOString()
    }
  }

  try {
    // Create timeout promise
    const timeoutPromise = new Promise<boolean>((_, reject) => {
      setTimeout(() => reject(new Error('Heartbeat timeout')), config.timeoutMs)
    })

    // Race heartbeat against timeout
    const healthy = await Promise.race([
      entry.handler.heartbeat(),
      timeoutPromise
    ])

    const latencyMs = Date.now() - startTime

    if (healthy) {
      recordHeartbeat(workerId)

      // Recover from degraded if now healthy
      if (entry.worker.status === 'degraded') {
        updateWorkerStatus(workerId, 'running')
        emitWorkerEvent('worker:recovered', workerId)
      }
    }

    return {
      workerId,
      healthy,
      latencyMs,
      checkedAt: new Date().toISOString()
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'

    recordFailure(workerId, errorMsg)

    // Check failure threshold
    const failures = entry.worker.health.consecutiveFailures

    if (failures >= config.maxConsecutiveFailures) {
      if (entry.worker.status !== 'failed') {
        updateWorkerStatus(workerId, 'failed', errorMsg)
        emitWorkerEvent('worker:failed', workerId, errorMsg)
      }
    } else if (failures >= config.degradedThreshold) {
      if (entry.worker.status !== 'degraded' && entry.worker.status !== 'failed') {
        updateWorkerStatus(workerId, 'degraded', errorMsg)
        emitWorkerEvent('worker:degraded', workerId, errorMsg)
      }
    }

    return {
      workerId,
      healthy: false,
      latencyMs,
      error: errorMsg,
      checkedAt: new Date().toISOString()
    }
  }
}

/**
 * Check all workers health
 */
async function checkAllWorkersHealth(): Promise<HealthCheckResult[]> {
  const workers = getAllWorkers()
  const results: HealthCheckResult[] = []

  // Check workers that are running, reconnecting, or degraded
  const checkableStatuses: WorkerStatus[] = ['running', 'reconnecting', 'degraded']

  for (const entry of workers) {
    if (checkableStatuses.includes(entry.worker.status)) {
      const result = await checkWorkerHealth(entry.worker.id)
      results.push(result)
    }
  }

  return results
}

/**
 * Emit worker event
 */
function emitWorkerEvent(
  event: string,
  workerId: string,
  error?: string
): void {
  const entry = getAllWorkers().find(e => e.worker.id === workerId)
  if (!entry) return

  eventBus.emit(event as 'channel:event', {
    workerId,
    channelType: entry.worker.channelType,
    channelId: entry.worker.channelId,
    tenantId: entry.worker.tenantId,
    status: entry.worker.status,
    timestamp: new Date().toISOString(),
    error
  })
}

/**
 * Start heartbeat service
 */
export function startHeartbeat(customConfig?: Partial<HeartbeatConfig>): void {
  if (heartbeatInterval) {
    console.warn('[Heartbeat] Already running')
    return
  }

  config = { ...DEFAULT_CONFIG, ...customConfig }

  heartbeatInterval = setInterval(async () => {
    try {
      const results = await checkAllWorkersHealth()
      const unhealthy = results.filter(r => !r.healthy)

      if (unhealthy.length > 0) {
        console.log(`[Heartbeat] ${unhealthy.length}/${results.length} workers unhealthy`)
      }
    } catch (error) {
      console.error('[Heartbeat] Error:', error)
    }
  }, config.intervalMs)

  console.log(`[Heartbeat] Started (interval: ${config.intervalMs}ms)`)
}

/**
 * Stop heartbeat service
 */
export function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
    console.log('[Heartbeat] Stopped')
  }
}

/**
 * Check specific worker immediately
 */
export async function checkWorker(workerId: string): Promise<HealthCheckResult> {
  return checkWorkerHealth(workerId)
}

/**
 * Get heartbeat config
 */
export function getHeartbeatConfig(): HeartbeatConfig {
  return { ...config }
}

/**
 * Update heartbeat config
 */
export function updateHeartbeatConfig(updates: Partial<HeartbeatConfig>): void {
  config = { ...config, ...updates }
}

/**
 * Check if heartbeat is running
 */
export function isHeartbeatRunning(): boolean {
  return heartbeatInterval !== null
}
