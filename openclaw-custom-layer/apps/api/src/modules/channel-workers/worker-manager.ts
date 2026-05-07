/**
 * Worker Manager
 * P5: Durable Operational Workers & Real Connectors
 *
 * Central management of all channel workers.
 */

import type { ChannelType } from '../channels-runtime/types'
import type {
  ChannelWorker,
  WorkerConfig,
  WorkerCredentials,
  WorkerStatus
} from './types'
import {
  getAllWorkers,
  getWorker,
  getWorkersByType,
  getWorkersByStatus,
  getWorkersByTenant
} from './worker-registry'
import { startWorker, stopWorker, restartWorker, stopAllWorkers, gracefulShutdown } from './lifecycle'
import { getSystemHealth, getAllWorkerHealth, getWorkersNeedingAttention } from './health'
import { loadAllStates, flushToDisk, getPersistenceStats } from './persistence'
import { eventBus } from '../event-bus'

/**
 * Manager state
 */
let initialized = false
let shutdownRequested = false

/**
 * Initialize worker manager
 */
export async function initializeWorkerManager(): Promise<void> {
  if (initialized) {
    console.log('[WorkerManager] Already initialized')
    return
  }

  console.log('[WorkerManager] Initializing...')

  // Load persisted states
  loadAllStates()

  // Setup event listeners
  setupEventListeners()

  // Setup process handlers
  setupProcessHandlers()

  initialized = true
  console.log('[WorkerManager] Initialized')
}

/**
 * Setup event listeners
 */
function setupEventListeners(): void {
  // Listen for worker events
  eventBus.on('worker:failed' as 'channel:event', (...args: unknown[]) => {
    const data = args[0] as Record<string, unknown> | undefined
    if (data) {
      console.log(`[WorkerManager] Worker failed: ${data.workerId}`)
    }
    // Could trigger alerts, recovery, etc.
  })

  eventBus.on('worker:degraded' as 'channel:event', (...args: unknown[]) => {
    const data = args[0] as Record<string, unknown> | undefined
    if (data) {
      console.log(`[WorkerManager] Worker degraded: ${data.workerId}`)
    }
  })
}

/**
 * Setup process shutdown handlers
 */
function setupProcessHandlers(): void {
  const shutdown = async (signal: string) => {
    if (shutdownRequested) return
    shutdownRequested = true

    console.log(`[WorkerManager] Received ${signal}, shutting down...`)
    await gracefulShutdown()
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

/**
 * Create and start a worker
 */
export async function createWorker(
  channelType: ChannelType,
  channelId: string,
  tenantId: string,
  credentials: WorkerCredentials,
  options?: Partial<WorkerConfig>
): Promise<ChannelWorker | null> {
  if (!initialized) {
    await initializeWorkerManager()
  }

  const config: WorkerConfig = {
    channelType,
    channelId,
    tenantId,
    reconnectDelayMs: options?.reconnectDelayMs ?? 5000,
    maxReconnectAttempts: options?.maxReconnectAttempts ?? 10,
    heartbeatIntervalMs: options?.heartbeatIntervalMs ?? 30000,
    healthCheckIntervalMs: options?.healthCheckIntervalMs ?? 60000,
    persistStateIntervalMs: options?.persistStateIntervalMs ?? 60000
  }

  return startWorker(config, credentials)
}

/**
 * Stop a worker by ID
 */
export async function destroyWorker(workerId: string): Promise<boolean> {
  return stopWorker(workerId)
}

/**
 * Restart a worker
 */
export async function rebootWorker(
  workerId: string,
  newCredentials?: WorkerCredentials
): Promise<ChannelWorker | null> {
  return restartWorker(workerId, newCredentials)
}

/**
 * Get worker by ID
 */
export function findWorker(workerId: string): ChannelWorker | null {
  const entry = getWorker(workerId)
  return entry?.worker ?? null
}

/**
 * List all workers
 */
export function listWorkers(filters?: {
  channelType?: ChannelType
  tenantId?: string
  status?: WorkerStatus
}): ChannelWorker[] {
  if (filters?.channelType) {
    return getWorkersByType(filters.channelType).map(e => e.worker)
  }
  if (filters?.tenantId) {
    return getWorkersByTenant(filters.tenantId).map(e => e.worker)
  }
  if (filters?.status) {
    return getWorkersByStatus(filters.status).map(e => e.worker)
  }
  return getAllWorkers().map(e => e.worker)
}

/**
 * Get manager status
 */
export function getManagerStatus(): {
  initialized: boolean
  shutdownRequested: boolean
  health: ReturnType<typeof getSystemHealth>
  persistence: ReturnType<typeof getPersistenceStats>
  workersNeedingAttention: number
} {
  return {
    initialized,
    shutdownRequested,
    health: getSystemHealth(),
    persistence: getPersistenceStats(),
    workersNeedingAttention: getWorkersNeedingAttention().length
  }
}

/**
 * Get detailed worker info
 */
export function getWorkerDetails(workerId: string): {
  worker: ChannelWorker
  health: ReturnType<typeof getAllWorkerHealth>[0]
} | null {
  const entry = getWorker(workerId)
  if (!entry) return null

  const healthList = getAllWorkerHealth()
  const health = healthList.find(h => h.workerId === workerId)

  if (!health) return null

  return {
    worker: entry.worker,
    health
  }
}

/**
 * Stop all workers for a tenant
 */
export async function stopTenantWorkers(tenantId: string): Promise<number> {
  const workers = getWorkersByTenant(tenantId)
  let stopped = 0

  for (const entry of workers) {
    const success = await stopWorker(entry.worker.id)
    if (success) stopped++
  }

  return stopped
}

/**
 * Stop all workers for a channel type
 */
export async function stopChannelWorkers(channelType: ChannelType): Promise<number> {
  const workers = getWorkersByType(channelType)
  let stopped = 0

  for (const entry of workers) {
    const success = await stopWorker(entry.worker.id)
    if (success) stopped++
  }

  return stopped
}

/**
 * Force flush all states to disk
 */
export function persistAllStates(): void {
  flushToDisk()
}

/**
 * Shutdown manager
 */
export async function shutdownManager(timeout = 30000): Promise<void> {
  if (!initialized) return

  console.log('[WorkerManager] Shutting down...')
  await gracefulShutdown(timeout)

  initialized = false
  console.log('[WorkerManager] Shutdown complete')
}

/**
 * Restart all degraded/failed workers
 */
export async function recoverAllWorkers(): Promise<{
  attempted: number
  recovered: number
  failed: string[]
}> {
  const needsRecovery = getWorkersNeedingAttention()
  const failed: string[] = []
  let recovered = 0

  for (const workerHealth of needsRecovery) {
    if (workerHealth.status === 'failed' || workerHealth.status === 'degraded') {
      try {
        const result = await restartWorker(workerHealth.workerId)
        if (result && result.status === 'running') {
          recovered++
        } else {
          failed.push(workerHealth.workerId)
        }
      } catch {
        failed.push(workerHealth.workerId)
      }
    }
  }

  return {
    attempted: needsRecovery.length,
    recovered,
    failed
  }
}
