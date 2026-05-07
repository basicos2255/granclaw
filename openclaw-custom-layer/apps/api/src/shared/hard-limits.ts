/**
 * Hard Limits Configuration
 * PHASE H1: Runtime Hardening & Platform Stabilization
 *
 * System-wide safety limits to prevent resource exhaustion.
 * These are hard limits that cannot be exceeded.
 */

/**
 * Hard limits configuration
 */
export interface HardLimits {
  // Queue limits
  /** Maximum jobs in queue */
  maxQueuedJobs: number
  /** Maximum concurrent jobs */
  maxConcurrentJobs: number
  /** Maximum job payload size in bytes */
  maxJobPayloadBytes: number
  /** Maximum job timeout in ms */
  maxJobTimeoutMs: number
  /** Maximum retry attempts */
  maxRetryAttempts: number
  /** Maximum dead letter queue size */
  maxDeadLetterSize: number

  // DAG limits
  /** Maximum nodes in a DAG */
  maxDagNodes: number
  /** Maximum DAG execution time in ms */
  maxDagExecutionMs: number
  /** Maximum parallel groups in DAG */
  maxParallelGroups: number
  /** Maximum pending DAG executions */
  maxPendingDagExecutions: number

  // Resource limits
  /** Maximum parallel local executions */
  maxParallelLocal: number
  /** Maximum parallel OpenClaw calls */
  maxParallelOpenClaw: number
  /** Maximum concurrent downloads */
  maxConcurrentDownloads: number
  /** Maximum concurrent installs */
  maxConcurrentInstalls: number
  /** Global concurrency limit */
  globalConcurrencyLimit: number

  // Memory limits
  /** Maximum event history size */
  maxEventHistorySize: number
  /** Maximum persisted jobs */
  maxPersistedJobs: number
  /** Maximum log entries in memory */
  maxLogEntries: number

  // Time limits
  /** Maximum lock hold time in ms */
  maxLockHoldTimeMs: number
  /** Maximum resource slot hold time in ms */
  maxSlotHoldTimeMs: number
  /** Maximum wait queue time in ms */
  maxWaitQueueTimeMs: number

  // Request limits
  /** Maximum request body size in bytes */
  maxRequestBodyBytes: number
  /** Maximum requests per minute per tenant */
  maxRequestsPerMinute: number
}

/**
 * Default hard limits
 */
export const DEFAULT_HARD_LIMITS: HardLimits = {
  // Queue limits
  maxQueuedJobs: 1000,
  maxConcurrentJobs: 10,
  maxJobPayloadBytes: 1024 * 1024, // 1MB
  maxJobTimeoutMs: 600000, // 10 minutes
  maxRetryAttempts: 10,
  maxDeadLetterSize: 500,

  // DAG limits
  maxDagNodes: 50,
  maxDagExecutionMs: 1800000, // 30 minutes
  maxParallelGroups: 10,
  maxPendingDagExecutions: 20,

  // Resource limits
  maxParallelLocal: 5,
  maxParallelOpenClaw: 3,
  maxConcurrentDownloads: 3,
  maxConcurrentInstalls: 2,
  globalConcurrencyLimit: 10,

  // Memory limits
  maxEventHistorySize: 1000,
  maxPersistedJobs: 500,
  maxLogEntries: 5000,

  // Time limits
  maxLockHoldTimeMs: 300000, // 5 minutes
  maxSlotHoldTimeMs: 300000, // 5 minutes
  maxWaitQueueTimeMs: 120000, // 2 minutes

  // Request limits
  maxRequestBodyBytes: 10 * 1024 * 1024, // 10MB
  maxRequestsPerMinute: 600
}

// Current hard limits (can be updated at runtime)
let currentLimits: HardLimits = { ...DEFAULT_HARD_LIMITS }

/**
 * Get current hard limits
 */
export function getHardLimits(): HardLimits {
  return { ...currentLimits }
}

/**
 * Update hard limits
 * Note: Limits can only be made stricter, not relaxed beyond defaults
 */
