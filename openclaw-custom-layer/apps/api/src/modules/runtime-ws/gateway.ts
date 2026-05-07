/**
 * Runtime WebSocket Gateway
 * P1.2: Realtime Product Shell & WS Runtime
 *
 * Main WebSocket gateway for realtime runtime communication.
 */

import { WebSocketServer, WebSocket } from 'ws'
import type { Server, IncomingMessage } from 'http'
import type {
  WsChannel,
  WsFrame,
  WsClientInfo,
  WsSubscription,
  WsGatewayConfig,
  WsGatewayStats,
  RuntimeEventType,
  RuntimeEventPayload
} from './types'
import { DEFAULT_WS_CONFIG } from './types'
import { authenticateWsConnection } from './auth'
import { SubscriptionManager } from './subscriptions'
import {
  serializeFrame,
  deserializeFrame,
  createEventFrame,
  createAckFrame,
  createErrorFrame,
  createPongFrame,
  generateMessageId,
  truncateForLog
} from './serializer'

/**
 * Runtime WebSocket Gateway
 */
export class RuntimeWsGateway {
  private wss: WebSocketServer | null = null
  private subscriptions: SubscriptionManager
  private config: WsGatewayConfig
  private heartbeatInterval: NodeJS.Timeout | null = null
  private stats = {
    messagesSent: 0,
    messagesReceived: 0,
    errors: 0,
    messagesSentLastMinute: 0,
    messagesReceivedLastMinute: 0,
    errorsLastMinute: 0
  }
  private statsInterval: NodeJS.Timeout | null = null

  constructor(config: Partial<WsGatewayConfig> = {}) {
    this.config = { ...DEFAULT_WS_CONFIG, ...config }
    this.subscriptions = new SubscriptionManager(this.config)
  }

