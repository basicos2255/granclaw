/**
 * Worker Safety Controls
 * P5: Durable Operational Workers & Real Connectors
 *
 * Safety mechanisms to prevent runaway workers and resource exhaustion.
 */

import { getAllWorkers, getWorkerStats, updateWorkerStatus } from './worker-registry'
import { stopWorker } from './lifecycle'
import { eventBus } from '../event-bus'

/**
 * Safety configuration
 */
export interface SafetyConfig {
  maxWorkersPerTenant: number
  maxWorkersTotal: number
  maxFailedWorkers: number
  maxQueuePressure: number
  maxReconnectRate: number // per minute
  emergencyShutdownThreshold: number
  checkIntervalMs: number
}

const DEFAULT_CONFIG: SafetyConfig = {
  maxWorkersPerTenant: 10,
  maxWorkersTotal: 100,
  maxFailedWorkers: 20,
  maxQueuePressure: 0.9,
  maxReconnectRate: 30,
  emergencyShutdownThreshold: 0.5, // 50% failed = emergency
  checkIntervalMs: 30000
}

let config: SafetyConfig = DEFAULT_CONFIG
let safetyInterval: ReturnType<typeof setInterval> | null = null
let recentReconnects: number[] = [] // timestamps

/**
 * Safety violation types
 */
export type SafetyViolation =
  | 'max_workers_tenant'
  | 'max_workers_total'
  | 'max_failed_workers'
  | 'high_queue_pressure'
  | 'reconnect_storm'
  | 'emergency_threshold'

/**
 * Safety check result
 */
export interface SafetyCheckResult {
  safe: boolean
  violations: SafetyViolation[]
  details: Record<string, unknown>
  timestamp: string
}

/**
 * Check if it's safe to create a new worker
 */
export function canCreateWorker(tenantId: string): {
  allowed: boolean
  reason?: string
} {
  const stats = getWorkerStats()
  const workers = getAllWorkers()

  // Check total limit
  if (stats.totalWorkers >= config.maxWorkersTotal) {
    return {
      allowed: false,
      reason: `Maximum total workers (${config.maxWorkersTotal}) reached`
    }
  }

  // Check tenant limit
  const tenantWorkers = workers.filter(e => e.worker.tenantId === tenantId)
  if (tenantWorkers.length >= config.maxWorkersPerTenant) {
    return {
      allowed: false,
      reason: `Maximum workers per tenant (${config.maxWorkersPerTenant}) reached`
    }
  }

  // Check failed worker threshold
  if (stats.failedCount >= config.maxFailedWorkers) {
    return {
      allowed: false,
      reason: `Too many failed workers (${stats.failedCount}/${config.maxFailedWorkers})`
    }
  }

  return { allowed: true }
}

/**
 * Record a reconnect attempt (for storm detection)
 */
export function recordReconnect(): void {
  const now = Date.now()
  recentReconnects.push(now)

  // Keep only last minute
  const oneMinuteAgo = now - 60000
  recentReconnects = recentReconnects.filter(t => t > oneMinuteAgo)
}

/**
 * Check for reconnect storm
 */
function checkReconnectStorm(): boolean {
  return recentReconnects.length > config.maxReconnectRate
}

/**
 * Run safety checks
 */
export function runSafetyChecks(): SafetyCheckResult {
  const stats = getWorkerStats()
  const workers = getAllWorkers()
  const violations: SafetyViolation[] = []
  const details: Record<string, unknown> = {}

  // Check failed worker count
  if (stats.failedCount >= config.maxFailedWorkers) {
    violations.push('max_failed_workers')
    details.failedWorkers = stats.failedCount
  }

  // Check emergency threshold
  if (stats.totalWorkers > 0) {
    const failedRatio = stats.failedCount / stats.totalWorkers
    if (failedRatio >= config.emergencyShutdownThreshold) {
      violations.push('emergency_threshold')
      details.failedRatio = failedRatio
    }
  }

  // Check queue pressure across workers
  const highPressureWorkers = workers.filter(
    e => e.worker.queuePressure > config.maxQueuePressure
  )
  if (highPressureWorkers.length > 0) {
    violations.push('high_queue_pressure')
    details.highPressureWorkers = highPressureWorkers.map(e => e.worker.id)
  }

  // Check reconnect storm
  if (checkReconnectStorm()) {
    violations.push('reconnect_storm')
    details.reconnectsPerMinute = recentReconnects.length
  }

  // Check total workers
  if (stats.totalWorkers >= config.maxWorkersTotal) {
    violations.push('max_workers_total')
    details.totalWorkers = stats.totalWorkers
  }

  return {
    safe: violations.length === 0,
    violations,
    details,
    timestamp: new Date().toISOString()
  }
}

