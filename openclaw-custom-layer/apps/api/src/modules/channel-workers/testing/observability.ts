/**
 * Observability Hardening
 * P5.1: Controlled Real Testing & Connector Hardening
 *
 * Metrics for monitoring worker health and stability.
 */

/**
 * Metric types
 */
export type MetricType = 'counter' | 'gauge' | 'histogram'

/**
 * Metric definition
 */
export interface MetricDefinition {
  name: string
  type: MetricType
  help: string
  labels?: string[]
}

/**
 * Metric value
 */
export interface MetricValue {
  name: string
  value: number
  labels?: Record<string, string>
  timestamp: number
}

/**
 * Histogram bucket
 */
export interface HistogramBucket {
  le: number
  count: number
}

/**
 * Observability metrics registry
 */
interface MetricsRegistry {
  counters: Map<string, number>
  gauges: Map<string, number>
  histograms: Map<string, HistogramBucket[]>
  labels: Map<string, Record<string, string>>
}

const registry: MetricsRegistry = {
  counters: new Map(),
  gauges: new Map(),
  histograms: new Map(),
  labels: new Map()
}

/**
 * P5.1 Metric definitions
 */
export const METRICS: Record<string, MetricDefinition> = {
  // Worker metrics
  WORKER_RECONNECT_TOTAL: {
    name: 'granclaw_worker_reconnect_total',
    type: 'counter',
    help: 'Total number of worker reconnections',
    labels: ['channel_type', 'worker_id']
  },
  WORKER_RECONNECT_RATE: {
    name: 'granclaw_worker_reconnect_rate',
    type: 'gauge',
    help: 'Worker reconnections per minute',
    labels: ['channel_type']
  },

  // Workflow metrics
  WORKFLOW_SUCCESS_TOTAL: {
    name: 'granclaw_workflow_success_total',
    type: 'counter',
    help: 'Total successful workflow executions',
    labels: ['workflow_id']
  },
  WORKFLOW_FAILURE_TOTAL: {
    name: 'granclaw_workflow_failure_total',
    type: 'counter',
    help: 'Total failed workflow executions',
    labels: ['workflow_id']
  },
  WORKFLOW_SUCCESS_RATE: {
    name: 'granclaw_workflow_success_rate',
    type: 'gauge',
    help: 'Workflow success rate (0-1)',
    labels: ['workflow_id']
  },

  // Queue metrics
  QUEUE_LAG_SECONDS: {
    name: 'granclaw_queue_lag_seconds',
    type: 'gauge',
    help: 'Queue processing lag in seconds'
  },
  QUEUE_SIZE: {
    name: 'granclaw_queue_size',
    type: 'gauge',
    help: 'Current queue size'
  },

  // WebSocket metrics
  WS_RECONNECT_TOTAL: {
    name: 'granclaw_ws_reconnect_total',
    type: 'counter',
    help: 'Total WebSocket reconnections'
  },
  WS_CONNECTED: {
    name: 'granclaw_ws_connected',
    type: 'gauge',
    help: 'WebSocket connection status (1=connected, 0=disconnected)'
  },

  // Validation metrics
  VALIDATION_FAILURE_TOTAL: {
    name: 'granclaw_validation_failure_total',
    type: 'counter',
    help: 'Total validation failures',
    labels: ['validation_type']
  },
  VALIDATION_FAILURE_RATE: {
    name: 'granclaw_validation_failure_rate',
    type: 'gauge',
    help: 'Validation failure rate (0-1)'
  },

  // Browser metrics
  BROWSER_CRASH_TOTAL: {
    name: 'granclaw_browser_crash_total',
    type: 'counter',
    help: 'Total browser crashes'
  },
  BROWSER_MEMORY_MB: {
    name: 'granclaw_browser_memory_mb',
    type: 'gauge',
    help: 'Browser memory usage in MB'
  },

  // Health metrics
  WORKERS_HEALTHY: {
    name: 'granclaw_workers_healthy',
    type: 'gauge',
    help: 'Number of healthy workers'
  },
  WORKERS_DEGRADED: {
    name: 'granclaw_workers_degraded',
    type: 'gauge',
    help: 'Number of degraded workers'
  },
  WORKERS_FAILED: {
    name: 'granclaw_workers_failed',
    type: 'gauge',
    help: 'Number of failed workers'
  }
}

/**
 * Increment counter
 */
export function incrementCounter(
  name: string,
  value = 1,
  labels?: Record<string, string>
): void {
  const key = buildKey(name, labels)
  const current = registry.counters.get(key) ?? 0
  registry.counters.set(key, current + value)

  if (labels) {
    registry.labels.set(key, labels)
  }
}

/**
 * Set gauge
 */
export function setGauge(
  name: string,
  value: number,
  labels?: Record<string, string>
): void {
  const key = buildKey(name, labels)
  registry.gauges.set(key, value)

  if (labels) {
    registry.labels.set(key, labels)
  }
}

/**
 * Observe histogram
 */
export function observeHistogram(
  name: string,
  value: number,
  buckets: number[] = [0.1, 0.5, 1, 2, 5, 10, 30, 60]
): void {
  const existing = registry.histograms.get(name) ?? buckets.map(le => ({
    le,
    count: 0
  }))

  for (const bucket of existing) {
    if (value <= bucket.le) {
      bucket.count++
    }
  }

  registry.histograms.set(name, existing)
}

