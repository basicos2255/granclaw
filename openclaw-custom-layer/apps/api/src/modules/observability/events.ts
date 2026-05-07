/**
 * Runtime Events
 * PHASE H1: Runtime Hardening & Platform Stabilization
 *
 * Centralized event bus for runtime observability.
 * Provides structured event emission, subscriptions, and history.
 */

/**
 * Event categories
 */
export type EventCategory =
  | 'queue'      // Job queue events
  | 'dag'        // DAG execution events
  | 'resource'   // Resource manager events
  | 'lock'       // Artifact lock events
  | 'system'     // System-level events
  | 'error'      // Error events
  | 'audit'      // Audit events

/**
 * Event severity levels
 */
export type EventSeverity = 'debug' | 'info' | 'warn' | 'error' | 'critical'

/**
 * Base runtime event
 */
export interface RuntimeEvent {
  /** Unique event ID */
  id: string
  /** Event category */
  category: EventCategory
  /** Event type within category */
  type: string
  /** Severity level */
  severity: EventSeverity
  /** Event timestamp */
  timestamp: string
  /** Source component */
  source: string
  /** Event message */
  message: string
  /** Correlation ID for tracing */
  correlationId?: string
  /** Tenant ID */
  tenantId?: string
  /** User ID */
  userId?: string
  /** Session ID */
  sessionId?: string
  /** Related entity ID (job, graph, etc.) */
  entityId?: string
  /** Additional structured data */
  data?: Record<string, unknown>
  /** Duration in ms (for timed events) */
  durationMs?: number
  /** Tags for filtering */
  tags?: string[]
}

/**
 * Event filter for subscriptions
 */
export interface EventFilter {
  categories?: EventCategory[]
  types?: string[]
  severities?: EventSeverity[]
  sources?: string[]
  tenantId?: string
  entityId?: string
  tags?: string[]
}

/**
 * Event listener callback
 */
export type EventListener = (event: RuntimeEvent) => void

/**
 * Event subscription
 */
interface Subscription {
  id: string
  filter: EventFilter
  listener: EventListener
}

/**
 * Event statistics
 */
export interface EventStats {
  total: number
  byCategory: Record<EventCategory, number>
  bySeverity: Record<EventSeverity, number>
  bySource: Record<string, number>
  recentErrors: RuntimeEvent[]
  lastEventAt?: string
}

/**
 * Runtime Event Bus
 */
class RuntimeEventBus {
  private subscriptions: Map<string, Subscription> = new Map()
  private history: RuntimeEvent[] = []
  private maxHistorySize = 1000
  private eventIdCounter = 0

  /**
   * Generate unique event ID
   */
  private generateId(): string {
    return `evt-${Date.now()}-${++this.eventIdCounter}`
  }

  /**
   * Emit an event
   */
  emit(event: Omit<RuntimeEvent, 'id' | 'timestamp'>): RuntimeEvent {
    const fullEvent: RuntimeEvent = {
      ...event,
      id: this.generateId(),
      timestamp: new Date().toISOString()
    }

    // Add to history
    this.history.push(fullEvent)
    if (this.history.length > this.maxHistorySize) {
      this.history.shift()
    }

    // Notify subscribers
    for (const subscription of this.subscriptions.values()) {
      if (this.matchesFilter(fullEvent, subscription.filter)) {
        try {
          subscription.listener(fullEvent)
        } catch (err) {
          console.error('[EventBus] Listener error:', err)
        }
      }
    }

    // Console output for high severity
    if (fullEvent.severity === 'error' || fullEvent.severity === 'critical') {
      console.error(`[${fullEvent.source}] ${fullEvent.message}`, fullEvent.data || '')
    } else if (fullEvent.severity === 'warn') {
      console.warn(`[${fullEvent.source}] ${fullEvent.message}`, fullEvent.data || '')
    }

    return fullEvent
  }

  /**
   * Subscribe to events
   */
  subscribe(filter: EventFilter, listener: EventListener): string {
    const id = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    this.subscriptions.set(id, { id, filter, listener })
    return id
  }

