/**
 * Worker Registry
 * P5: Durable Operational Workers & Real Connectors
 *
 * Registry of active channel workers.
 */

import type {
  ChannelWorker,
  WorkerRegistryEntry,
  WorkerStatus,
  WorkerManagerStats,
  WorkerConfig,
  WorkerHandler,
  WorkerCredentials,
  WorkerFactory
} from './types'
import type { ChannelType } from '../channels-runtime/types'

/**
 * Active workers registry
 */
const workers: Map<string, WorkerRegistryEntry> = new Map()

/**
 * Worker factories by channel type
 */
const factories: Map<ChannelType, WorkerFactory> = new Map()

/**
 * Generate worker ID
 */
function generateWorkerId(channelType: ChannelType, channelId: string): string {
  return `worker_${channelType}_${channelId}_${Date.now()}`
}

/**
 * Register a worker factory
 */
export function registerWorkerFactory(
  channelType: ChannelType,
  factory: WorkerFactory
): void {
  factories.set(channelType, factory)
  console.log(`[WorkerRegistry] Registered factory for ${channelType}`)
}

/**
 * Create and register a worker
 */
export function createWorker(
  config: WorkerConfig,
  credentials: WorkerCredentials
): ChannelWorker | null {
  const factory = factories.get(config.channelType)

  if (!factory) {
    console.error(`[WorkerRegistry] No factory for channel type: ${config.channelType}`)
    return null
  }

  const workerId = generateWorkerId(config.channelType, config.channelId)
  const now = new Date().toISOString()

  const handler = factory(config, credentials)

  const worker: ChannelWorker = {
    id: workerId,
    channelType: config.channelType,
    channelId: config.channelId,
    tenantId: config.tenantId,
    status: 'starting',
    health: {
      healthy: false,
      lastHeartbeat: now,
      consecutiveFailures: 0
    },
    reconnectCount: 0,
    queuePressure: 0,
    runtimeState: {
      connected: false,
      authenticated: false,
      pendingActions: 0,
      processedCount: 0,
      errorCount: 0
    },
    startedAt: now,
    lastActivityAt: now
  }

  const entry: WorkerRegistryEntry = {
    worker,
    handler,
    config
  }

  workers.set(workerId, entry)
  console.log(`[WorkerRegistry] Created worker: ${workerId}`)

  return worker
}

/**
 * Get worker by ID
 */
export function getWorker(workerId: string): WorkerRegistryEntry | undefined {
  return workers.get(workerId)
}

/**
 * Get worker by channel ID
 */
export function getWorkerByChannel(channelId: string): WorkerRegistryEntry | undefined {
  for (const entry of workers.values()) {
    if (entry.worker.channelId === channelId) {
      return entry
    }
  }
  return undefined
}

/**
 * Get all workers
 */
export function getAllWorkers(): WorkerRegistryEntry[] {
  return Array.from(workers.values())
}

/**
 * Get workers by status
 */
export function getWorkersByStatus(status: WorkerStatus): WorkerRegistryEntry[] {
  return Array.from(workers.values())
    .filter(entry => entry.worker.status === status)
}

/**
 * Get workers by channel type
 */
export function getWorkersByType(channelType: ChannelType): WorkerRegistryEntry[] {
  return Array.from(workers.values())
    .filter(entry => entry.worker.channelType === channelType)
}

/**
 * Get workers by tenant
 */
export function getWorkersByTenant(tenantId: string): WorkerRegistryEntry[] {
  return Array.from(workers.values())
    .filter(entry => entry.worker.tenantId === tenantId)
}

/**
 * Update worker status
 */
export function updateWorkerStatus(
  workerId: string,
  status: WorkerStatus,
  error?: string
): boolean {
  const entry = workers.get(workerId)
  if (!entry) return false

  entry.worker.status = status
  entry.worker.lastActivityAt = new Date().toISOString()

  if (error) {
    entry.worker.health.lastError = error
  }

  if (status === 'reconnecting') {
    entry.worker.reconnectCount++
  }

  if (status === 'running') {
    entry.worker.health.healthy = true
    entry.worker.health.consecutiveFailures = 0
  }

  if (status === 'failed' || status === 'degraded') {
    entry.worker.health.healthy = false
    entry.worker.health.consecutiveFailures++
    entry.worker.health.degradedReason = error
  }

  return true
}

/**
 * Update worker runtime state
 */
export function updateWorkerState(
  workerId: string,
  updates: Partial<ChannelWorker['runtimeState']>
): boolean {
  const entry = workers.get(workerId)
  if (!entry) return false

  entry.worker.runtimeState = {
    ...entry.worker.runtimeState,
    ...updates
  }
  entry.worker.lastActivityAt = new Date().toISOString()

  return true
}

/**
 * Record heartbeat
 */
export function recordHeartbeat(workerId: string): boolean {
  const entry = workers.get(workerId)
  if (!entry) return false

  entry.worker.health.lastHeartbeat = new Date().toISOString()
  entry.worker.health.consecutiveFailures = 0
  entry.worker.lastActivityAt = new Date().toISOString()

  return true
}

/**
 * Record failure
 */
export function recordFailure(workerId: string, error: string): boolean {
  const entry = workers.get(workerId)
  if (!entry) return false

  entry.worker.health.consecutiveFailures++
  entry.worker.health.lastError = error
  entry.worker.runtimeState.errorCount++
  entry.worker.lastActivityAt = new Date().toISOString()

  return true
}

/**
 * Remove worker
 */
export function removeWorker(workerId: string): boolean {
  const entry = workers.get(workerId)
  if (!entry) return false

  // Clear timers
  if (entry.heartbeatTimer) {
    clearInterval(entry.heartbeatTimer)
  }
  if (entry.persistTimer) {
    clearInterval(entry.persistTimer)
  }

  workers.delete(workerId)
  console.log(`[WorkerRegistry] Removed worker: ${workerId}`)

  return true
}

/**
 * Get worker stats
 */
export function getWorkerStats(): WorkerManagerStats {
  const stats: WorkerManagerStats = {
    totalWorkers: workers.size,
    byStatus: {
      starting: 0,
      running: 0,
      reconnecting: 0,
      degraded: 0,
      failed: 0,
      stopped: 0
    },
    byChannelType: {},
    healthyCount: 0,
    degradedCount: 0,
    failedCount: 0
  }

  for (const entry of workers.values()) {
    const { worker } = entry

    stats.byStatus[worker.status]++

    if (!stats.byChannelType[worker.channelType]) {
      stats.byChannelType[worker.channelType] = 0
    }
    stats.byChannelType[worker.channelType]++

    if (worker.health.healthy) {
      stats.healthyCount++
    } else if (worker.status === 'degraded') {
      stats.degradedCount++
    } else if (worker.status === 'failed') {
      stats.failedCount++
    }
  }

  return stats
}

/**
 * Check if factory exists
 */
export function hasFactory(channelType: ChannelType): boolean {
  return factories.has(channelType)
}

/**
 * Get registered factory types
 */
export function getRegisteredFactories(): ChannelType[] {
  return Array.from(factories.keys())
}
