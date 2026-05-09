/**
 * Runtime WebSocket Client
 * P1.2: Realtime Product Shell & WS Runtime
 * P5.2: Config consistency - unified naming
 * P5.3: Subscription registry consistency - idempotent unsubscribe
 *
 * Frontend WebSocket client for realtime runtime communication.
 */

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
  | 'runtime'
  | 'queue'
  | 'workflow'
  | 'notifications'
  | 'debug'

/**
 * Runtime event types
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
  // Approvals & notifications
  | 'approval:required'
  | 'approval:granted'
  | 'approval:denied'
  | 'notification:created'
  | 'notification:updated'
  // System
  | 'system:health-change'
  // P6.4: Pairing state events
  | 'pairing:state-change'
  | 'pairing:connected'
  | 'pairing:disconnected'
  | 'pairing:paired'
  | 'pairing:degraded'
  | 'pairing:blocked'
  | 'pairing:error'
  // P6.4R: OpenClaw auth events
  | 'openclaw-connected'
  | 'openclaw-disconnected'
  | 'openclaw-degraded'
  | 'pairing-expired'
  | 'reauthorization-required'
  | 'repair-required'
  | 'pairing-restored'
  | 'openclaw-health-change'

/**
 * WebSocket frame
 */
export interface WsFrame<T = unknown> {
  id: string
  type: 'event' | 'subscribe' | 'unsubscribe' | 'ack' | 'error' | 'ping' | 'pong'
  channel?: WsChannel
  event?: RuntimeEventType
  payload?: T
  timestamp: string
  tenantId?: string
  userId?: string
  workflowId?: string
}

/**
 * Event listener callback
 */
export type EventListener<T = unknown> = (payload: T, frame: WsFrame<T>) => void

/**
 * Subscription info
 * P5.3: Added serverSubscriptionId for backend-assigned ID
 */
interface Subscription {
  id: string
  channel: WsChannel
  workflowId?: string
  eventTypes?: RuntimeEventType[]
  listeners: Map<string, EventListener>
  /** P5.3: Backend-assigned subscription ID (used for unsubscribe) */
  serverSubscriptionId?: string
  /** P5.3: Pending subscribe message ID (to correlate ACK) */
  pendingSubscribeId?: string
}

/**
 * Reconnection config
 */
interface ReconnectConfig {
  maxAttempts: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

const DEFAULT_RECONNECT_CONFIG: ReconnectConfig = {
  maxAttempts: 10,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 1.5
}

/**
 * Runtime WebSocket Client
 */
class RuntimeWsClient {
  private socket: WebSocket | null = null
  private state: WsConnectionState = 'disconnected'
  private subscriptions: Map<string, Subscription> = new Map()
  private stateListeners: Set<(state: WsConnectionState) => void> = new Set()
  private reconnectAttempts = 0
  private reconnectTimeout: number | null = null
  private heartbeatInterval: number | null = null
  private lastPongAt: number = 0
  private pendingAcks: Map<string, { resolve: () => void; reject: (error: Error) => void }> = new Map()
  private config: ReconnectConfig
  private token: string | null = null
  private baseUrl: string

  constructor(config: Partial<ReconnectConfig> = {}) {
    this.config = { ...DEFAULT_RECONNECT_CONFIG, ...config }
    this.baseUrl = this.getWsUrl()
  }

  /**
   * Get WebSocket URL
   * P5.2: Unified config naming
   */
  private getWsUrl(): string {
    // P5.2: Use VITE_WS_BASE_URL if available
    const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL ||
                      import.meta.env.VITE_WS_URL  // deprecated

    if (wsBaseUrl) {
      return `${wsBaseUrl}/ws`
    }

    // Fallback: derive from current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    const port = import.meta.env.VITE_API_PORT || '3001'  // deprecated
    return `${protocol}//${host}:${port}/ws`
  }

  /**
   * Connect to WebSocket server
   */
  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state === 'connected' || this.state === 'connecting') {
        resolve()
        return
      }

      this.token = token
      this.setState('connecting')

      const url = `${this.baseUrl}?token=${encodeURIComponent(token)}`

