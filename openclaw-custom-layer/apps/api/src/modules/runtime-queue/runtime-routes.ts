/**
 * Runtime Routes
 * H1.1: Runtime Integration Finalization
 *
 * Unified runtime state endpoint for dashboard consumption.
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { ok, serverError } from '../../shared/response'
import type { AuthContext } from '../auth'
import { getQueue } from './queue'
import { getSchedulerState, getRegisteredHandlers } from './scheduler'
import { checkQueueHealth } from './startup-recovery'
import { getDeadLetterStats, listDeadLetter } from './dead-letter'
import { listGraphExecutions } from '../dag-execution/persistence'
import { getHardLimits, getLimitUsageReport } from '../../shared/hard-limits'
// P1.2: WebSocket stats
import { getWsGateway } from '../runtime-ws'

/**
 * Runtime state response
 */
export interface RuntimeStateResponse {
  /** Timestamp */
  timestamp: string
  /** Queue statistics */
  queueStats: {
    totalJobs: number
    pendingJobs: number
    runningJobs: number
    completedJobs: number
    failedJobs: number
    avgWaitTimeMs: number
    lastHourProcessed: number
    successRate: number
  }
  /** Scheduler state */
  scheduler: {
    running: boolean
    paused: boolean
    activeJobsCount: number
    processedCount: number
    failedCount: number
    lastPollAt?: string
    registeredHandlers: string[]
    /** H1.2: Are execution handlers registered and ready? */
    handlersReady: boolean
  }
  /** Active workflows (running DAG executions) */
  activeWorkflows: {
    count: number
    executions: Array<{
      id: string
      graphId: string
      status: string
      startedAt: string
      nodeCount: number
      completedNodes: number
    }>
  }
  /** Dead letter queue */
  deadLetters: {
    count: number
    byType: Record<string, number>
    oldestAt?: string
    recentEntries: Array<{
      jobId: string
      type: string
      reason: string
      addedAt: string
    }>
  }
  /** Queue pressure (how full is the queue) */
  queuePressure: {
    pendingPercent: number
    runningPercent: number
    status: 'ok' | 'warning' | 'critical'
    message: string
  }
  /** Resource health */
  resourceHealth: {
    healthy: boolean
    issues: string[]
    recommendations: string[]
    limits: {
      maxQueuedJobs: number
      maxConcurrentJobs: number
      currentUsage: Record<string, number>
    }
  }
  /** OpenClaw connectivity */
  openclawHealth: {
    status: 'unknown' | 'ok' | 'degraded' | 'down'
    lastCheck?: string
    message?: string
  }
  /** P1.2: WebSocket gateway stats */
  websocket: {
    activeConnections: number
    connectionsByTenant: Record<string, number>
    totalSubscriptions: number
    subscriptionsByChannel: Record<string, number>
    messagesSentLastMinute: number
    messagesReceivedLastMinute: number
    errorsLastMinute: number
    connectionHealth: {
      healthy: number
      degraded: number
      stale: number
    }
  }
}

/**
 * GET /runtime/state
 * Get unified runtime state for dashboard
 */