  /**
   * Unsubscribe
   */
  unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId)
  }

  /**
   * Check if event matches filter
   */
  private matchesFilter(event: RuntimeEvent, filter: EventFilter): boolean {
    if (filter.categories && !filter.categories.includes(event.category)) {
      return false
    }
    if (filter.types && !filter.types.includes(event.type)) {
      return false
    }
    if (filter.severities && !filter.severities.includes(event.severity)) {
      return false
    }
    if (filter.sources && !filter.sources.includes(event.source)) {
      return false
    }
    if (filter.tenantId && event.tenantId !== filter.tenantId) {
      return false
    }
    if (filter.entityId && event.entityId !== filter.entityId) {
      return false
    }
    if (filter.tags && filter.tags.length > 0) {
      if (!event.tags || !filter.tags.some(t => event.tags!.includes(t))) {
        return false
      }
    }
    return true
  }

  /**
   * Get event history
   */
  getHistory(filter?: EventFilter, limit = 100): RuntimeEvent[] {
    let events = this.history
    if (filter) {
      events = events.filter(e => this.matchesFilter(e, filter))
    }
    return events.slice(-limit)
  }

  /**
   * Get events for an entity
   */
  getEventsForEntity(entityId: string, limit = 50): RuntimeEvent[] {
    return this.history
      .filter(e => e.entityId === entityId)
      .slice(-limit)
  }

  /**
   * Get events by correlation ID
   */
  getEventsByCorrelationId(correlationId: string): RuntimeEvent[] {
    return this.history.filter(e => e.correlationId === correlationId)
  }

  /**
   * Get statistics
   */
  getStats(): EventStats {
    const stats: EventStats = {
      total: this.history.length,
      byCategory: {
        queue: 0,
        dag: 0,
        resource: 0,
        lock: 0,
        system: 0,
        error: 0,
        audit: 0
      },
      bySeverity: {
        debug: 0,
        info: 0,
        warn: 0,
        error: 0,
        critical: 0
      },
      bySource: {},
      recentErrors: []
    }

    for (const event of this.history) {
      stats.byCategory[event.category]++
      stats.bySeverity[event.severity]++
      stats.bySource[event.source] = (stats.bySource[event.source] || 0) + 1

      if (event.severity === 'error' || event.severity === 'critical') {
        if (stats.recentErrors.length < 10) {
          stats.recentErrors.push(event)
        }
      }
    }

    if (this.history.length > 0) {
      stats.lastEventAt = this.history[this.history.length - 1].timestamp
    }

    return stats
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = []
  }

  /**
   * Set max history size
   */
  setMaxHistorySize(size: number): void {
    this.maxHistorySize = size
    if (this.history.length > size) {
      this.history = this.history.slice(-size)
    }
  }
}

// Singleton instance
export const eventBus = new RuntimeEventBus()

/**
 * Convenience helpers for common event types
 */
export function emitQueueEvent(
  type: string,
  message: string,
  data?: Record<string, unknown>,
  options?: Partial<RuntimeEvent>
): RuntimeEvent {
  return eventBus.emit({
    category: 'queue',
    type,
    severity: 'info',
    source: 'runtime-queue',
    message,
    data,
    ...options
  })
}

export function emitDagEvent(
  type: string,
  message: string,
  data?: Record<string, unknown>,
  options?: Partial<RuntimeEvent>
): RuntimeEvent {
  return eventBus.emit({
    category: 'dag',
    type,
    severity: 'info',
    source: 'dag-execution',
    message,
    data,
    ...options
  })
}

export function emitResourceEvent(
  type: string,
  message: string,
  data?: Record<string, unknown>,
  options?: Partial<RuntimeEvent>
): RuntimeEvent {
  return eventBus.emit({
    category: 'resource',
    type,
    severity: 'info',
    source: 'resource-manager',
    message,
    data,
    ...options
  })
}

export function emitLockEvent(
  type: string,
  message: string,
  data?: Record<string, unknown>,
  options?: Partial<RuntimeEvent>
): RuntimeEvent {
  return eventBus.emit({
    category: 'lock',
    type,
    severity: 'info',
    source: 'artifact-locks',
    message,
    data,
    ...options
  })
}

export function emitErrorEvent(
  source: string,
  message: string,
  error: unknown,
  options?: Partial<RuntimeEvent>
): RuntimeEvent {
  const errorData: Record<string, unknown> = {}

  if (error instanceof Error) {
    errorData.errorName = error.name
    errorData.errorMessage = error.message
    errorData.stack = error.stack?.substring(0, 500)
  } else {
    errorData.error = String(error)
  }

  return eventBus.emit({
    category: 'error',
    type: 'error',
    severity: 'error',
    source,
    message,
    data: errorData,
    ...options
  })
}

export function emitSystemEvent(
  type: string,
  message: string,
  data?: Record<string, unknown>,
  options?: Partial<RuntimeEvent>
): RuntimeEvent {
  return eventBus.emit({
    category: 'system',
    type,
    severity: 'info',
    source: 'system',
    message,
    data,
    ...options
  })
}

export function emitAuditEvent(
  type: string,
  message: string,
  data?: Record<string, unknown>,
  options?: Partial<RuntimeEvent>
): RuntimeEvent {
  return eventBus.emit({
    category: 'audit',
    type,
    severity: 'info',
    source: 'audit',
    message,
    data,
    ...options
  })
}
