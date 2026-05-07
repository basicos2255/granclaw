/**
 * Runtime Event Bridge
 * P1.2: Realtime Product Shell & WS Runtime
 *
 * Bridges the EventBus to WebSocket gateway for realtime event streaming.
 */

import { eventBus, type RuntimeEvent, type EventCategory } from '../observability/events'
import { getWsGateway } from './gateway'
import type {
  WsChannel,
  RuntimeEventType,
  WorkflowEventPayload,
  NodeEventPayload,
  QueueEventPayload,
  RuntimeEventPayload
} from './types'

/**
 * Map EventBus category to WS channel
 */
function categoryToChannel(category: EventCategory): WsChannel {
  switch (category) {
    case 'queue':
      return 'queue'
    case 'dag':
      return 'runtime' // DAG events go to runtime channel
    case 'resource':
    case 'lock':
    case 'system':
      return 'runtime'
    case 'error':
      return 'debug'
    case 'audit':
      return 'runtime'
    default:
      return 'runtime'
  }
}

/**
 * Map EventBus event type to WS RuntimeEventType
 */
function mapEventType(category: EventCategory, type: string): RuntimeEventType {
  // Queue events
  if (category === 'queue') {
    switch (type) {
      case 'job-enqueued': return 'queue:job-enqueued'
      case 'job-started': return 'queue:job-started'
      case 'job-progress': return 'queue:job-progress'
      case 'job-completed': return 'queue:job-completed'
      case 'job-failed': return 'queue:job-failed'
      case 'job-retrying': return 'queue:job-retrying'
      case 'job-dead-lettered': return 'queue:job-dead-lettered'
      case 'pressure-change': return 'queue:pressure-change'
      default: return `queue:job-${type}` as RuntimeEventType
    }
  }

  // DAG events
  if (category === 'dag') {
    switch (type) {
      case 'graph-created': return 'workflow:created'
      case 'graph-started': return 'workflow:start'
      case 'graph-progress': return 'workflow:progress'
      case 'graph-completed': return 'workflow:complete'
      case 'graph-failed': return 'workflow:failed'
      case 'graph-cancelled': return 'workflow:cancelled'
      case 'node-started': return 'node:start'
      case 'node-progress': return 'node:progress'
      case 'node-completed': return 'node:complete'
      case 'node-failed': return 'node:failed'
      case 'node-retry': return 'node:retry'
      case 'node-skipped': return 'node:skipped'
      default: return `workflow:${type}` as RuntimeEventType
    }
  }

  // System events
  if (category === 'system') {
    switch (type) {
      case 'health-change': return 'system:health-change'
      case 'resource-warning': return 'system:resource-warning'
      default: return `system:${type}` as RuntimeEventType
    }
  }

  // Error events
  if (category === 'error') {
    return 'debug:trace'
  }

  // Default
  return `debug:trace` as RuntimeEventType
}

/**
 * Transform EventBus event to WS payload
 */
function transformToPayload(event: RuntimeEvent): RuntimeEventPayload {
  const basePayload: RuntimeEventPayload = {
    timestamp: event.timestamp,
    source: event.source
  }

  // For workflow/DAG events
  if (event.category === 'dag') {
    const workflowPayload: Partial<WorkflowEventPayload> = {
      ...basePayload,
      workflowId: event.entityId || event.data?.graphId as string || '',
      graphId: event.data?.graphId as string,
      status: event.data?.status as string || event.type,
      progress: event.data?.progress as number,
      message: event.message,
      nodeCount: event.data?.nodeCount as number,
      completedNodes: event.data?.completedNodes as number,
      failedNodes: event.data?.failedNodes as number
    }

    // Node-specific data
    if (event.type.startsWith('node-')) {
      const nodePayload: Partial<NodeEventPayload> = {
        ...basePayload,
        workflowId: event.data?.graphId as string || '',
        nodeId: event.data?.nodeId as string || '',
        nodeName: event.data?.nodeName as string,
        nodeType: event.data?.nodeType as string || 'unknown',
        status: event.data?.status as string || event.type,
        progress: event.data?.progress as number,
        message: event.message,
        error: event.data?.error as string,
        retryCount: event.data?.retryCount as number,
        duration: event.durationMs
      }
      return nodePayload as RuntimeEventPayload
    }

    return workflowPayload as RuntimeEventPayload
  }

  // For queue events
  if (event.category === 'queue') {
    const queuePayload: Partial<QueueEventPayload> = {
      ...basePayload,
      jobId: event.entityId || event.data?.jobId as string || '',
      jobType: event.data?.jobType as string || 'unknown',
      status: event.data?.status as string || event.type,
      progress: event.data?.progress as number,
      message: event.message,
      error: event.data?.error as string,
      retryCount: event.data?.retryCount as number,
      queuePressure: event.data?.queuePressure as {
        pending: number
        running: number
        status: 'ok' | 'warning' | 'critical'
      }
    }
    return queuePayload as RuntimeEventPayload
  }

  // Generic payload for other events
  return {
    ...basePayload,
    ...event.data
  } as RuntimeEventPayload
}