/**
 * Build metric key with labels
 */
function buildKey(name: string, labels?: Record<string, string>): string {
  if (!labels) return name

  const labelStr = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v}"`)
    .join(',')

  return `${name}{${labelStr}}`
}

/**
 * Get counter value
 */
export function getCounter(
  name: string,
  labels?: Record<string, string>
): number {
  const key = buildKey(name, labels)
  return registry.counters.get(key) ?? 0
}

/**
 * Get gauge value
 */
export function getGauge(
  name: string,
  labels?: Record<string, string>
): number {
  const key = buildKey(name, labels)
  return registry.gauges.get(key) ?? 0
}

/**
 * Get all metrics in Prometheus format
 */
export function getMetricsPrometheus(): string {
  const lines: string[] = []

  // Counters
  for (const [key, value] of registry.counters) {
    const { name, labels } = parseKey(key)
    const def = Object.values(METRICS).find(m => m.name === name)

    if (def) {
      lines.push(`# HELP ${def.name} ${def.help}`)
      lines.push(`# TYPE ${def.name} counter`)
    }

    if (labels) {
      lines.push(`${name}{${formatLabels(labels)}} ${value}`)
    } else {
      lines.push(`${name} ${value}`)
    }
  }

  // Gauges
  for (const [key, value] of registry.gauges) {
    const { name, labels } = parseKey(key)
    const def = Object.values(METRICS).find(m => m.name === name)

    if (def) {
      lines.push(`# HELP ${def.name} ${def.help}`)
      lines.push(`# TYPE ${def.name} gauge`)
    }

    if (labels) {
      lines.push(`${name}{${formatLabels(labels)}} ${value}`)
    } else {
      lines.push(`${name} ${value}`)
    }
  }

  // Histograms
  for (const [name, buckets] of registry.histograms) {
    const def = Object.values(METRICS).find(m => m.name === name)

    if (def) {
      lines.push(`# HELP ${def.name} ${def.help}`)
      lines.push(`# TYPE ${def.name} histogram`)
    }

    for (const bucket of buckets) {
      lines.push(`${name}_bucket{le="${bucket.le}"} ${bucket.count}`)
    }
    lines.push(`${name}_bucket{le="+Inf"} ${buckets[buckets.length - 1]?.count ?? 0}`)
  }

  return lines.join('\n')
}

/**
 * Parse metric key
 */
function parseKey(key: string): {
  name: string
  labels?: Record<string, string>
} {
  const match = key.match(/^([^{]+)(?:\{(.+)\})?$/)
  if (!match) return { name: key }

  const name = match[1]
  const labelStr = match[2]

  if (!labelStr) return { name }

  const labels: Record<string, string> = {}
  const labelMatches = labelStr.matchAll(/(\w+)="([^"]+)"/g)

  for (const m of labelMatches) {
    labels[m[1]] = m[2]
  }

  return { name, labels }
}

/**
 * Format labels for Prometheus
 */
function formatLabels(labels: Record<string, string>): string {
  return Object.entries(labels)
    .map(([k, v]) => `${k}="${v}"`)
    .join(',')
}

/**
 * Get metrics summary
 */
export function getMetricsSummary(): {
  counters: Record<string, number>
  gauges: Record<string, number>
  histogramCount: number
} {
  return {
    counters: Object.fromEntries(registry.counters),
    gauges: Object.fromEntries(registry.gauges),
    histogramCount: registry.histograms.size
  }
}

/**
 * Reset all metrics
 */
export function resetMetrics(): void {
  registry.counters.clear()
  registry.gauges.clear()
  registry.histograms.clear()
  registry.labels.clear()
}

/**
 * Record worker reconnect
 */
export function recordWorkerReconnect(
  channelType: string,
  workerId: string
): void {
  incrementCounter(METRICS.WORKER_RECONNECT_TOTAL.name, 1, {
    channel_type: channelType,
    worker_id: workerId
  })
}

/**
 * Record workflow result
 */
export function recordWorkflowResult(
  workflowId: string,
  success: boolean
): void {
  if (success) {
    incrementCounter(METRICS.WORKFLOW_SUCCESS_TOTAL.name, 1, { workflow_id: workflowId })
  } else {
    incrementCounter(METRICS.WORKFLOW_FAILURE_TOTAL.name, 1, { workflow_id: workflowId })
  }
}

/**
 * Update queue metrics
 */
export function updateQueueMetrics(
  queueSize: number,
  lagSeconds: number
): void {
  setGauge(METRICS.QUEUE_SIZE.name, queueSize)
  setGauge(METRICS.QUEUE_LAG_SECONDS.name, lagSeconds)
}

/**
 * Update worker health metrics
 */
export function updateWorkerHealthMetrics(
  healthy: number,
  degraded: number,
  failed: number
): void {
  setGauge(METRICS.WORKERS_HEALTHY.name, healthy)
  setGauge(METRICS.WORKERS_DEGRADED.name, degraded)
  setGauge(METRICS.WORKERS_FAILED.name, failed)
}