export function updateHardLimits(updates: Partial<HardLimits>): HardLimits {
  const newLimits = { ...currentLimits }

  for (const [key, value] of Object.entries(updates)) {
    const k = key as keyof HardLimits
    const defaultValue = DEFAULT_HARD_LIMITS[k]
    const currentValue = currentLimits[k]

    // Only allow stricter limits (lower values for max limits)
    if (typeof value === 'number' && value <= defaultValue) {
      (newLimits as Record<string, number>)[k] = value
    }
  }

  currentLimits = newLimits
  return { ...currentLimits }
}

/**
 * Reset to default limits
 */
export function resetHardLimits(): HardLimits {
  currentLimits = { ...DEFAULT_HARD_LIMITS }
  return { ...currentLimits }
}

/**
 * Check if a value exceeds a limit
 */
export function checkLimit<K extends keyof HardLimits>(
  key: K,
  value: number
): { allowed: boolean; limit: number; exceeded: number } {
  const limit = currentLimits[key] as number
  const exceeded = value > limit ? value - limit : 0

  return {
    allowed: value <= limit,
    limit,
    exceeded
  }
}

/**
 * Validation result
 */
export interface LimitValidation {
  valid: boolean
  violations: Array<{
    limit: keyof HardLimits
    value: number
    max: number
    message: string
  }>
}

/**
 * Validate multiple values against limits
 */
export function validateLimits(values: Partial<Record<keyof HardLimits, number>>): LimitValidation {
  const violations: LimitValidation['violations'] = []

  for (const [key, value] of Object.entries(values)) {
    const k = key as keyof HardLimits
    if (value === undefined) continue

    const check = checkLimit(k, value)
    if (!check.allowed) {
      violations.push({
        limit: k,
        value,
        max: check.limit,
        message: `${key} (${value}) exceeds limit (${check.limit})`
      })
    }
  }

  return {
    valid: violations.length === 0,
    violations
  }
}

/**
 * Get limit usage report
 */
export interface LimitUsageReport {
  limits: HardLimits
  usage: Partial<Record<keyof HardLimits, {
    current: number
    limit: number
    percentage: number
    status: 'ok' | 'warning' | 'critical'
  }>>
  overallStatus: 'ok' | 'warning' | 'critical'
}

export function getLimitUsageReport(
  currentUsage: Partial<Record<keyof HardLimits, number>>
): LimitUsageReport {
  const usage: LimitUsageReport['usage'] = {}
  let overallStatus: 'ok' | 'warning' | 'critical' = 'ok'

  for (const [key, value] of Object.entries(currentUsage)) {
    const k = key as keyof HardLimits
    if (value === undefined) continue

    const limit = currentLimits[k] as number
    const percentage = Math.round((value / limit) * 100)

    let status: 'ok' | 'warning' | 'critical' = 'ok'
    if (percentage >= 90) {
      status = 'critical'
      overallStatus = 'critical'
    } else if (percentage >= 70) {
      status = 'warning'
      if (overallStatus !== 'critical') {
        overallStatus = 'warning'
      }
    }

    usage[k] = {
      current: value,
      limit,
      percentage,
      status
    }
  }

  return {
    limits: { ...currentLimits },
    usage,
    overallStatus
  }
}

/**
 * Commonly used limit checks
 */
export const limitChecks = {
  canQueueJob: (currentQueueSize: number): boolean =>
    currentQueueSize < currentLimits.maxQueuedJobs,

  canStartJob: (currentRunning: number): boolean =>
    currentRunning < currentLimits.maxConcurrentJobs,

  canRetry: (retryCount: number): boolean =>
    retryCount < currentLimits.maxRetryAttempts,

  canAddToDag: (currentNodes: number): boolean =>
    currentNodes < currentLimits.maxDagNodes,

  isPayloadValid: (payloadBytes: number): boolean =>
    payloadBytes <= currentLimits.maxJobPayloadBytes,

  isRequestBodyValid: (bodyBytes: number): boolean =>
    bodyBytes <= currentLimits.maxRequestBodyBytes,

  canAcquireLocalSlot: (currentLocal: number): boolean =>
    currentLocal < currentLimits.maxParallelLocal,

  canAcquireOpenClawSlot: (currentOpenClaw: number): boolean =>
    currentOpenClaw < currentLimits.maxParallelOpenClaw
}
