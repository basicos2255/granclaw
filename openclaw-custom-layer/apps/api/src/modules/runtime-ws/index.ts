/**
 * Runtime WebSocket Module
 * P1.2: Realtime Product Shell & WS Runtime
 *
 * Central WebSocket gateway for realtime runtime communication.
 */

// Types
export type {
  WsConnectionState,
  WsChannel,
  RuntimeEventType,
  WsFrame,
  WsSubscription,
  WsClientInfo,
  RuntimeEventPayload,
  WorkflowEventPayload,
  NodeEventPayload,
  QueueEventPayload,
  ApprovalEventPayload,
  NotificationEventPayload,
  WsGatewayConfig,
  WsGatewayStats
} from './types'

export { DEFAULT_WS_CONFIG } from './types'

// Gateway
export {
  RuntimeWsGateway,
  getWsGateway,
  initializeWsGateway
} from './gateway'

// Auth
export {
  authenticateWsConnection,
  canAccessWorkflow,
  canSubscribeToChannel,
  validateClientMessage,
  type WsAuthResult
} from './auth'

// Serializer
export {
  generateMessageId,
  createEventFrame,
  createAckFrame,
  createErrorFrame,
  createPingFrame,
  createPongFrame,
  serializeFrame,
  deserializeFrame,
  truncateForLog,
  extractRoutingInfo,
  isForTenant,
  isForUser,
  isForWorkflow
} from './serializer'

// Subscriptions
export { SubscriptionManager } from './subscriptions'

// Event Bridge
export {
  initializeEventBridge,
  shutdownEventBridge,
  isEventBridgeInitialized,
  emitToWs,
  emitNotification,
  emitApprovalRequired
} from './event-bridge'
