/**
 * Runtime WebSocket Types
 * P1.2: Realtime Product Shell & WS Runtime
 *
 * Core type definitions for the realtime WebSocket system.
 */

import type { WebSocket as WsWebSocket } from 'ws'

/**
 * WebSocket connection state
 */
export type WsConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'degraded'

/**
 * WebSocket channel types
 */
export type WsChannel =
  | 'runtime'      // /ws/runtime - global runtime events
  | 'queue'        // /ws/queue - queue events
  | 'workflow'     // /ws/workflows/:id - specific workflow events
  | 'notifications'// /ws/notifications - user notifications
  | 'debug'        // /ws/debug - debug events

/**
 * Runtime event types emitted via WebSocket
 */
export type RuntimeEventType =
  // Workflow lifecycle
  | 'workflow:created'
  | 'workflow:start'
  | 'workflow:progress'
  | 'workflow:complete'
  | 'workflow:failed'
  | 'workflow:cancelled'
  // Node lifecycle
  | 'node:start'
  | 'node:progress'
  | 'node:complete'
  | 'node:failed'
  | 'node:retry'
  | 'node:skipped'
  // Queue events
  | 'queue:job-enqueued'
  | 'queue:job-started'
  | 'queue:job-progress'
  | 'queue:job-completed'
  | 'queue:job-failed'
  | 'queue:job-retrying'
  | 'queue:job-dead-lettered'
  | 'queue:pressure-change'
  // Validation & setup
  | 'validation:failed'
  | 'setup:required'
  | 'reauth:required'
  // Repair
  | 'repair:started'
  | 'repair:progress'
  | 'repair:completed'
  | 'repair:failed'
  // Approvals
  | 'approval:required'
  | 'approval:granted'
  | 'approval:denied'
  | 'approval:timeout'
  // Notifications
  | 'notification:created'
  | 'notification:updated'
  | 'notification:dismissed'
  // System
  | 'system:health-change'
  | 'system:resource-warning'
  // Debug
  | 'debug:trace'
  | 'debug:metric'

/**
 * WebSocket message frame
 */
export interface WsFrame<T = unknown> {
  /** Message ID for correlation */
  id: string
  /** Message type */
  type: 'event' | 'subscribe' | 'unsubscribe' | 'ack' | 'error' | 'ping' | 'pong'
  /** Channel (for subscribe/unsubscribe) */
  channel?: WsChannel
  /** Event type (for event messages) */
  event?: RuntimeEventType
  /** Payload data */
  payload?: T
  /** Timestamp */
  timestamp: string
  /** Tenant ID (for routing) */
  tenantId?: string
  /** User ID (for user-scoped events) */
  userId?: string
  /** Workflow ID (for workflow-scoped events) */
  workflowId?: string
  /** Correlation ID for tracing */
  correlationId?: string
}

/**
 * Subscription request
 */
export interface WsSubscription {
  /** Unique subscription ID */
  id: string
  /** Channel to subscribe */
  channel: WsChannel
  /** Optional workflow ID for workflow channel */
  workflowId?: string
  /** Filter events by type */
  eventTypes?: RuntimeEventType[]
  /** Tenant ID */
  tenantId: string
  /** User ID */
  userId: string
}

/**
 * Client connection info
 */
export interface WsClientInfo {
  /** Connection ID */
  id: string
  /** WebSocket instance */
  socket: WsWebSocket
  /** Tenant ID */
  tenantId: string
  /** User ID */
  userId: string
  /** Connection state */
  state: WsConnectionState
  /** Active subscriptions */
  subscriptions: Map<string, WsSubscription>
  /** Connected at */
  connectedAt: string
  /** Last activity */
  lastActivityAt: string
  /** Last heartbeat received */
  lastHeartbeatAt?: string
  /** Missed heartbeats count */
  missedHeartbeats: number
}

/**
 * Runtime event payload base
 */
export interface RuntimeEventPayload {
  /** Event timestamp */
  timestamp: string
  /** Source module */
  source: string
}

/**
 * Workflow event payload
 */
export interface WorkflowEventPayload extends RuntimeEventPayload {
  workflowId: string
  graphId?: string
  status: string
  progress?: number
  message?: string
  nodeCount?: number
  completedNodes?: number
  failedNodes?: number
}

/**
 * Node event payload
 */
export interface NodeEventPayload extends RuntimeEventPayload {
  workflowId: string
  nodeId: string
  nodeName?: string
  nodeType: string
  status: string
  progress?: number
  message?: string
  error?: string
  retryCount?: number
  duration?: number
}

/**
 * Queue event payload
 */
export interface QueueEventPayload extends RuntimeEventPayload {
  jobId: string
  jobType: string
  status: string
  progress?: number
  message?: string
  error?: string
  retryCount?: number
  queuePressure?: {
    pending: number
    running: number
    status: 'ok' | 'warning' | 'critical'
  }
}

/**
 * Approval event payload
 */
export interface ApprovalEventPayload extends RuntimeEventPayload {
  approvalId: string
  workflowId?: string
  nodeId?: string
  action: string
  reason: string
  requiredBy: string
  expiresAt?: string
  metadata?: Record<string, unknown>
}

/**
 * Notification event payload
 */
export interface NotificationEventPayload extends RuntimeEventPayload {
  notificationId: string
  type: 'info' | 'warning' | 'error' | 'success' | 'action'
  title: string
  message: string
  actionUrl?: string
  actionLabel?: string
  persistent?: boolean
  expiresAt?: string
}

/**
 * Gateway configuration
 */
export interface WsGatewayConfig {
  /** Heartbeat interval in ms */
  heartbeatIntervalMs: number
  /** Heartbeat timeout in ms */
  heartbeatTimeoutMs: number
  /** Max missed heartbeats before disconnect */
  maxMissedHeartbeats: number
  /** Connection timeout in ms */
  connectionTimeoutMs: number
  /** Max connections per tenant */
  maxConnectionsPerTenant: number
  /** Max subscriptions per connection */
  maxSubscriptionsPerConnection: number
  /** Message queue size per client */
  messageQueueSize: number
  /** Enable debug channel */
  enableDebugChannel: boolean
}

/**
 * Default gateway configuration
 */
export const DEFAULT_WS_CONFIG: WsGatewayConfig = {
  heartbeatIntervalMs: 30000,
  heartbeatTimeoutMs: 10000,
  maxMissedHeartbeats: 3,
  connectionTimeoutMs: 5000,
  maxConnectionsPerTenant: 50,
  maxSubscriptionsPerConnection: 20,
  messageQueueSize: 100,
  enableDebugChannel: true
}

/**
 * Gateway statistics
 */
export interface WsGatewayStats {
  /** Total active connections */
  activeConnections: number
  /** Connections by tenant */
  connectionsByTenant: Record<string, number>
  /** Total subscriptions */
  totalSubscriptions: number
  /** Subscriptions by channel */
  subscriptionsByChannel: Record<WsChannel, number>
  /** Messages sent in last minute */
  messagesSentLastMinute: number
  /** Messages received in last minute */
  messagesReceivedLastMinute: number
  /** Average latency ms */
  avgLatencyMs: number
  /** Errors in last minute */
  errorsLastMinute: number
}