  /**
   * Initialize the WebSocket server
   */
  initialize(httpServer: Server): void {
    this.wss = new WebSocketServer({
      server: httpServer,
      path: '/ws'
    })

    this.wss.on('connection', (socket, request) => {
      this.handleConnection(socket, request)
    })

    this.wss.on('error', (err) => {
      console.error('[RuntimeWsGateway] Server error:', err)
      this.stats.errors++
    })

    // Start heartbeat checker
    this.startHeartbeatChecker()

    // Start stats reset interval
    this.startStatsInterval()

    console.log('[RuntimeWsGateway] Initialized on /ws')
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(socket: WebSocket, request: IncomingMessage): void {
    // Authenticate connection
    const authResult = authenticateWsConnection(request)

    if (!authResult.authenticated) {
      console.warn('[RuntimeWsGateway] Connection rejected:', authResult.error)
      socket.close(4001, authResult.error || 'Authentication failed')
      return
    }

    // Check tenant connection limit
    const tenantClients = this.subscriptions.getTenantClients(authResult.tenantId!)
    if (tenantClients.length >= this.config.maxConnectionsPerTenant) {
      console.warn('[RuntimeWsGateway] Tenant connection limit reached:', authResult.tenantId)
      socket.close(4002, 'Connection limit reached')
      return
    }

    // Create client info
    const clientId = generateMessageId()
    const client: WsClientInfo = {
      id: clientId,
      socket,
      tenantId: authResult.tenantId!,
      userId: authResult.userId!,
      state: 'connected',
      subscriptions: new Map(),
      connectedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      missedHeartbeats: 0
    }

    // Register client
    this.subscriptions.registerClient(client)

    console.log(`[RuntimeWsGateway] Client connected: ${clientId} (tenant: ${authResult.tenantId})`)

    // Set up message handler
    socket.on('message', (data) => {
      this.handleMessage(client, data.toString())
    })

    // Set up close handler
    socket.on('close', (code, reason) => {
      console.log(`[RuntimeWsGateway] Client disconnected: ${clientId} (code: ${code})`)
      this.subscriptions.unregisterClient(clientId)
    })

    // Set up error handler
    socket.on('error', (err) => {
      console.error(`[RuntimeWsGateway] Client error: ${clientId}`, err)
      this.stats.errors++
    })

    // Send welcome message
    this.sendToClient(client, createAckFrame(
      'connection',
      true,
      `Connected as ${clientId}`
    ))
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(client: WsClientInfo, data: string): void {
    this.stats.messagesReceived++
    this.stats.messagesReceivedLastMinute++
    client.lastActivityAt = new Date().toISOString()

    const frame = deserializeFrame(data)
    if (!frame) {
      this.sendToClient(client, createErrorFrame('INVALID_FRAME', 'Invalid message format'))
      return
    }

    switch (frame.type) {
      case 'subscribe':
        this.handleSubscribe(client, frame)
        break

      case 'unsubscribe':
        this.handleUnsubscribe(client, frame)
        break

      case 'ping':
        this.handlePing(client, frame)
        break

      case 'ack':
        // Client acknowledged our message, update activity
        break

      default:
        this.sendToClient(client, createErrorFrame(
          'UNKNOWN_TYPE',
          `Unknown message type: ${frame.type}`,
          frame.id
        ))
    }
  }

  /**
   * Handle subscribe request
   */
  private handleSubscribe(client: WsClientInfo, frame: WsFrame): void {
    const channel = frame.channel
    if (!channel) {
      this.sendToClient(client, createErrorFrame(
        'MISSING_CHANNEL',
        'Channel is required for subscribe',
        frame.id
      ))
      return
    }

    // Check debug channel
    if (channel === 'debug' && !this.config.enableDebugChannel) {
      this.sendToClient(client, createErrorFrame(
        'CHANNEL_DISABLED',
        'Debug channel is disabled',
        frame.id
      ))
      return
    }

    const subscription: WsSubscription = {
      id: generateMessageId(),
      channel,
      workflowId: frame.workflowId,
      eventTypes: (frame.payload as { eventTypes?: RuntimeEventType[] })?.eventTypes,
      tenantId: client.tenantId,
      userId: client.userId
    }

    const result = this.subscriptions.addSubscription(client.id, subscription)

    if (result.success) {
      console.log(`[RuntimeWsGateway] Subscription added: ${subscription.id} (${channel})`)
      this.sendToClient(client, createAckFrame(
        frame.id,
        true,
        `Subscribed to ${channel}`
      ))
    } else {
      this.sendToClient(client, createErrorFrame(
        'SUBSCRIBE_FAILED',
        result.error || 'Failed to subscribe',
        frame.id
      ))
    }
  }

  /**
   * Handle unsubscribe request
   */
  private handleUnsubscribe(client: WsClientInfo, frame: WsFrame): void {
    const subscriptionId = (frame.payload as { subscriptionId?: string })?.subscriptionId
    if (!subscriptionId) {
      this.sendToClient(client, createErrorFrame(
        'MISSING_SUBSCRIPTION_ID',
        'Subscription ID is required for unsubscribe',
        frame.id
      ))
      return
    }

    const removed = this.subscriptions.removeSubscription(subscriptionId)

    if (removed) {
      this.sendToClient(client, createAckFrame(frame.id, true, 'Unsubscribed'))
    } else {
      this.sendToClient(client, createErrorFrame(
        'SUBSCRIPTION_NOT_FOUND',
        'Subscription not found',
        frame.id
      ))
    }
  }

  /**
   * Handle ping request
   */
  private handlePing(client: WsClientInfo, frame: WsFrame): void {
    const timestamp = (frame.payload as { timestamp?: number })?.timestamp || Date.now()
    client.lastHeartbeatAt = new Date().toISOString()
    client.missedHeartbeats = 0
    this.sendToClient(client, createPongFrame(timestamp))
  }

  /**
   * Send a frame to a specific client
   */
  private sendToClient(client: WsClientInfo, frame: WsFrame): boolean {
    try {
      const socket = client.socket
      if (socket.readyState !== WebSocket.OPEN) {
        return false
      }

      socket.send(serializeFrame(frame))
      this.stats.messagesSent++
      this.stats.messagesSentLastMinute++
      return true
    } catch (err) {
      console.error(`[RuntimeWsGateway] Error sending to client ${client.id}:`, err)
      this.stats.errors++
      return false
    }
  }

  /**
   * Broadcast an event to all relevant subscribers
   */
  broadcast<T extends RuntimeEventPayload>(
    channel: WsChannel,
    event: RuntimeEventType,
    payload: T,
    options: {
      tenantId?: string
      userId?: string
      workflowId?: string
      correlationId?: string
    } = {}
  ): number {
    const frame = createEventFrame(event, payload, options)

    const targets = this.subscriptions.getTargetClients(channel, event, frame)
    let sent = 0

    for (const client of targets) {
      if (this.sendToClient(client, frame)) {
        sent++
      }
    }

    if (sent > 0) {
      console.log(`[RuntimeWsGateway] Broadcast ${event} to ${sent} clients`)
    }

    return sent
  }

  /**
   * Send event to specific workflow subscribers
   */
  sendToWorkflow<T extends RuntimeEventPayload>(
    workflowId: string,
    event: RuntimeEventType,
    payload: T,
    tenantId: string
  ): number {
    const frame = createEventFrame(event, payload, { workflowId, tenantId })

    const clients = this.subscriptions.getWorkflowClients(workflowId)
    let sent = 0

    for (const client of clients) {
      // Verify tenant isolation
      if (client.tenantId !== tenantId) continue

      if (this.sendToClient(client, frame)) {
        sent++
      }
    }

    return sent
  }

  /**
   * Send event to all clients of a tenant
   */
  sendToTenant<T extends RuntimeEventPayload>(
    tenantId: string,
    event: RuntimeEventType,
    payload: T
  ): number {
    const frame = createEventFrame(event, payload, { tenantId })

    const clients = this.subscriptions.getTenantClients(tenantId)
    let sent = 0

    for (const client of clients) {
      if (this.sendToClient(client, frame)) {
        sent++
      }
    }

    return sent
  }

  /**
   * Start heartbeat checker
   */
  private startHeartbeatChecker(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now()

      for (const client of this.subscriptions.getAllClients()) {
        const lastActivity = new Date(client.lastActivityAt).getTime()
        const timeSinceActivity = now - lastActivity

        if (timeSinceActivity > this.config.heartbeatTimeoutMs) {
          client.missedHeartbeats++

          if (client.missedHeartbeats >= this.config.maxMissedHeartbeats) {
            console.warn(`[RuntimeWsGateway] Client ${client.id} timed out, disconnecting`)
            client.socket.close(4003, 'Heartbeat timeout')
            this.subscriptions.unregisterClient(client.id)
          }
        }
      }
    }, this.config.heartbeatIntervalMs)
  }