/**
 * Event bridge state
 */
let subscriptionId: string | null = null
let isInitialized = false

/**
 * Initialize the event bridge
 * Subscribes to EventBus and forwards events to WS gateway
 */
export function initializeEventBridge(): void {
  if (isInitialized) {
    console.warn('[EventBridge] Already initialized')
    return
  }

  const gateway = getWsGateway()

  // Subscribe to all events
  subscriptionId = eventBus.subscribe({}, (event: RuntimeEvent) => {
    // Skip debug events unless explicitly enabled
    if (event.severity === 'debug') {
      // Only forward to debug channel
      const wsEvent = mapEventType(event.category, event.type)
      const payload = transformToPayload(event)

      gateway.broadcast('debug', wsEvent, payload, {
        tenantId: event.tenantId,
        userId: event.userId,
        workflowId: event.entityId,
        correlationId: event.correlationId
      })
      return
    }

    // Determine channel and event type
    const channel = categoryToChannel(event.category)
    const wsEvent = mapEventType(event.category, event.type)
    const payload = transformToPayload(event)

    // Broadcast to appropriate channel
    gateway.broadcast(channel, wsEvent, payload, {
      tenantId: event.tenantId,
      userId: event.userId,
      workflowId: event.entityId,
      correlationId: event.correlationId
    })

    // For workflow events, also send to workflow-specific channel
    if (event.category === 'dag' && event.entityId) {
      gateway.sendToWorkflow(
        event.entityId,
        wsEvent,
        payload,
        event.tenantId || ''
      )
    }
  })

  isInitialized = true
  console.log('[EventBridge] Initialized - forwarding EventBus events to WebSocket')
}

/**
 * Shutdown the event bridge
 */
export function shutdownEventBridge(): void {
  if (subscriptionId) {
    eventBus.unsubscribe(subscriptionId)
    subscriptionId = null
  }
  isInitialized = false
  console.log('[EventBridge] Shutdown')
}

/**
 * Check if bridge is initialized
 */
export function isEventBridgeInitialized(): boolean {
  return isInitialized
}

/**
 * Emit a custom event to WS clients (bypassing EventBus)
 */
export function emitToWs<T extends RuntimeEventPayload>(
  channel: WsChannel,
  event: RuntimeEventType,
  payload: T,
  options: {
    tenantId?: string
    userId?: string
    workflowId?: string
  } = {}
): number {
  const gateway = getWsGateway()
  return gateway.broadcast(channel, event, payload, options)
}

/**
 * Emit notification event
 */
export function emitNotification(
  tenantId: string,
  userId: string | undefined,
  notification: {
    id: string
    type: 'info' | 'warning' | 'error' | 'success' | 'action'
    title: string
    message: string
    actionUrl?: string
    actionLabel?: string
    persistent?: boolean
  }
): number {
  return emitToWs('notifications', 'notification:created', {
    timestamp: new Date().toISOString(),
    source: 'notification-service',
    notificationId: notification.id,
    ...notification
  }, { tenantId, userId })
}

/**
 * Emit approval required event
 */
export function emitApprovalRequired(
  tenantId: string,
  userId: string,
  approval: {
    id: string
    workflowId?: string
    nodeId?: string
    action: string
    reason: string
    expiresAt?: string
    metadata?: Record<string, unknown>
  }
): number {
  return emitToWs('notifications', 'approval:required', {
    timestamp: new Date().toISOString(),
    source: 'approval-service',
    approvalId: approval.id,
    ...approval,
    requiredBy: userId
  }, { tenantId, userId, workflowId: approval.workflowId })
}
