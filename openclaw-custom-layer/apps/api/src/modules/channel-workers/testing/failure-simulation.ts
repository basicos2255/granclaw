/**
 * Failure Simulation
 * P5.1: Controlled Real Testing & Connector Hardening
 *
 * Simulate failures to test recovery mechanisms.
 */

import { eventBus } from '../../event-bus'

/**
 * Failure types that can be simulated
 */
export type FailureType =
  | 'websocket_lost'
  | 'auth_expired'
  | 'browser_crash'
  | 'imap_disconnect'
  | 'ftp_timeout'
  | 'openclaw_unavailable'
  | 'network_error'
  | 'memory_pressure'
  | 'queue_overflow'

/**
 * Failure simulation config
 */
export interface FailureSimulationConfig {
  enabled: boolean
  failureType: FailureType
  targetWorkerId?: string
  probability: number // 0-1
  durationMs: number
  autoRecover: boolean
}

/**
 * Failure simulation result
 */
export interface FailureSimulationResult {
  simulationId: string
  failureType: FailureType
  targetWorkerId?: string
  startedAt: string
  endedAt?: string
  workerRecovered: boolean
  recoveryTimeMs?: number
  auditEmitted: boolean
  notificationEmitted: boolean
}

/**
 * Simulation state
 */
interface SimulationState {
  active: boolean
  currentSimulation?: FailureSimulationResult
  history: FailureSimulationResult[]
  injectedFailures: Map<string, FailureType>
}

let simulationState: SimulationState = {
  active: false,
  history: [],
  injectedFailures: new Map()
}

let recoveryTimeout: ReturnType<typeof setTimeout> | null = null

/**
 * Start failure simulation
 */
export function startFailureSimulation(
  config: FailureSimulationConfig
): FailureSimulationResult {
  if (simulationState.active) {
    throw new Error('Simulation already active')
  }

  const simulationId = `sim_${Date.now()}`

  simulationState.active = true
  simulationState.currentSimulation = {
    simulationId,
    failureType: config.failureType,
    targetWorkerId: config.targetWorkerId,
    startedAt: new Date().toISOString(),
    workerRecovered: false,
    auditEmitted: false,
    notificationEmitted: false
  }

  // Inject failure
  injectFailure(config)

  // Schedule auto-recovery if enabled
  if (config.autoRecover) {
    recoveryTimeout = setTimeout(() => {
      endFailureSimulation(true)
    }, config.durationMs)
  }

  console.log(`[FailureSimulation] Started: ${config.failureType}`)
  return simulationState.currentSimulation
}

/**
 * Inject failure into system
 */
function injectFailure(config: FailureSimulationConfig): void {
  const { failureType, targetWorkerId } = config

  // Mark worker as having injected failure
  if (targetWorkerId) {
    simulationState.injectedFailures.set(targetWorkerId, failureType)
  }

  // Emit failure event
  eventBus.emit('failure:simulated' as 'channel:event', {
    failureType,
    targetWorkerId,
    timestamp: new Date().toISOString()
  })

  // Type-specific injection
  switch (failureType) {
    case 'websocket_lost':
      eventBus.emit('ws:disconnected' as 'channel:event', {
        reason: 'simulated',
        timestamp: new Date().toISOString()
      })
      break

    case 'auth_expired':
      eventBus.emit('auth:expired' as 'channel:event', {
        workerId: targetWorkerId,
        timestamp: new Date().toISOString()
      })
      break

    case 'browser_crash':
      eventBus.emit('browser:crashed' as 'channel:event', {
        workerId: targetWorkerId,
        error: 'Simulated browser crash',
        timestamp: new Date().toISOString()
      })
      break

    case 'imap_disconnect':
      eventBus.emit('imap:disconnected' as 'channel:event', {
        workerId: targetWorkerId,
        timestamp: new Date().toISOString()
      })
      break

    case 'ftp_timeout':
      eventBus.emit('ftp:timeout' as 'channel:event', {
        workerId: targetWorkerId,
        timestamp: new Date().toISOString()
      })
      break

    case 'openclaw_unavailable':
      eventBus.emit('openclaw:unavailable' as 'channel:event', {
        timestamp: new Date().toISOString()
      })
      break

    case 'network_error':
      eventBus.emit('network:error' as 'channel:event', {
        error: 'Simulated network error',
        timestamp: new Date().toISOString()
      })
      break

    case 'memory_pressure':
      eventBus.emit('memory:pressure' as 'channel:event', {
        usageMB: 1024,
        timestamp: new Date().toISOString()
      })
      break

    case 'queue_overflow':
      eventBus.emit('queue:overflow' as 'channel:event', {
        queueSize: 10000,
        timestamp: new Date().toISOString()
      })
      break
  }
}