  /**
   * Start stats interval
   */
  private startStatsInterval(): void {
    this.statsInterval = setInterval(() => {
      // Reset per-minute stats
      this.stats.messagesSentLastMinute = 0
      this.stats.messagesReceivedLastMinute = 0
      this.stats.errorsLastMinute = 0
    }, 60000)
  }

  /**
   * Get gateway statistics
   */
  getStats(): WsGatewayStats {
    const subStats = this.subscriptions.getStats()

    const connectionsByTenant: Record<string, number> = {}
    for (const client of this.subscriptions.getAllClients()) {
      connectionsByTenant[client.tenantId] = (connectionsByTenant[client.tenantId] || 0) + 1
    }

    return {
      activeConnections: this.subscriptions.getClientCount(),
      connectionsByTenant,
      totalSubscriptions: subStats.totalSubscriptions,
      subscriptionsByChannel: subStats.subscriptionsByChannel,
      messagesSentLastMinute: this.stats.messagesSentLastMinute,
      messagesReceivedLastMinute: this.stats.messagesReceivedLastMinute,
      avgLatencyMs: 0, // Would need to track this
      errorsLastMinute: this.stats.errorsLastMinute
    }
  }

  /**
   * Shutdown the gateway
   */
  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    if (this.statsInterval) {
      clearInterval(this.statsInterval)
      this.statsInterval = null
    }

    if (this.wss) {
      // Close all connections
      for (const client of this.subscriptions.getAllClients()) {
        client.socket.close(1001, 'Server shutting down')
      }

      this.wss.close()
      this.wss = null
    }

    console.log('[RuntimeWsGateway] Shutdown complete')
  }
}

// Singleton instance
let gatewayInstance: RuntimeWsGateway | null = null

/**
 * Get or create gateway instance
 */
export function getWsGateway(): RuntimeWsGateway {
  if (!gatewayInstance) {
    gatewayInstance = new RuntimeWsGateway()
  }
  return gatewayInstance
}

/**
 * Initialize gateway with HTTP server
 */
export function initializeWsGateway(
  httpServer: Server,
  config?: Partial<WsGatewayConfig>
): RuntimeWsGateway {
  if (gatewayInstance) {
    gatewayInstance.shutdown()
  }

  gatewayInstance = new RuntimeWsGateway(config)
  gatewayInstance.initialize(httpServer)
  return gatewayInstance
}
