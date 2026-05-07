/**
 * Observability Module
 * PHASE H1: Runtime Hardening & Platform Stabilization
 *
 * Provides runtime events, structured logging, and monitoring.
 */

// Events
export {
  eventBus,
  emitQueueEvent,
  emitDagEvent,
  emitResourceEvent,
  emitLockEvent,
  emitErrorEvent,
  emitSystemEvent,
  emitAuditEvent
} from './events'

export type {
  RuntimeEvent,
  EventCategory,
  EventSeverity,
  EventFilter,
  EventListener,
  EventStats
} from './events'

// Logger
export {
  Logger,
  createLogger,
  createRequestLogger,
  loggers
} from './logger'

export type {
  LogLevel,
  LoggerContext,
  LoggerConfig,
  LogEntry
} from './logger'
