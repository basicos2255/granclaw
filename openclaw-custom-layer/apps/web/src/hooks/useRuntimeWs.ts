/**
 * Runtime WebSocket Hook
 * P1.2: Realtime Product Shell & WS Runtime
 *
 * React hook for using the runtime WebSocket client.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  connectRuntimeWs,
  disconnectRuntimeWs,
  subscribeToRuntime,
  unsubscribeFromRuntime,
  onRuntimeWsStateChange,
  getRuntimeWsState,
  type WsConnectionState,
  type WsChannel,
  type RuntimeEventType,
  type EventListener,
  type WsFrame
} from '../services/runtime-ws'
import { useAuth } from './useAuth'

const TOKEN_KEY = 'granclaw_token'

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

/**
 * Hook return type
 */
interface UseRuntimeWsResult {
  /** Current connection state */
  state: WsConnectionState
  /** Whether connected */
  isConnected: boolean
  /** Connect to WebSocket */
  connect: () => Promise<void>
  /** Disconnect from WebSocket */
  disconnect: () => void
  /** Subscribe to events */
  subscribe: (
    channel: WsChannel,
    listener: EventListener,
    options?: { workflowId?: string; eventTypes?: RuntimeEventType[] }
  ) => string
  /** Unsubscribe from events */
  unsubscribe: (listenerId: string) => boolean
}

/**
 * Hook for runtime WebSocket connection
 */
export function useRuntimeWs(autoConnect = true): UseRuntimeWsResult {
  const { isAuthenticated } = useAuth()
  const [state, setState] = useState<WsConnectionState>(getRuntimeWsState())
  const connectingRef = useRef(false)

  // Listen for state changes
  useEffect(() => {
    const unsubscribe = onRuntimeWsStateChange(setState)
    return unsubscribe
  }, [])

  // Auto-connect when authenticated
  useEffect(() => {
    const token = getToken()
    if (autoConnect && isAuthenticated && token && state === 'disconnected' && !connectingRef.current) {
      connectingRef.current = true
      connectRuntimeWs(token)
        .then(() => {
          console.log('[useRuntimeWs] Auto-connected')
        })
        .catch((err) => {
          console.error('[useRuntimeWs] Auto-connect failed:', err)
        })
        .finally(() => {
          connectingRef.current = false
        })
    }
  }, [autoConnect, isAuthenticated, state])

  // Manual connect
  const connect = useCallback(async () => {
    const token = getToken()
    if (!token) {
      throw new Error('No authentication token')
    }
    await connectRuntimeWs(token)
  }, [])

  // Manual disconnect
  const disconnect = useCallback(() => {
    disconnectRuntimeWs()
  }, [])

  // Subscribe wrapper
  const subscribe = useCallback(
    (
      channel: WsChannel,
      listener: EventListener,
      options?: { workflowId?: string; eventTypes?: RuntimeEventType[] }
    ): string => {
      return subscribeToRuntime(channel, listener, options)
    },
    []
  )

  // Unsubscribe wrapper
  const unsubscribe = useCallback((listenerId: string): boolean => {
    return unsubscribeFromRuntime(listenerId)
  }, [])

  return {
    state,
    isConnected: state === 'connected',
    connect,
    disconnect,
    subscribe,
    unsubscribe
  }
}

/**
 * Hook for subscribing to specific runtime events
 */
export function useRuntimeEvents<T = unknown>(
  channel: WsChannel,
  eventTypes?: RuntimeEventType[],
  options?: { workflowId?: string }
): {
  events: Array<{ payload: T; frame: WsFrame<T>; timestamp: number }>
  lastEvent: { payload: T; frame: WsFrame<T> } | null
  clearEvents: () => void
} {
  const { subscribe, unsubscribe, isConnected } = useRuntimeWs()
  const [events, setEvents] = useState<Array<{ payload: T; frame: WsFrame<T>; timestamp: number }>>([])
  const [lastEvent, setLastEvent] = useState<{ payload: T; frame: WsFrame<T> } | null>(null)

  useEffect(() => {
    if (!isConnected) return

    const listener: EventListener<T> = (payload, frame) => {
      const eventEntry = { payload, frame, timestamp: Date.now() }
      setEvents((prev) => [...prev.slice(-99), eventEntry]) // Keep last 100
      setLastEvent({ payload, frame })
    }

    const listenerId = subscribe(channel, listener as EventListener, {
      workflowId: options?.workflowId,
      eventTypes
    })

    return () => {
      unsubscribe(listenerId)
    }
  }, [isConnected, channel, eventTypes?.join(','), options?.workflowId, subscribe, unsubscribe])

  const clearEvents = useCallback(() => {
    setEvents([])
    setLastEvent(null)
  }, [])

  return { events, lastEvent, clearEvents }
}

/**
 * Hook for workflow-specific events
 */
export function useWorkflowEvents(workflowId: string) {
  return useRuntimeEvents('workflow', undefined, { workflowId })
}

/**
 * Hook for queue events
 */
export function useQueueEvents() {
  return useRuntimeEvents('queue')
}

/**
 * Hook for notification events
 */
export function useNotificationEvents() {
  return useRuntimeEvents('notifications', ['notification:created', 'notification:updated'])
}

/**
 * Hook for approval events
 */
export function useApprovalEvents() {
  return useRuntimeEvents('notifications', [
    'approval:required',
    'approval:granted',
    'approval:denied'
  ])
}