/**
 * Handle safety violations
 */
async function handleViolations(result: SafetyCheckResult): Promise<void> {
  if (result.safe) return

  console.warn(`[Safety] Violations detected: ${result.violations.join(', ')}`)

  // Emit safety event
  eventBus.emit('safety:violation' as 'channel:event', {
    violations: result.violations,
    details: result.details,
    timestamp: result.timestamp
  })

  // Emergency shutdown if threshold reached
  if (result.violations.includes('emergency_threshold')) {
    console.error('[Safety] EMERGENCY: Too many failed workers, stopping all')
    await emergencyStopAll()
    return
  }

  // Stop failed workers to free resources
  if (result.violations.includes('max_failed_workers')) {
    await stopFailedWorkers()
  }

  // Throttle during reconnect storm
  if (result.violations.includes('reconnect_storm')) {
    console.warn('[Safety] Reconnect storm detected, backing off')
    // Could implement circuit breaker here
  }
}

/**
 * Stop all failed workers
 */
async function stopFailedWorkers(): Promise<number> {
  const workers = getAllWorkers()
  let stopped = 0

  for (const entry of workers) {
    if (entry.worker.status === 'failed') {
      try {
        await stopWorker(entry.worker.id)
        stopped++
      } catch (err) {
        console.error(`[Safety] Failed to stop worker ${entry.worker.id}:`, err)
      }
    }
  }

  console.log(`[Safety] Stopped ${stopped} failed workers`)
  return stopped
}

/**
 * Emergency stop all workers
 */
async function emergencyStopAll(): Promise<void> {
  const workers = getAllWorkers()

  console.error(`[Safety] EMERGENCY SHUTDOWN: Stopping ${workers.length} workers`)

  for (const entry of workers) {
    try {
      updateWorkerStatus(entry.worker.id, 'stopped', 'Emergency shutdown')
      await stopWorker(entry.worker.id)
    } catch {
      // Force removal if stop fails
    }
  }

  eventBus.emit('safety:emergency' as 'channel:event', {
    action: 'shutdown_all',
    workersAffected: workers.length,
    timestamp: new Date().toISOString()
  })
}

/**
 * Start safety monitoring
 */
export function startSafetyMonitor(customConfig?: Partial<SafetyConfig>): void {
  if (safetyInterval) {
    console.warn('[Safety] Monitor already running')
    return
  }

  config = { ...DEFAULT_CONFIG, ...customConfig }

  safetyInterval = setInterval(async () => {
    const result = runSafetyChecks()
    await handleViolations(result)
  }, config.checkIntervalMs)

  console.log(`[Safety] Monitor started (interval: ${config.checkIntervalMs}ms)`)
}

/**
 * Stop safety monitoring
 */
export function stopSafetyMonitor(): void {
  if (safetyInterval) {
    clearInterval(safetyInterval)
    safetyInterval = null
    console.log('[Safety] Monitor stopped')
  }
}

/**
 * Get safety config
 */
export function getSafetyConfig(): SafetyConfig {
  return { ...config }
}

/**
 * Update safety config
 */
export function updateSafetyConfig(updates: Partial<SafetyConfig>): void {
  config = { ...config, ...updates }
}

/**
 * Check if safety monitor is running
 */
export function isSafetyMonitorRunning(): boolean {
  return safetyInterval !== null
}

/**
 * Get current safety status
 */
export function getSafetyStatus(): {
  monitorRunning: boolean
  lastCheck?: SafetyCheckResult
  reconnectsLastMinute: number
} {
  return {
    monitorRunning: isSafetyMonitorRunning(),
    lastCheck: runSafetyChecks(),
    reconnectsLastMinute: recentReconnects.length
  }
}