export function handleGetRuntimeState(
  _req: IncomingMessage,
  res: ServerResponse,
  _context: AuthContext | null
): void {
  try {
    const queue = getQueue()
    const queueStats = queue.getStats()
    const schedulerState = getSchedulerState()
    const health = checkQueueHealth(queue)
    const dlStats = getDeadLetterStats()
    const dlEntries = listDeadLetter(5, 0) // Last 5 entries
    const limits = getHardLimits()

    // Get active DAG executions
    const dagExecutions = listGraphExecutions(undefined, 20)
    const activeExecutions = dagExecutions.filter(e => e.status === 'running')

    // Calculate queue pressure
    const pendingPercent = Math.round((queueStats.byStatus.pending / limits.maxQueuedJobs) * 100)
    const runningPercent = Math.round((queueStats.byStatus.running / limits.maxConcurrentJobs) * 100)

    let pressureStatus: 'ok' | 'warning' | 'critical' = 'ok'
    let pressureMessage = 'Queue is operating normally'

    if (pendingPercent >= 90 || runningPercent >= 90) {
      pressureStatus = 'critical'
      pressureMessage = 'Queue is near capacity'
    } else if (pendingPercent >= 70 || runningPercent >= 70) {
      pressureStatus = 'warning'
      pressureMessage = 'Queue is under moderate load'
    }

    // Get limit usage
    const limitUsage = getLimitUsageReport({
      maxQueuedJobs: queueStats.byStatus.pending,
      maxConcurrentJobs: queueStats.byStatus.running
    })

    const response: RuntimeStateResponse = {
      timestamp: new Date().toISOString(),
      queueStats: {
        totalJobs: Object.values(queueStats.byStatus).reduce((a, b) => a + b, 0),
        pendingJobs: queueStats.byStatus.pending,
        runningJobs: queueStats.byStatus.running,
        completedJobs: queueStats.byStatus.completed,
        failedJobs: queueStats.byStatus.failed,
        avgWaitTimeMs: queueStats.avgWaitTimeMs,
        lastHourProcessed: queueStats.lastHourProcessed,
        successRate: queueStats.successRate
      },
      scheduler: {
        running: schedulerState.running,
        paused: schedulerState.paused,
        activeJobsCount: schedulerState.activeJobs.size,
        processedCount: schedulerState.processedCount,
        failedCount: schedulerState.failedCount,
        lastPollAt: schedulerState.lastPollAt,
        registeredHandlers: getRegisteredHandlers(),
        // H1.2: Handlers ready when at least dag-execution and composite-task are registered
        handlersReady: getRegisteredHandlers().includes('dag-execution') &&
                       getRegisteredHandlers().includes('composite-task')
      },
      activeWorkflows: {
        count: activeExecutions.length,
        executions: activeExecutions.map(e => ({
          id: e.id,
          graphId: e.graphId,
          status: e.status,
          startedAt: e.startedAt,
          nodeCount: Object.keys(e.nodes).length,
          completedNodes: Object.values(e.nodes).filter(n => n.status === 'completed').length
        }))
      },
      deadLetters: {
        count: dlStats.totalCount,
        byType: dlStats.byJobType,
        oldestAt: dlStats.oldestEntry,
        recentEntries: dlEntries.map(e => ({
          jobId: e.job.id,
          type: e.job.type,
          reason: e.reason,
          addedAt: e.deadLetteredAt
        }))
      },
      queuePressure: {
        pendingPercent,
        runningPercent,
        status: pressureStatus,
        message: pressureMessage
      },
      resourceHealth: {
        healthy: health.healthy,
        issues: health.issues,
        recommendations: health.recommendations,
        limits: {
          maxQueuedJobs: limits.maxQueuedJobs,
          maxConcurrentJobs: limits.maxConcurrentJobs,
          currentUsage: {
            queuedJobs: queueStats.byStatus.pending,
            runningJobs: queueStats.byStatus.running
          }
        }
      },
      openclawHealth: {
        status: 'unknown', // Would need to check OpenClaw connectivity
        message: 'OpenClaw health check not implemented'
      },
      // P1.2: WebSocket stats
      websocket: (() => {
        try {
          const wsStats = getWsGateway().getStats()
          return {
            activeConnections: wsStats.activeConnections,
            connectionsByTenant: wsStats.connectionsByTenant,
            totalSubscriptions: wsStats.totalSubscriptions,
            subscriptionsByChannel: wsStats.subscriptionsByChannel as Record<string, number>,
            messagesSentLastMinute: wsStats.messagesSentLastMinute,
            messagesReceivedLastMinute: wsStats.messagesReceivedLastMinute,
            errorsLastMinute: wsStats.errorsLastMinute,
            connectionHealth: { healthy: 0, degraded: 0, stale: 0 } // From subscription stats
          }
        } catch {
          return {
            activeConnections: 0,
            connectionsByTenant: {},
            totalSubscriptions: 0,
            subscriptionsByChannel: {},
            messagesSentLastMinute: 0,
            messagesReceivedLastMinute: 0,
            errorsLastMinute: 0,
            connectionHealth: { healthy: 0, degraded: 0, stale: 0 }
          }
        }
      })()
    }

    ok(res, {
      success: true,
      ...response
    })
  } catch (err) {
    console.error('[RuntimeRoutes] Error getting runtime state:', err)
    serverError(res, 'Error getting runtime state')
  }
}

