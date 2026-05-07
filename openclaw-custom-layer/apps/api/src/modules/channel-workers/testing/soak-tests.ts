/**
 * Soak Tests (Long Runtime Tests)
 * P5.1: Controlled Real Testing & Connector Hardening
 *
 * Long-running tests for memory, stability, recovery.
 */

/**
 * Soak test configuration
 */
export interface SoakTestConfig {
  durationMs: number
  checkIntervalMs: number
  memoryThresholdMB: number
  reconnectThreshold: number
  queueLagThresholdMs: number
  errorRateThreshold: number
}

/**
 * Soak test durations
 */
export const SOAK_DURATIONS = {
  SHORT: 1 * 60 * 60 * 1000,      // 1 hour
  MEDIUM: 6 * 60 * 60 * 1000,     // 6 hours
  LONG: 24 * 60 * 60 * 1000       // 24 hours
} as const

/**
 * Soak test result
 */
export interface SoakTestResult {
  testId: string
  duration: string
  startedAt: string
  endedAt?: string
  status: 'running' | 'passed' | 'failed' | 'stopped'
  metrics: SoakTestMetrics
  failures: SoakTestFailure[]
  summary: string
}

/**
 * Soak test metrics
 */
export interface SoakTestMetrics {
  memoryChecks: number
  memoryPeakMB: number
  memoryGrowthMB: number
  reconnectCount: number
  queueMaxLagMs: number
  wsReconnectCount: number
  workerRecoveries: number
  errorCount: number
  successCount: number
}

/**
 * Soak test failure
 */
export interface SoakTestFailure {
  timestamp: string
  type: 'memory' | 'reconnect' | 'queue' | 'ws' | 'worker' | 'error'
  message: string
  severity: 'warning' | 'critical'
}

/**
 * Soak test state
 */
interface SoakTestState {
  running: boolean
  currentTest?: SoakTestResult
  history: SoakTestResult[]
  startMemoryMB: number
}

let testState: SoakTestState = {
  running: false,
  history: [],
  startMemoryMB: 0
}

let testInterval: ReturnType<typeof setInterval> | null = null

/**
 * Default config
 */
const defaultConfig: SoakTestConfig = {
  durationMs: SOAK_DURATIONS.SHORT,
  checkIntervalMs: 60000, // Check every minute
  memoryThresholdMB: 500,
  reconnectThreshold: 10,
  queueLagThresholdMs: 30000,
  errorRateThreshold: 0.05 // 5%
}

/**
 * Start soak test
 */
export function startSoakTest(
  duration: keyof typeof SOAK_DURATIONS | number,
  config?: Partial<SoakTestConfig>
): SoakTestResult {
  if (testState.running) {
    throw new Error('Soak test already running')
  }

  const durationMs = typeof duration === 'number'
    ? duration
    : SOAK_DURATIONS[duration]

  const testConfig = { ...defaultConfig, ...config, durationMs }
  const testId = `soak_${Date.now()}`

  testState.running = true
  testState.startMemoryMB = getMemoryUsageMB()
  testState.currentTest = {
    testId,
    duration: formatDuration(durationMs),
    startedAt: new Date().toISOString(),
    status: 'running',
    metrics: {
      memoryChecks: 0,
      memoryPeakMB: testState.startMemoryMB,
      memoryGrowthMB: 0,
      reconnectCount: 0,
      queueMaxLagMs: 0,
      wsReconnectCount: 0,
      workerRecoveries: 0,
      errorCount: 0,
      successCount: 0
    },
    failures: [],
    summary: ''
  }

  // Schedule checks
  testInterval = setInterval(() => {
    runSoakChecks(testConfig)
  }, testConfig.checkIntervalMs)

  // Schedule end
  setTimeout(() => {
    endSoakTest('passed')
  }, durationMs)

  console.log(`[SoakTest] Started: ${testId} (${formatDuration(durationMs)})`)
  return testState.currentTest
}

/**
 * Run soak checks
 */
