/**
 * Recovery Service
 * P5: Durable Operational Workers & Real Connectors
 *
 * Handles worker recovery and reconnection.
 */

import type {
  RecoveryAction,
  RecoveryResult,
  WorkerPersistedState
} from './types'
import {
  getAllWorkers,
  getWorker,
  updateWorkerStatus,
  updateWorkerState
} from './worker-registry'
import { eventBus } from '../event-bus'

/**
 * Recovery configuration
 */
interface RecoveryConfig {
  maxReconnectAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  escalateAfterFailures: number
}

const DEFAULT_CONFIG: RecoveryConfig = {
  maxReconnectAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  escalateAfterFailures: 3
}

let config: RecoveryConfig = DEFAULT_CONFIG

/**
 * Calculate backoff delay
 */
function calculateBackoff(attempt: number): number {
  const delay = config.baseDelayMs * Math.pow(2, attempt)
  return Math.min(delay, config.maxDelayMs)
}

/**
 * Attempt to reconnect a worker
 */
export async function reconnectWorker(workerId: string): Promise<RecoveryResult> {
  const entry = getWorker(workerId)

  if (!entry) {
    return {
      success: false,
      action: 'reconnect',
      workerId,
      attempts: 0,
      error: 'Worker not found'
    }
  }

  const { worker, handler } = entry

  // Check if already at max attempts
  if (worker.reconnectCount >= config.maxReconnectAttempts) {
    updateWorkerStatus(workerId, 'failed', 'Max reconnect attempts exceeded')

    return {
      success: false,
      action: 'escalate',
      workerId,
      attempts: worker.reconnectCount,
      error: 'Max reconnect attempts exceeded'
    }
  }

  // Update status to reconnecting
  updateWorkerStatus(workerId, 'reconnecting')
  emitRecoveryEvent('worker:reconnecting', workerId)

  // Calculate delay
  const delay = calculateBackoff(worker.reconnectCount)
  await sleep(delay)

  try {
    // Attempt reconnection
    await handler.reconnect()

    // Update to running if successful
    updateWorkerStatus(workerId, 'running')
    updateWorkerState(workerId, { connected: true })

    emitRecoveryEvent('worker:reconnected', workerId)

    return {
      success: true,
      action: 'reconnect',
      workerId,
      attempts: worker.reconnectCount,
      recoveredAt: new Date().toISOString()
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'

    // Check if should escalate
    if (worker.reconnectCount >= config.escalateAfterFailures) {
      updateWorkerStatus(workerId, 'failed', errorMsg)
      emitRecoveryEvent('worker:failed', workerId, errorMsg)

      return {
        success: false,
        action: 'escalate',
        workerId,
        attempts: worker.reconnectCount,
        error: errorMsg
      }
    }

    // Stay in reconnecting state for retry
    updateWorkerStatus(workerId, 'degraded', errorMsg)

    return {
      success: false,
      action: 'reconnect',
      workerId,
      attempts: worker.reconnectCount,
      error: errorMsg
    }
  }
}

/**
 * Restore worker from persisted state
 */
export async function restoreWorker(
  workerId: string,
  state: WorkerPersistedState
): Promise<RecoveryResult> {
  const entry = getWorker(workerId)

  if (!entry) {
    return {
      success: false,
      action: 'restore_session',
      workerId,
      attempts: 0,
      error: 'Worker not found'
    }
  }

  try {
    // Restore state
    await entry.handler.restoreState(state)

    updateWorkerState(workerId, {
      sessionId: state.sessionData ? 'restored' : undefined,
      cursor: state.cursor,
      authenticated: !!state.authState?.accessToken
    })

    return {
      success: true,
      action: 'restore_session',
      workerId,
      attempts: 1,
      recoveredAt: new Date().toISOString()
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'

    return {
      success: false,
      action: 'restore_session',
      workerId,
      attempts: 1,
      error: errorMsg
    }
  }
}

/**
 * Restart a failed worker
 */
export async function restartWorker(workerId: string): Promise<RecoveryResult> {
  const entry = getWorker(workerId)

  if (!entry) {
    return {
      success: false,
      action: 'restart_worker',
      workerId,
      attempts: 0,
      error: 'Worker not found'
    }
  }

  try {
    // Disconnect first
    await entry.handler.disconnect()

    // Reset state
    updateWorkerStatus(workerId, 'starting')
    entry.worker.reconnectCount = 0
    entry.worker.health.consecutiveFailures = 0

    // Connect again
    await entry.handler.connect()

    updateWorkerStatus(workerId, 'running')
    updateWorkerState(workerId, { connected: true })

    emitRecoveryEvent('worker:recovered', workerId)

    return {
      success: true,
      action: 'restart_worker',
      workerId,
      attempts: 1,
      recoveredAt: new Date().toISOString()
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    updateWorkerStatus(workerId, 'failed', errorMsg)

    return {
      success: false,
      action: 'restart_worker',
      workerId,
      attempts: 1,
      error: errorMsg
    }
  }
}

/**
 * Recover all failed/degraded workers
 */
export async function recoverAllWorkers(): Promise<RecoveryResult[]> {
  const workers = getAllWorkers()
  const results: RecoveryResult[] = []

  for (const entry of workers) {
    if (entry.worker.status === 'failed') {
      const result = await restartWorker(entry.worker.id)
      results.push(result)
    } else if (entry.worker.status === 'degraded') {
      const result = await reconnectWorker(entry.worker.id)
      results.push(result)
    }
  }

  return results
}

/**
 * Emit recovery event
 */
function emitRecoveryEvent(
  event: string,
  workerId: string,
  error?: string
): void {
  const entry = getWorker(workerId)
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
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Get recovery config
 */
export function getRecoveryConfig(): RecoveryConfig {
  return { ...config }
}

/**
 * Update recovery config
 */
export function updateRecoveryConfig(updates: Partial<RecoveryConfig>): void {
  config = { ...config, ...updates }
}

/**
 * Determine best recovery action
 */
export function determineRecoveryAction(workerId: string): RecoveryAction {
  const entry = getWorker(workerId)

  if (!entry) {
    return 'escalate'
  }

  const { worker } = entry

  // If never connected, try restart
  if (!worker.runtimeState.connected) {
    return 'restart_worker'
  }

  // If auth expired, refresh
  if (!worker.runtimeState.authenticated) {
    return 'refresh_auth'
  }

  // If has session, try restore
  if (worker.runtimeState.sessionId) {
    return 'restore_session'
  }

  // If too many failures, escalate
  if (worker.reconnectCount >= config.maxReconnectAttempts) {
    return 'escalate'
  }

  // Default to reconnect
  return 'reconnect'
}
