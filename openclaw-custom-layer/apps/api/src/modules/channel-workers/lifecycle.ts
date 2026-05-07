/**
 * Worker Lifecycle Manager
 * P5: Durable Operational Workers & Real Connectors
 *
 * Manages worker lifecycle: start, stop, restart.
 */

import type {
  ChannelWorker,
  WorkerConfig,
  WorkerCredentials,
  WorkerPersistedState
} from './types'
import {
  createWorker,
  getWorker,
  getAllWorkers,
  removeWorker,
  updateWorkerStatus,
  updateWorkerState
} from './worker-registry'
import { loadWorkerState, saveWorkerState, deleteWorkerState } from './persistence'
import { eventBus } from '../event-bus'

/**
 * Start a worker
 */
export async function startWorker(
  config: WorkerConfig,
  credentials: WorkerCredentials
): Promise<ChannelWorker | null> {
  // Create worker
  const worker = createWorker(config, credentials)
  if (!worker) {
    return null
  }

  const entry = getWorker(worker.id)
  if (!entry) {
    return null
  }

  emitLifecycleEvent('worker:starting', worker.id)

  try {
    // Try to restore state
    const savedState = loadWorkerState(worker.channelId)
    if (savedState) {
      try {
        await entry.handler.restoreState(savedState)
        console.log(`[Lifecycle] Restored state for worker ${worker.id}`)
      } catch (err) {
        console.warn(`[Lifecycle] Failed to restore state: ${err}`)
      }
    }

    // Connect
    await entry.handler.connect()

    // Update status
    updateWorkerStatus(worker.id, 'running')
    updateWorkerState(worker.id, {
      connected: true,
      authenticated: true
    })

    // Setup heartbeat timer
    entry.heartbeatTimer = setInterval(async () => {
      try {
        const healthy = await entry.handler.heartbeat()
        if (!healthy) {
          updateWorkerStatus(worker.id, 'degraded', 'Heartbeat failed')
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown'
        updateWorkerStatus(worker.id, 'degraded', msg)
      }
    }, config.heartbeatIntervalMs)

    // Setup persistence timer
    entry.persistTimer = setInterval(() => {
      try {
        const state = entry.handler.saveState()
        saveWorkerState(state)
      } catch (err) {
        console.error(`[Lifecycle] Failed to persist state: ${err}`)
      }
    }, config.persistStateIntervalMs)

    emitLifecycleEvent('worker:started', worker.id)
    console.log(`[Lifecycle] Started worker ${worker.id}`)

    return entry.worker
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    updateWorkerStatus(worker.id, 'failed', errorMsg)
    emitLifecycleEvent('worker:failed', worker.id, errorMsg)

    console.error(`[Lifecycle] Failed to start worker ${worker.id}: ${errorMsg}`)
    return entry.worker
  }
}

/**
 * Stop a worker
 */
export async function stopWorker(workerId: string): Promise<boolean> {
  const entry = getWorker(workerId)
  if (!entry) {
    return false
  }

  try {
    // Save state before stopping
    try {
      const state = entry.handler.saveState()
      saveWorkerState(state)
    } catch (err) {
      console.warn(`[Lifecycle] Failed to save state on stop: ${err}`)
    }

    // Disconnect
    await entry.handler.disconnect()

    // Update status
    updateWorkerStatus(workerId, 'stopped')

    // Remove from registry
    removeWorker(workerId)

    emitLifecycleEvent('worker:stopped', workerId)
    console.log(`[Lifecycle] Stopped worker ${workerId}`)

    return true
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Lifecycle] Error stopping worker ${workerId}: ${errorMsg}`)

    // Force remove anyway
    removeWorker(workerId)
    return true
  }
}

/**
 * Restart a worker
 */
export async function restartWorker(
  workerId: string,
  newCredentials?: WorkerCredentials
): Promise<ChannelWorker | null> {
  const entry = getWorker(workerId)
  if (!entry) {
    return null
  }

  const { config } = entry

  // Get current credentials if not provided
  const credentials = newCredentials || {
    type: 'session' as const,
    sessionData: entry.worker.runtimeState.sessionId
  }

  // Stop current worker
  await stopWorker(workerId)

  // Start new worker
  return startWorker(config, credentials)
}

/**
 * Stop all workers
 */
export async function stopAllWorkers(): Promise<void> {
  const workers = getAllWorkers()

  console.log(`[Lifecycle] Stopping ${workers.length} workers...`)

  for (const entry of workers) {
    await stopWorker(entry.worker.id)
  }

  console.log('[Lifecycle] All workers stopped')
}

/**
 * Graceful shutdown
 */
export async function gracefulShutdown(timeoutMs = 30000): Promise<void> {
  console.log('[Lifecycle] Initiating graceful shutdown...')

  const workers = getAllWorkers()

  // Save all states first
  for (const entry of workers) {
    try {
      const state = entry.handler.saveState()
      saveWorkerState(state)
    } catch (err) {
      console.warn(`[Lifecycle] Failed to save state for ${entry.worker.id}`)
    }
  }

  // Stop all workers with timeout
  const stopPromises = workers.map(entry =>
    stopWorker(entry.worker.id).catch(err =>
      console.error(`[Lifecycle] Error stopping ${entry.worker.id}: ${err}`)
    )
  )

  const timeoutPromise = new Promise<void>(resolve => {
    setTimeout(() => {
      console.warn('[Lifecycle] Shutdown timeout reached')
      resolve()
    }, timeoutMs)
  })

  await Promise.race([
    Promise.all(stopPromises),
    timeoutPromise
  ])

  console.log('[Lifecycle] Graceful shutdown complete')
}

/**
 * Recover workers after restart
 */
export async function recoverWorkersOnStartup(
  configs: Array<{ config: WorkerConfig; credentials: WorkerCredentials }>
): Promise<ChannelWorker[]> {
  console.log(`[Lifecycle] Recovering ${configs.length} workers...`)

  const recovered: ChannelWorker[] = []

  for (const { config, credentials } of configs) {
    const worker = await startWorker(config, credentials)
    if (worker) {
      recovered.push(worker)
    }
  }

  console.log(`[Lifecycle] Recovered ${recovered.length}/${configs.length} workers`)
  return recovered
}

/**
 * Emit lifecycle event
 */
function emitLifecycleEvent(
  event: string,
  workerId: string,
  error?: string
): void {
  const entry = getWorker(workerId)

  eventBus.emit(event as 'channel:event', {
    workerId,
    channelType: entry?.worker.channelType,
    channelId: entry?.worker.channelId,
    tenantId: entry?.worker.tenantId,
    status: entry?.worker.status,
    timestamp: new Date().toISOString(),
    error
  })
}

/**
 * Get worker lifecycle info
 */
export function getWorkerLifecycleInfo(workerId: string): {
  uptime: number
  restarts: number
  lastRestart?: string
} | null {
  const entry = getWorker(workerId)
  if (!entry) return null

  const startedAt = new Date(entry.worker.startedAt).getTime()
  const uptime = Date.now() - startedAt

  return {
    uptime,
    restarts: entry.worker.reconnectCount,
    lastRestart: entry.worker.reconnectCount > 0 ? entry.worker.lastActivityAt : undefined
  }
}