function runSoakChecks(config: SoakTestConfig): void {
  if (!testState.currentTest) return

  const test = testState.currentTest
  test.metrics.memoryChecks++

  // Memory check
  const currentMemory = getMemoryUsageMB()
  if (currentMemory > test.metrics.memoryPeakMB) {
    test.metrics.memoryPeakMB = currentMemory
  }
  test.metrics.memoryGrowthMB = currentMemory - testState.startMemoryMB

  if (currentMemory > config.memoryThresholdMB) {
    test.failures.push({
      timestamp: new Date().toISOString(),
      type: 'memory',
      message: `Memory ${currentMemory}MB exceeds threshold ${config.memoryThresholdMB}MB`,
      severity: 'warning'
    })
  }

  // Check thresholds for critical failures
  if (test.metrics.reconnectCount > config.reconnectThreshold * 2) {
    test.failures.push({
      timestamp: new Date().toISOString(),
      type: 'reconnect',
      message: `Reconnect count ${test.metrics.reconnectCount} is critical`,
      severity: 'critical'
    })
  }
}

/**
 * Record metric during soak test
 */
export function recordSoakMetric(
  metric: keyof SoakTestMetrics,
  value: number,
  increment = true
): void {
  if (!testState.currentTest) return

  const metrics = testState.currentTest.metrics

  if (increment) {
    (metrics[metric] as number) += value
  } else {
    if (value > (metrics[metric] as number)) {
      (metrics[metric] as number) = value
    }
  }
}

/**
 * Record soak failure
 */
export function recordSoakFailure(
  type: SoakTestFailure['type'],
  message: string,
  severity: SoakTestFailure['severity'] = 'warning'
): void {
  if (!testState.currentTest) return

  testState.currentTest.failures.push({
    timestamp: new Date().toISOString(),
    type,
    message,
    severity
  })

  // Auto-fail on too many critical failures
  const criticalCount = testState.currentTest.failures
    .filter(f => f.severity === 'critical').length

  if (criticalCount >= 5) {
    endSoakTest('failed')
  }
}

/**
 * End soak test
 */
export function endSoakTest(
  status: 'passed' | 'failed' | 'stopped'
): SoakTestResult | undefined {
  if (!testState.currentTest) return undefined

  if (testInterval) {
    clearInterval(testInterval)
    testInterval = null
  }

  const test = testState.currentTest
  test.status = status
  test.endedAt = new Date().toISOString()
  test.summary = generateSummary(test)

  testState.history.push(test)
  testState.running = false
  testState.currentTest = undefined

  console.log(`[SoakTest] Ended: ${test.testId} - ${status}`)
  console.log(test.summary)

  return test
}

/**
 * Generate test summary
 */
function generateSummary(test: SoakTestResult): string {
  const { metrics, failures } = test

  const criticalFailures = failures.filter(f => f.severity === 'critical')
  const warnings = failures.filter(f => f.severity === 'warning')

  const errorRate = metrics.successCount > 0
    ? metrics.errorCount / (metrics.errorCount + metrics.successCount)
    : 0

  const lines = [
    `=== SOAK TEST SUMMARY ===`,
    `Duration: ${test.duration}`,
    `Status: ${test.status}`,
    ``,
    `Memory:`,
    `  Peak: ${metrics.memoryPeakMB}MB`,
    `  Growth: ${metrics.memoryGrowthMB}MB`,
    ``,
    `Stability:`,
    `  Reconnects: ${metrics.reconnectCount}`,
    `  WS Reconnects: ${metrics.wsReconnectCount}`,
    `  Worker Recoveries: ${metrics.workerRecoveries}`,
    ``,
    `Operations:`,
    `  Success: ${metrics.successCount}`,
    `  Errors: ${metrics.errorCount}`,
    `  Error Rate: ${(errorRate * 100).toFixed(2)}%`,
    ``,
    `Issues:`,
    `  Critical: ${criticalFailures.length}`,
    `  Warnings: ${warnings.length}`
  ]

  return lines.join('\n')
}

/**
 * Get memory usage in MB
 */
function getMemoryUsageMB(): number {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
  }
  return 0
}

/**
 * Format duration
 */
function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  return `${hours}h${minutes}m`
}

/**
 * Get current test status
 */
export function getSoakTestStatus(): {
  running: boolean
  currentTest?: SoakTestResult
  historyCount: number
} {
  return {
    running: testState.running,
    currentTest: testState.currentTest,
    historyCount: testState.history.length
  }
}

/**
 * Get test history
 */
export function getSoakTestHistory(limit = 10): SoakTestResult[] {
  return testState.history.slice(-limit)
}

/**
 * Stop current test
 */
export function stopSoakTest(): SoakTestResult | undefined {
  if (!testState.running) return undefined
  return endSoakTest('stopped')
}
