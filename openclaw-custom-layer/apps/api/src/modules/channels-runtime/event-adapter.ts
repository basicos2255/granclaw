/**
 * Channel Event Adapter
 * P3: Real Integrations & Operational Channels
 *
 * Bridges channel events to runtime queue and WebSocket.
 */

import type {
  ChannelEvent,
  ChannelEventType,
  ChannelType,
  ChannelWorkflowTrigger
} from './types'
import { eventBus } from '../event-bus'
import { getWsGateway } from '../runtime-ws/gateway'

/**
 * Generate unique event ID
 */
function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Workflow triggers storage (in-memory for now)
 */
const workflowTriggers: Map<string, ChannelWorkflowTrigger[]> = new Map()

/**
 * Event listeners by channel
 */
type ChannelEventListener = (event: ChannelEvent) => void | Promise<void>
const eventListeners: Map<string, Set<ChannelEventListener>> = new Map()

/**
 * Register a workflow trigger for a channel event
 */
export function registerWorkflowTrigger(trigger: ChannelWorkflowTrigger): void {
  const key = `${trigger.channelId}:${trigger.eventType}`
  const existing = workflowTriggers.get(key) || []
  existing.push(trigger)
  workflowTriggers.set(key, existing)
  console.log(`[ChannelEventAdapter] Registered trigger: ${key} -> workflow ${trigger.workflowId}`)
}

/**
 * Remove a workflow trigger
 */
export function removeWorkflowTrigger(triggerId: string): boolean {
  for (const [key, triggers] of workflowTriggers) {
    const index = triggers.findIndex(t => t.id === triggerId)
    if (index !== -1) {
      triggers.splice(index, 1)
      if (triggers.length === 0) {
        workflowTriggers.delete(key)
      }
      return true
    }
  }
  return false
}

/**
 * Get triggers for a channel event
 */
function getTriggersForEvent(
  channelId: string,
  eventType: ChannelEventType
): ChannelWorkflowTrigger[] {
  const key = `${channelId}:${eventType}`
  return (workflowTriggers.get(key) || []).filter(t => t.enabled)
}

/**
 * Subscribe to channel events
 */
export function subscribeToChannelEvents(
  channelId: string,
  listener: ChannelEventListener
): () => void {
  let listeners = eventListeners.get(channelId)
  if (!listeners) {
    listeners = new Set()
    eventListeners.set(channelId, listeners)
  }
  listeners.add(listener)

  return () => {
    listeners?.delete(listener)
    if (listeners?.size === 0) {
      eventListeners.delete(channelId)
    }
  }
}

/**
 * Emit a channel event
 */
export async function emitChannelEvent<T = unknown>(
  channelId: string,
  channelType: ChannelType,
  eventType: ChannelEventType,
  payload: T,
  options: {
    tenantId: string
    correlationId?: string
    workflowId?: string
    metadata?: Record<string, unknown>
  }
): Promise<ChannelEvent<T>> {
  const event: ChannelEvent<T> = {
    id: generateEventId(),
    type: eventType,
    channelId,
    channelType,
    tenantId: options.tenantId,
    timestamp: new Date().toISOString(),
    payload,
    metadata: options.metadata,
    correlationId: options.correlationId,
    workflowId: options.workflowId
  }

  console.log(`[ChannelEventAdapter] Emitting event: ${eventType} from ${channelType}/${channelId}`)

  // 1. Emit to internal event bus
  eventBus.emit('channel:event', event)

  // 2. Emit to WebSocket for realtime UI updates
  try {
    const wsGateway = getWsGateway()
    // Cast event to any for WS compatibility - WS gateway handles its own typing
    wsGateway.broadcast('runtime', eventType as any, event as any, {
      tenantId: options.tenantId,
      correlationId: options.correlationId
    })
  } catch (err) {
    console.error('[ChannelEventAdapter] Failed to broadcast to WebSocket:', err)
  }

  // 3. Notify channel-specific listeners
  const listeners = eventListeners.get(channelId)
  if (listeners) {
    for (const listener of listeners) {
      try {
        await listener(event)
      } catch (err) {
        console.error(`[ChannelEventAdapter] Listener error for ${channelId}:`, err)
      }
    }
  }

  // 4. Check for workflow triggers
  const triggers = getTriggersForEvent(channelId, eventType)
  for (const trigger of triggers) {
    // Check conditions if defined
    if (trigger.conditions) {
      const conditionsMet = evaluateConditions(trigger.conditions, event)
      if (!conditionsMet) continue
    }

    // Emit workflow trigger event
    eventBus.emit('workflow:trigger', {
      triggerId: trigger.id,
      workflowId: trigger.workflowId,
      channelEvent: event,
      tenantId: options.tenantId
    })

    console.log(`[ChannelEventAdapter] Triggered workflow: ${trigger.workflowId}`)
  }

  return event
}

/**
 * Evaluate trigger conditions
 */
function evaluateConditions(
  conditions: Record<string, unknown>,
  event: ChannelEvent
): boolean {
  // Simple condition evaluation
  for (const [key, expectedValue] of Object.entries(conditions)) {
    const actualValue = getNestedValue(event, key)

    if (typeof expectedValue === 'object' && expectedValue !== null) {
      // Complex conditions
      const condition = expectedValue as Record<string, unknown>

      if ('$eq' in condition && actualValue !== condition.$eq) return false
      if ('$ne' in condition && actualValue === condition.$ne) return false
      if ('$gt' in condition && !(Number(actualValue) > Number(condition.$gt))) return false
      if ('$lt' in condition && !(Number(actualValue) < Number(condition.$lt))) return false
      if ('$contains' in condition && !String(actualValue).includes(String(condition.$contains))) return false
      if ('$regex' in condition) {
        const regex = new RegExp(String(condition.$regex))
        if (!regex.test(String(actualValue))) return false
      }
    } else {
      // Simple equality
      if (actualValue !== expectedValue) return false
    }
  }

  return true
}

/**
 * Get nested value from object
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

/**
 * Create channel event from external source
 */
export function createChannelEventFromWebhook(
  channelId: string,
  channelType: ChannelType,
  webhookData: unknown,
  tenantId: string
): ChannelEvent {
  // Determine event type based on channel and data
  let eventType: ChannelEventType = 'channel:message_received'

  if (channelType === 'email') {
    eventType = 'email:new_email'
  } else if (channelType === 'whatsapp') {
    eventType = 'whatsapp:message_received'
  } else if (channelType === 'calendar') {
    eventType = 'calendar:event_updated'
  }

  return {
    id: generateEventId(),
    type: eventType,
    channelId,
    channelType,
    tenantId,
    timestamp: new Date().toISOString(),
    payload: webhookData
  }
}

/**
 * Get recent events for a channel
 */
const recentEvents: Map<string, ChannelEvent[]> = new Map()
const MAX_RECENT_EVENTS = 100

export function trackRecentEvent(event: ChannelEvent): void {
  let events = recentEvents.get(event.channelId) || []
  events.unshift(event)
  events = events.slice(0, MAX_RECENT_EVENTS)
  recentEvents.set(event.channelId, events)
}

export function getRecentEvents(
  channelId: string,
  limit = 20
): ChannelEvent[] {
  return (recentEvents.get(channelId) || []).slice(0, limit)
}

/**
 * Initialize event adapter
 */
export function initializeEventAdapter(): void {
  // Subscribe to internal events and track them
  eventBus.on('channel:event', (...args: unknown[]) => {
    const event = args[0] as ChannelEvent
    trackRecentEvent(event)
  })

  console.log('[ChannelEventAdapter] Initialized')
}
