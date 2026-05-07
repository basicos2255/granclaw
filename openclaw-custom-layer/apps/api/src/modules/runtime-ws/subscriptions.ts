/**
 * Runtime WebSocket Subscriptions
 * P1.2: Realtime Product Shell & WS Runtime
 *
 * Manages channel subscriptions and event routing.
 */

import type {
  WsChannel,
  WsSubscription,
  WsClientInfo,
  RuntimeEventType,
  WsFrame,
  WsGatewayConfig
} from './types'
import { isForTenant, isForUser, isForWorkflow } from './serializer'
import { canSubscribeToChannel } from './auth'

/**
 * P1.2: Rate limiter for subscriptions
 */
interface RateLimitEntry {
  count: number
  windowStart: number
}

/**
 * Subscription manager
 */
export class SubscriptionManager {
  /** Subscriptions by channel */
  private byChannel: Map<WsChannel, Set<string>> = new Map()

  /** Subscriptions by workflow (for workflow channel) */
  private byWorkflow: Map<string, Set<string>> = new Map()

  /** Subscriptions by tenant */
  private byTenant: Map<string, Set<string>> = new Map()

  /** All subscriptions */
  private subscriptions: Map<string, WsSubscription> = new Map()

  /** Client connections */
  private clients: Map<string, WsClientInfo> = new Map()

  /** Configuration */
  private config: WsGatewayConfig

  /** P1.2: Rate limit tracking per client */
  private rateLimits: Map<string, RateLimitEntry> = new Map()

  /** P1.2: Rate limit window (1 minute) */
  private readonly RATE_LIMIT_WINDOW_MS = 60000

  /** P1.2: Max subscriptions per window */
  private readonly MAX_SUBSCRIPTIONS_PER_MINUTE = 30

  constructor(config: WsGatewayConfig) {
    this.config = config
  }

  /**
   * P1.2: Check rate limit for a client
   */
  private checkRateLimit(clientId: string): { allowed: boolean; remaining: number } {
    const now = Date.now()
    const entry = this.rateLimits.get(clientId)

    if (!entry || (now - entry.windowStart) > this.RATE_LIMIT_WINDOW_MS) {
      // New window
      this.rateLimits.set(clientId, { count: 1, windowStart: now })
      return { allowed: true, remaining: this.MAX_SUBSCRIPTIONS_PER_MINUTE - 1 }
    }

    if (entry.count >= this.MAX_SUBSCRIPTIONS_PER_MINUTE) {
      return { allowed: false, remaining: 0 }
    }

    entry.count++
    return { allowed: true, remaining: this.MAX_SUBSCRIPTIONS_PER_MINUTE - entry.count }
  }

  /**
   * Register a client
   */
  registerClient(client: WsClientInfo): void {
    this.clients.set(client.id, client)

    // Track by tenant
    let tenantSubs = this.byTenant.get(client.tenantId)
    if (!tenantSubs) {
      tenantSubs = new Set()
      this.byTenant.set(client.tenantId, tenantSubs)
    }
  }

  /**
   * Unregister a client (removes all subscriptions)
   */
  unregisterClient(clientId: string): void {
    const client = this.clients.get(clientId)
    if (!client) return

    // Remove all subscriptions for this client
    for (const subId of client.subscriptions.keys()) {
      this.removeSubscription(subId)
    }

    // P1.2: Cleanup rate limit tracking
    this.rateLimits.delete(clientId)

    this.clients.delete(clientId)
  }

  /**
   * Add a subscription
   */
  addSubscription(
    clientId: string,
    subscription: WsSubscription
  ): { success: boolean; error?: string; rateLimit?: { remaining: number } } {
    const client = this.clients.get(clientId)
    if (!client) {
      return { success: false, error: 'Client not found' }
    }

    // P1.2: Check rate limit
    const rateCheck = this.checkRateLimit(clientId)
    if (!rateCheck.allowed) {
      console.warn(`[SubscriptionManager] Rate limit exceeded for client ${clientId}`)
      return { success: false, error: 'Rate limit exceeded. Try again later.', rateLimit: { remaining: 0 } }
    }

    // Check subscription limit
    if (client.subscriptions.size >= this.config.maxSubscriptionsPerConnection) {
      return { success: false, error: 'Max subscriptions reached' }
    }

    // Check authorization
    if (!canSubscribeToChannel(
      client.tenantId,
      client.userId,
      subscription.channel,
      subscription.workflowId
    )) {
      return { success: false, error: 'Not authorized to subscribe to this channel' }
    }

    // Add to subscriptions
    this.subscriptions.set(subscription.id, subscription)
    client.subscriptions.set(subscription.id, subscription)

    // Index by channel
    let channelSubs = this.byChannel.get(subscription.channel)
    if (!channelSubs) {
      channelSubs = new Set()
      this.byChannel.set(subscription.channel, channelSubs)
    }
    channelSubs.add(subscription.id)

    // Index by workflow if applicable
    if (subscription.channel === 'workflow' && subscription.workflowId) {
      let workflowSubs = this.byWorkflow.get(subscription.workflowId)
      if (!workflowSubs) {
        workflowSubs = new Set()
        this.byWorkflow.set(subscription.workflowId, workflowSubs)
      }
      workflowSubs.add(subscription.id)
    }

    // Index by tenant
    let tenantSubs = this.byTenant.get(subscription.tenantId)
    if (!tenantSubs) {
      tenantSubs = new Set()
      this.byTenant.set(subscription.tenantId, tenantSubs)
    }
    tenantSubs.add(subscription.id)

    return { success: true, rateLimit: { remaining: rateCheck.remaining } }
  }