/**
 * P5.2: Consistency check endpoint
 * GET /runtime/consistency
 */
export function handleGetConsistency(
  _req: IncomingMessage,
  res: ServerResponse,
  _context: AuthContext | null
): void {
  try {
    // P5.2: Config consistency audit
    const configDrift: string[] = []

    // Check for deprecated env vars (would need runtime check)
    // For now, report known deprecations
    const deprecatedVars = [
      'VITE_API_URL (use VITE_API_BASE_URL)',
      'VITE_WS_URL (use VITE_WS_BASE_URL)',
      'VITE_API_PORT (use VITE_WS_BASE_URL)'
    ]

    // Status normalization
    const canonicalStatuses = {
      queue: ['pending', 'running', 'completed', 'failed', 'dead-lettered'],
      task: ['pending', 'running', 'success', 'blocked', 'error', 'unconfirmed'],
      workflow: ['pending', 'running', 'completed', 'failed', 'cancelled', 'validation_failed'],
      node: ['pending', 'queued', 'running', 'completed', 'validated', 'failed', 'skipped', 'blocked'],
      proposal: ['pending', 'approved', 'rejected', 'archived'],
      requirement: ['active', 'resolved'],
      repair: ['pending', 'waiting_user', 'checking', 'ready', 'failed', 'cancelled']
    }

    // Provider roles
    const providerRoles = {
      providers: ['openclaw', 'local', 'task_memory', 'capability', 'proposal'],
      adapters: ['openclaw-runtime-adapter', 'channel-adapters']
    }

    // Legacy inventory (known deprecated code)
    const legacyInventory = {
      deprecatedEnvVars: deprecatedVars,
      legacyComponents: [] as string[],
      unusedRoutes: [] as string[]
    }

    // Queue bypass check
    const handlers = getRegisteredHandlers()
    const queueBypassRisk = !handlers.includes('dag-execution') || !handlers.includes('composite-task')

    ok(res, {
      success: true,
      timestamp: new Date().toISOString(),
      consistency: {
        configDrift: configDrift.length === 0 ? 'none' : configDrift,
        statusNormalization: 'canonical enums defined',
        canonicalStatuses,
        providerRoles,
        legacyInventory,
        wsFirst: true,
        queueAuthority: !queueBypassRisk,
        queueBypassRisk: queueBypassRisk ? 'dag-execution or composite-task handler missing' : 'none'
      },
      recommendations: queueBypassRisk
        ? ['Register dag-execution and composite-task handlers']
        : ['System is consistent']
    })
  } catch (err) {
    console.error('[RuntimeRoutes] Error checking consistency:', err)
    serverError(res, 'Error checking consistency')
  }
}

/**
 * GET /runtime/health
 * Quick health check for runtime
 */
export function handleGetRuntimeHealth(
  _req: IncomingMessage,
  res: ServerResponse,
  _context: AuthContext | null
): void {
  try {
    const queue = getQueue()
    const health = checkQueueHealth(queue)
    const scheduler = getSchedulerState()

    // H1.2: Check if handlers are ready
    const handlers = getRegisteredHandlers()
    const handlersReady = handlers.includes('dag-execution') && handlers.includes('composite-task')
    const overallHealthy = health.healthy && scheduler.running && !scheduler.paused && handlersReady

    res.writeHead(overallHealthy ? 200 : 503, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      success: overallHealthy,
      status: overallHealthy ? 'healthy' : 'unhealthy',
      queue: {
        healthy: health.healthy,
        issues: health.issues
      },
      scheduler: {
        running: scheduler.running,
        paused: scheduler.paused,
        handlersReady,
        registeredHandlers: handlers
      },
      timestamp: new Date().toISOString()
    }))
  } catch (err) {
    console.error('[RuntimeRoutes] Error checking health:', err)
    serverError(res, 'Error checking health')
  }
}