      try {
        this.socket = new WebSocket(url)

        this.socket.onopen = () => {
          console.log('[RuntimeWs] Connected')
          this.setState('connected')
          this.reconnectAttempts = 0
          this.startHeartbeat()

          // Resubscribe to previous subscriptions
          this.resubscribeAll()

          resolve()
        }

        this.socket.onclose = (event) => {
          console.log('[RuntimeWs] Disconnected:', event.code, event.reason)
          this.stopHeartbeat()

          if (event.code !== 1000) {
            // Abnormal close, attempt reconnect
            this.handleDisconnect()
          } else {
            this.setState('disconnected')
          }
        }

        this.socket.onerror = (error) => {
          console.error('[RuntimeWs] Error:', error)
          if (this.state === 'connecting') {
            reject(new Error('WebSocket connection failed'))
          }
        }

        this.socket.onmessage = (event) => {
          this.handleMessage(event.data)
        }
      } catch (error) {
        console.error('[RuntimeWs] Connection error:', error)
        this.setState('disconnected')
        reject(error)
      }
    })
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.stopHeartbeat()
    this.clearReconnectTimeout()

    if (this.socket) {
      this.socket.close(1000, 'Client disconnect')
      this.socket = null
    }

    this.setState('disconnected')
  }

  /**
   * Subscribe to a channel
   */
  subscribe(
    channel: WsChannel,
    listener: EventListener,
    options: {
      workflowId?: string
      eventTypes?: RuntimeEventType[]
    } = {}
  ): string {
    const listenerId = `listener_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const subscriptionKey = this.getSubscriptionKey(channel, options.workflowId)

    let subscription = this.subscriptions.get(subscriptionKey)

    if (!subscription) {
      subscription = {
        id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        channel,
        workflowId: options.workflowId,
        eventTypes: options.eventTypes,
        listeners: new Map()
      }
      this.subscriptions.set(subscriptionKey, subscription)

      // Send subscribe message if connected
      if (this.state === 'connected') {
        this.sendSubscribe(subscription)
      }
    }

    subscription.listeners.set(listenerId, listener)

    return listenerId
  }

  /**
   * Unsubscribe a listener
   * P5.3: Use serverSubscriptionId for backend unsubscribe
   */
  unsubscribe(listenerId: string): boolean {
    for (const [key, subscription] of this.subscriptions) {
      if (subscription.listeners.has(listenerId)) {
        subscription.listeners.delete(listenerId)

        // If no more listeners, remove subscription
        if (subscription.listeners.size === 0) {
          // P5.3: Pass serverSubscriptionId if we have it
          this.sendUnsubscribe(subscription.id, subscription.serverSubscriptionId)
          this.subscriptions.delete(key)
        }

        return true
      }
    }
    return false
  }

  /**
   * Add state change listener
   */
  onStateChange(listener: (state: WsConnectionState) => void): () => void {
    this.stateListeners.add(listener)
    // Immediately notify current state
    listener(this.state)
    return () => this.stateListeners.delete(listener)
  }

  /**
   * Get current state
   */
  getState(): WsConnectionState {
    return this.state
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === 'connected'
  }

  /**
   * Get subscription key
   */
  private getSubscriptionKey(channel: WsChannel, workflowId?: string): string {
    return workflowId ? `${channel}:${workflowId}` : channel
  }

  /**
   * Set state and notify listeners
   */
  private setState(state: WsConnectionState): void {
    if (this.state === state) return
    this.state = state
    for (const listener of this.stateListeners) {
      try {
        listener(state)
      } catch (err) {
        console.error('[RuntimeWs] State listener error:', err)
      }
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    try {
      const frame: WsFrame = JSON.parse(data)

      switch (frame.type) {
        case 'event':
          this.handleEvent(frame)
          break

        case 'ack':
          this.handleAck(frame)
          break

        case 'error':
          this.handleError(frame)
          break

        case 'pong':
          this.handlePong(frame)
          break

        default:
          console.warn('[RuntimeWs] Unknown frame type:', frame.type)
      }
    } catch (err) {
      console.error('[RuntimeWs] Failed to parse message:', err)
    }
  }

  /**
   * Handle event frame
   */
  private handleEvent(frame: WsFrame): void {
    // Find matching subscriptions
    for (const subscription of this.subscriptions.values()) {
      // Check channel match
      if (frame.channel && frame.channel !== subscription.channel) continue

      // Check workflow match
      if (subscription.workflowId && frame.workflowId !== subscription.workflowId) continue

      // Check event type filter
      if (subscription.eventTypes && frame.event) {
        if (!subscription.eventTypes.includes(frame.event)) continue
      }

      // Notify listeners
      for (const listener of subscription.listeners.values()) {
        try {
          listener(frame.payload, frame)
        } catch (err) {
          console.error('[RuntimeWs] Listener error:', err)
        }
      }
    }
  }

  /**
   * Handle ack frame
   * P5.3: Updated to handle subscription ACK with serverSubscriptionId
   */
  private handleAck(frame: WsFrame): void {
    const payload = frame.payload as {
      originalId: string
      success: boolean
      message?: string
      subscriptionId?: string
      channel?: string
    }

    // P5.3: If this is a subscribe ACK, update the subscription with server ID
    if (payload.subscriptionId && payload.channel) {
      for (const subscription of this.subscriptions.values()) {
        if (subscription.pendingSubscribeId === payload.originalId) {
          subscription.serverSubscriptionId = payload.subscriptionId
          subscription.pendingSubscribeId = undefined
          console.debug(`[RuntimeWs] Subscription registered: ${payload.subscriptionId} (${payload.channel})`)
          break
        }
      }
    }

    const pending = this.pendingAcks.get(payload.originalId)

    if (pending) {
      if (payload.success) {
        pending.resolve()
      } else {
        pending.reject(new Error(payload.message || 'Operation failed'))
      }
      this.pendingAcks.delete(payload.originalId)
    }
  }

  /**
   * Handle error frame
   * P5.3: Treat SUBSCRIPTION_NOT_FOUND as non-fatal during cleanup
   */
  private handleError(frame: WsFrame): void {
    const payload = frame.payload as { code: string; message: string; originalId?: string }

    // P5.3: Non-fatal errors during cleanup
    const nonFatalCodes = ['SUBSCRIPTION_NOT_FOUND', 'MISSING_SUBSCRIPTION_ID']
    if (nonFatalCodes.includes(payload.code)) {
      console.debug('[RuntimeWs] Non-fatal:', payload.code, payload.message)
    } else {
      console.error('[RuntimeWs] Server error:', payload.code, payload.message)
    }

    if (payload.originalId) {
      const pending = this.pendingAcks.get(payload.originalId)
      if (pending) {
        pending.reject(new Error(payload.message))
        this.pendingAcks.delete(payload.originalId)
      }
    }
  }

  /**
   * Handle pong frame
   */
  private handlePong(_frame: WsFrame): void {
    this.lastPongAt = Date.now()

    if (this.state === 'degraded') {
      this.setState('connected')
    }
  }

  /**
   * Send subscribe message
   * P5.3: Track pendingSubscribeId to correlate ACK
   */
  private sendSubscribe(subscription: Subscription): void {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    subscription.pendingSubscribeId = messageId

    this.send({
      id: messageId,
      type: 'subscribe',
      channel: subscription.channel,
      workflowId: subscription.workflowId,
      payload: {
        eventTypes: subscription.eventTypes
      },
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Send unsubscribe message
   * P5.3: Use serverSubscriptionId if available
   */
  private sendUnsubscribe(subscriptionId: string, serverSubscriptionId?: string): void {
    // P5.3: Use server-assigned ID if available, fallback to local ID
    const idToSend = serverSubscriptionId || subscriptionId

    this.send({
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'unsubscribe',
      payload: { subscriptionId: idToSend },
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Send frame
   */
  private send(frame: WsFrame): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('[RuntimeWs] Cannot send, not connected')
      return
    }

    this.socket.send(JSON.stringify(frame))
  }

  /**
   * Resubscribe to all subscriptions
   * P5.3: Clear old serverSubscriptionIds before resubscribing
   */
  private resubscribeAll(): void {
    for (const subscription of this.subscriptions.values()) {
      // P5.3: Clear server ID from previous connection
      subscription.serverSubscriptionId = undefined
      this.sendSubscribe(subscription)
    }
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(): void {
    this.setState('reconnecting')
    this.attemptReconnect()
  }

  /**
   * Attempt reconnection with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxAttempts) {
      console.error('[RuntimeWs] Max reconnect attempts reached')
      this.setState('disconnected')
      return
    }

    const delay = Math.min(
      this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, this.reconnectAttempts),
      this.config.maxDelayMs
    )

    console.log(`[RuntimeWs] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`)

    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectAttempts++
      if (this.token) {
        this.connect(this.token).catch(() => {
          this.attemptReconnect()
        })
      }
    }, delay)
  }

  /**
   * Clear reconnect timeout
   */
  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = window.setInterval(() => {
      if (this.state !== 'connected') return

      // Check for stale connection
      const timeSinceLastPong = Date.now() - this.lastPongAt
      if (this.lastPongAt > 0 && timeSinceLastPong > 60000) {
        console.warn('[RuntimeWs] Connection appears stale')
        this.setState('degraded')
      }

      // Send ping
      this.send({
        id: `ping_${Date.now()}`,
        type: 'ping',
        payload: { timestamp: Date.now() },
        timestamp: new Date().toISOString()
      })
    }, 30000)
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }
}

// Singleton instance
let clientInstance: RuntimeWsClient | null = null

/**
 * Get or create WebSocket client instance
 */
export function getRuntimeWsClient(): RuntimeWsClient {
  if (!clientInstance) {
    clientInstance = new RuntimeWsClient()
  }
  return clientInstance
}

/**
 * Connect to runtime WebSocket
 */
export function connectRuntimeWs(token: string): Promise<void> {
  return getRuntimeWsClient().connect(token)
}

/**
 * Disconnect from runtime WebSocket
 */
export function disconnectRuntimeWs(): void {
  getRuntimeWsClient().disconnect()
}

/**
 * Subscribe to runtime events
 */
export function subscribeToRuntime(
  channel: WsChannel,
  listener: EventListener,
  options?: { workflowId?: string; eventTypes?: RuntimeEventType[] }
): string {
  return getRuntimeWsClient().subscribe(channel, listener, options)
}

/**
 * Unsubscribe from runtime events
 */
export function unsubscribeFromRuntime(listenerId: string): boolean {
  return getRuntimeWsClient().unsubscribe(listenerId)
}

/**
 * Add connection state listener
 */
export function onRuntimeWsStateChange(
  listener: (state: WsConnectionState) => void
): () => void {
  return getRuntimeWsClient().onStateChange(listener)
}

/**
 * Get current connection state
 */
export function getRuntimeWsState(): WsConnectionState {
  return getRuntimeWsClient().getState()
}

/**
 * Check if connected
 */
export function isRuntimeWsConnected(): boolean {
  return getRuntimeWsClient().isConnected()
}
