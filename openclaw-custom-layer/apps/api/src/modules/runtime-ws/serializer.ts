/**
 * Runtime WebSocket Serializer
 * P1.2: Realtime Product Shell & WS Runtime
 *
 * Handles message serialization and deserialization.
 */

import type { WsFrame, RuntimeEventType, RuntimeEventPayload } from './types'

/**
 * Generate unique message ID
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Create an event frame
 */
export function createEventFrame<T extends RuntimeEventPayload>(
  event: RuntimeEventType,
  payload: T,
  options: {
    tenantId?: string
    userId?: string
    workflowId?: string
    correlationId?: string
  } = {}
): WsFrame<T> {
  return {
    id: generateMessageId(),
    type: 'event',
    event,
    payload,
    timestamp: new Date().toISOString(),
    tenantId: options.tenantId,
    userId: options.userId,
    workflowId: options.workflowId,
    correlationId: options.correlationId
  }
}

/**
 * Create an ack frame
 */
export function createAckFrame(
  originalId: string,
  success: boolean,
  message?: string
): WsFrame<{ originalId: string; success: boolean; message?: string }> {
  return {
    id: generateMessageId(),
    type: 'ack',
    payload: { originalId, success, message },
    timestamp: new Date().toISOString()
  }
}

/**
 * P5.3: Create subscription ack frame with subscriptionId
 */
export function createSubscriptionAckFrame(
  originalId: string,
  subscriptionId: string,
  channel: string,
  message?: string
): WsFrame<{ originalId: string; success: boolean; subscriptionId: string; channel: string; message?: string }> {
  return {
    id: generateMessageId(),
    type: 'ack',
    payload: { originalId, success: true, subscriptionId, channel, message },
    timestamp: new Date().toISOString()
  }
}

/**
 * Create an error frame
 */
export function createErrorFrame(
  code: string,
  message: string,
  originalId?: string
): WsFrame<{ code: string; message: string; originalId?: string }> {
  return {
    id: generateMessageId(),
    type: 'error',
    payload: { code, message, originalId },
    timestamp: new Date().toISOString()
  }
}

/**
 * Create a ping frame
 */
export function createPingFrame(): WsFrame<{ timestamp: number }> {
  return {
    id: generateMessageId(),
    type: 'ping',
    payload: { timestamp: Date.now() },
    timestamp: new Date().toISOString()
  }
}

/**
 * Create a pong frame
 */
export function createPongFrame(
  originalTimestamp: number
): WsFrame<{ originalTimestamp: number; serverTimestamp: number; latencyMs: number }> {
  const serverTimestamp = Date.now()
  return {
    id: generateMessageId(),
    type: 'pong',
    payload: {
      originalTimestamp,
      serverTimestamp,
      latencyMs: serverTimestamp - originalTimestamp
    },
    timestamp: new Date().toISOString()
  }
}

/**
 * Serialize frame to string
 */
export function serializeFrame<T>(frame: WsFrame<T>): string {
  return JSON.stringify(frame)
}

/**
 * Deserialize string to frame
 */
export function deserializeFrame<T>(data: string): WsFrame<T> | null {
  try {
    const parsed = JSON.parse(data)

    // Validate basic structure
    if (!parsed.id || !parsed.type || !parsed.timestamp) {
      console.warn('[WsSerializer] Invalid frame structure:', data)
      return null
    }

    return parsed as WsFrame<T>
  } catch (err) {
    console.warn('[WsSerializer] Failed to deserialize frame:', err)
    return null
  }
}

/**
 * Truncate payload for logging
 */
export function truncateForLog<T>(frame: WsFrame<T>, maxLength = 500): string {
  const str = JSON.stringify(frame)
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '...'
}

/**
 * Extract routing info from frame
 */
export function extractRoutingInfo(frame: WsFrame): {
  tenantId?: string
  userId?: string
  workflowId?: string
} {
  return {
    tenantId: frame.tenantId,
    userId: frame.userId,
    workflowId: frame.workflowId
  }
}

/**
 * Check if frame is for specific tenant
 */
export function isForTenant(frame: WsFrame, tenantId: string): boolean {
  // Frames without tenantId are broadcast
  if (!frame.tenantId) return true
  return frame.tenantId === tenantId
}

/**
 * Check if frame is for specific user
 */
export function isForUser(frame: WsFrame, userId: string): boolean {
  // Frames without userId are for all users in tenant
  if (!frame.userId) return true
  return frame.userId === userId
}

/**
 * Check if frame is for specific workflow
 */
export function isForWorkflow(frame: WsFrame, workflowId: string): boolean {
  // Only workflow-scoped frames have workflowId
  if (!frame.workflowId) return false
  return frame.workflowId === workflowId
}