  /**
   * Remove a subscription
   */
  removeSubscription(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId)
    if (!subscription) return false

    // Remove from channel index
    const channelSubs = this.byChannel.get(subscription.channel)
    if (channelSubs) {
      channelSubs.delete(subscriptionId)
    }

    // Remove from workflow index
    if (subscription.workflowId) {
      const workflowSubs = this.byWorkflow.get(subscription.workflowId)
      if (workflowSubs) {
        workflowSubs.delete(subscriptionId)
        if (workflowSubs.size === 0) {
          this.byWorkflow.delete(subscription.workflowId)
        }
      }
    }

    // Remove from tenant index
    const tenantSubs = this.byTenant.get(subscription.tenantId)
    if (tenantSubs) {
      tenantSubs.delete(subscriptionId)
    }

    // Remove from client
    for (const client of this.clients.values()) {
      if (client.subscriptions.has(subscriptionId)) {
        client.subscriptions.delete(subscriptionId)
        break
      }
    }

    this.subscriptions.delete(subscriptionId)
    return true
  }

  /**
   * Get clients that should receive an event
   */
  getTargetClients(
    channel: WsChannel,
    event: RuntimeEventType,
    frame: WsFrame
  ): WsClientInfo[] {
    const targets: WsClientInfo[] = []
    const seenClients = new Set<string>()

    // Get subscriptions for this channel
    const channelSubs = this.byChannel.get(channel)
    if (!channelSubs) return targets

    for (const subId of channelSubs) {
      const subscription = this.subscriptions.get(subId)
      if (!subscription) continue

      // Check event type filter
      if (subscription.eventTypes && subscription.eventTypes.length > 0) {
        if (!subscription.eventTypes.includes(event)) continue
      }

      // Find client for this subscription
      for (const client of this.clients.values()) {
        if (seenClients.has(client.id)) continue

        if (client.subscriptions.has(subId)) {
          // Check tenant isolation
          if (!isForTenant(frame, client.tenantId)) continue

          // Check user scope
          if (frame.userId && !isForUser(frame, client.userId)) continue

          // Check workflow scope
          if (channel === 'workflow' && frame.workflowId) {
            if (!subscription.workflowId) continue
            if (!isForWorkflow(frame, subscription.workflowId)) continue
          }

          targets.push(client)
          seenClients.add(client.id)
        }
      }
    }

    return targets
  }

  /**
   * Get clients subscribed to a specific workflow
   */
  getWorkflowClients(workflowId: string): WsClientInfo[] {
    const targets: WsClientInfo[] = []
    const workflowSubs = this.byWorkflow.get(workflowId)

    if (!workflowSubs) return targets

    for (const subId of workflowSubs) {
      for (const client of this.clients.values()) {
        if (client.subscriptions.has(subId)) {
          targets.push(client)
        }
      }
    }

    return targets
  }

  /**
   * Get all clients for a tenant
   */
  getTenantClients(tenantId: string): WsClientInfo[] {
    return Array.from(this.clients.values())
      .filter(client => client.tenantId === tenantId)
  }

  /**
   * Get all connected clients
   */
  getAllClients(): WsClientInfo[] {
    return Array.from(this.clients.values())
  }

  /**
   * Get subscription stats
   */
  getStats(): {
    totalSubscriptions: number
    subscriptionsByChannel: Record<WsChannel, number>
    subscriptionsByTenant: Record<string, number>
    workflowSubscriptions: number
    // P1.2: Connection health stats
    connectionHealth: {
      healthy: number
      degraded: number
      stale: number
    }
  } {
    const subscriptionsByChannel: Record<string, number> = {}
    for (const [channel, subs] of this.byChannel) {
      subscriptionsByChannel[channel] = subs.size
    }

    const subscriptionsByTenant: Record<string, number> = {}
    for (const [tenant, subs] of this.byTenant) {
      subscriptionsByTenant[tenant] = subs.size
    }

    // P1.2: Calculate connection health
    const now = Date.now()
    let healthy = 0
    let degraded = 0
    let stale = 0

    for (const client of this.clients.values()) {
      const lastActivity = new Date(client.lastActivityAt).getTime()
      const timeSinceActivity = now - lastActivity

      if (timeSinceActivity < 60000) {
        healthy++
      } else if (timeSinceActivity < 300000) {
        degraded++
      } else {
        stale++
      }
    }

    return {
      totalSubscriptions: this.subscriptions.size,
      subscriptionsByChannel: subscriptionsByChannel as Record<WsChannel, number>,
      subscriptionsByTenant,
      workflowSubscriptions: this.byWorkflow.size,
      connectionHealth: { healthy, degraded, stale }
    }
  }

  /**
   * Get client count
   */
  getClientCount(): number {
    return this.clients.size
  }

  /**
   * Get client by ID
   */
  getClient(clientId: string): WsClientInfo | undefined {
    return this.clients.get(clientId)
  }
}
