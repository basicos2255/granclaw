/**
 * Event Bus
 * P3: Real Integrations & Operational Channels
 *
 * Simple typed event bus for internal communication.
 */

type EventHandler = (...args: unknown[]) => void | Promise<void>

class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map()

  /**
   * Subscribe to an event
   */
  on(event: string, handler: EventHandler): () => void {
    let handlers = this.handlers.get(event)
    if (!handlers) {
      handlers = new Set()
      this.handlers.set(event, handlers)
    }
    handlers.add(handler)

    // Return unsubscribe function
    return () => {
      handlers?.delete(handler)
      if (handlers?.size === 0) {
        this.handlers.delete(event)
      }
    }
  }

  /**
   * Subscribe once
   */
  once(event: string, handler: EventHandler): void {
    const wrappedHandler: EventHandler = (...args) => {
      this.off(event, wrappedHandler)
      return handler(...args)
    }
    this.on(event, wrappedHandler)
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, handler: EventHandler): void {
    const handlers = this.handlers.get(event)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.handlers.delete(event)
      }
    }
  }

  /**
   * Emit an event
   */
  emit(event: string, ...args: unknown[]): void {
    const handlers = this.handlers.get(event)
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(...args)
        } catch (err) {
          console.error(`[EventBus] Error in handler for ${event}:`, err)
        }
      }
    }
  }

  /**
   * Emit async and wait for all handlers
   */
  async emitAsync(event: string, ...args: unknown[]): Promise<void> {
    const handlers = this.handlers.get(event)
    if (handlers) {
      const promises = Array.from(handlers).map(handler => {
        try {
          const result = handler(...args)
          return result instanceof Promise ? result : Promise.resolve()
        } catch (err) {
          console.error(`[EventBus] Error in handler for ${event}:`, err)
          return Promise.resolve()
        }
      })
      await Promise.all(promises)
    }
  }

  /**
   * Get registered events
   */
  getRegisteredEvents(): string[] {
    return Array.from(this.handlers.keys())
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear()
  }
}

// Singleton instance
export const eventBus = new EventBus()

// Event types for type safety (can be extended)
export type SystemEvent =
  | 'channel:event'
  | 'channel:action_complete'
  | 'channel:action_failed'
  | 'channel:action_result'
  | 'channel:escalation_required'
  | 'approval:required'
  | 'workflow:trigger'
  | 'runtime:enqueue'
  | 'credential:expired'