/**
 * End failure simulation
 */
export function endFailureSimulation(
  workerRecovered: boolean
): FailureSimulationResult | undefined {
  if (!simulationState.active || !simulationState.currentSimulation) {
    return undefined
  }

  if (recoveryTimeout) {
    clearTimeout(recoveryTimeout)
    recoveryTimeout = null
  }

  const result = simulationState.currentSimulation
  result.endedAt = new Date().toISOString()
  result.workerRecovered = workerRecovered

  if (result.startedAt) {
    const startTime = new Date(result.startedAt).getTime()
    const endTime = new Date(result.endedAt).getTime()
    result.recoveryTimeMs = endTime - startTime
  }

  // Clear injected failures
  if (result.targetWorkerId) {
    simulationState.injectedFailures.delete(result.targetWorkerId)
  }

  // Emit recovery event
  eventBus.emit('failure:recovered' as 'channel:event', {
    simulationId: result.simulationId,
    failureType: result.failureType,
    recovered: workerRecovered,
    recoveryTimeMs: result.recoveryTimeMs,
    timestamp: new Date().toISOString()
  })

  simulationState.history.push(result)
  simulationState.active = false
  simulationState.currentSimulation = undefined

  console.log(`[FailureSimulation] Ended: ${result.failureType} - ${workerRecovered ? 'recovered' : 'not recovered'}`)
  return result
}

/**
 * Check if failure is injected for worker
 */
export function hasInjectedFailure(workerId: string): FailureType | undefined {
  return simulationState.injectedFailures.get(workerId)
}

/**
 * Mark audit as emitted
 */
export function markAuditEmitted(): void {
  if (simulationState.currentSimulation) {
    simulationState.currentSimulation.auditEmitted = true
  }
}

/**
 * Mark notification as emitted
 */
export function markNotificationEmitted(): void {
  if (simulationState.currentSimulation) {
    simulationState.currentSimulation.notificationEmitted = true
  }
}

/**
 * Get simulation status
 */
export function getSimulationStatus(): {
  active: boolean
  currentSimulation?: FailureSimulationResult
  historyCount: number
} {
  return {
    active: simulationState.active,
    currentSimulation: simulationState.currentSimulation,
    historyCount: simulationState.history.length
  }
}

/**
 * Get simulation history
 */
export function getSimulationHistory(limit = 10): FailureSimulationResult[] {
  return simulationState.history.slice(-limit)
}

/**
 * Stop active simulation
 */
export function stopSimulation(): FailureSimulationResult | undefined {
  if (!simulationState.active) return undefined
  return endFailureSimulation(false)
}

/**
 * Run recovery verification
 */
export function verifyRecoveryExpectations(
  result: FailureSimulationResult
): {
  passed: boolean
  failures: string[]
} {
  const failures: string[] = []

  // Check worker recovered
  if (!result.workerRecovered) {
    failures.push('Worker did not recover')
  }

  // Check audit was emitted
  if (!result.auditEmitted) {
    failures.push('Audit event not emitted')
  }

  // Check notification was emitted
  if (!result.notificationEmitted) {
    failures.push('Notification not emitted')
  }

  // Check recovery time is reasonable (< 60 seconds)
  if (result.recoveryTimeMs && result.recoveryTimeMs > 60000) {
    failures.push(`Recovery took too long: ${result.recoveryTimeMs}ms`)
  }

  return {
    passed: failures.length === 0,
    failures
  }
}

/**
 * Run all failure scenarios
 */
export async function runAllFailureScenarios(
  targetWorkerId: string
): Promise<{
  total: number
  passed: number
  failed: number
  results: Array<{
    failureType: FailureType
    passed: boolean
    failures: string[]
  }>
}> {
  const failureTypes: FailureType[] = [
    'websocket_lost',
    'auth_expired',
    'browser_crash',
    'imap_disconnect',
    'ftp_timeout',
    'openclaw_unavailable'
  ]

  const results: Array<{
    failureType: FailureType
    passed: boolean
    failures: string[]
  }> = []

  for (const failureType of failureTypes) {
    // Start simulation
    startFailureSimulation({
      enabled: true,
      failureType,
      targetWorkerId,
      probability: 1,
      durationMs: 5000,
      autoRecover: true
    })

    // Wait for recovery
    await new Promise(resolve => setTimeout(resolve, 6000))

    // Get result
    const lastResult = simulationState.history[simulationState.history.length - 1]
    if (lastResult) {
      const verification = verifyRecoveryExpectations(lastResult)
      results.push({
        failureType,
        passed: verification.passed,
        failures: verification.failures
      })
    }
  }

  const passed = results.filter(r => r.passed).length
  const failed = results.length - passed

  return {
    total: results.length,
    passed,
    failed,
    results
  }
}
