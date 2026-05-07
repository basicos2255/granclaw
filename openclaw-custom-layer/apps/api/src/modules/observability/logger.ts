/**
 * Structured Logger
 * PHASE H1: Runtime Hardening & Platform Stabilization
 *
 * Provides consistent, structured logging across the application.
 * Integrates with the event bus for observability.
 */

import { eventBus, EventSeverity, EventCategory } from './events'

/**
 * Log level configuration
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

/**
 * Logger context
 */
export interface LoggerContext {
  source: string
  correlationId?: string
  tenantId?: string
  userId?: string
  sessionId?: string
  entityId?: string
  tags?: string[]
}

/**
 * Log entry
 */
export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  source: string
  correlationId?: string
  tenantId?: string
  userId?: string
  sessionId?: string
  entityId?: string
  data?: Record<string, unknown>
  durationMs?: number
  tags?: string[]
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Minimum log level to output */
  minLevel: LogLevel
  /** Include timestamps in console output */
  includeTimestamps: boolean
  /** Include source in console output */
  includeSource: boolean
  /** Pretty print JSON data */
  prettyPrint: boolean
  /** Emit to event bus */
  emitEvents: boolean
  /** Event category for logging events */
  eventCategory: EventCategory
}

const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  minLevel: 'info',
  includeTimestamps: true,
  includeSource: true,
  prettyPrint: false,
  emitEvents: true,
  eventCategory: 'system'
}

/**
 * Structured Logger
 */
export class Logger {
  private context: LoggerContext
  private config: LoggerConfig
  private timers: Map<string, number> = new Map()

  constructor(context: LoggerContext, config: Partial<LoggerConfig> = {}) {
    this.context = context
    this.config = { ...DEFAULT_LOGGER_CONFIG, ...config }
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: Partial<LoggerContext>): Logger {
    return new Logger(
      { ...this.context, ...additionalContext },
      this.config
    )
  }

  /**
   * Set context values
   */
  setContext(context: Partial<LoggerContext>): void {
    Object.assign(this.context, context)
  }

  /**
   * Debug level log
   */
  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data)
  }

  /**
   * Info level log
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data)
  }

  /**
   * Warning level log
   */
  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data)
  }

  /**
   * Error level log
   */
  error(message: string, error?: unknown, data?: Record<string, unknown>): void {
    const errorData: Record<string, unknown> = { ...data }

    if (error instanceof Error) {
      errorData.errorName = error.name
      errorData.errorMessage = error.message
      errorData.stack = error.stack?.substring(0, 1000)
    } else if (error !== undefined) {
      errorData.error = String(error)
    }

    this.log('error', message, errorData)
  }

  /**
   * Start a timer
   */
  time(label: string): void {
    this.timers.set(label, Date.now())
  }

  /**
   * End a timer and log duration
   */
  timeEnd(label: string, message?: string): number {
    const startTime = this.timers.get(label)
    if (!startTime) {
      this.warn(`Timer "${label}" does not exist`)
      return 0
    }

    const durationMs = Date.now() - startTime
    this.timers.delete(label)

    const logMessage = message || `${label} completed`
    this.info(logMessage, { durationMs, timer: label })

    return durationMs
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    // Check minimum level
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.config.minLevel]) {
      return
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      source: this.context.source,
      correlationId: this.context.correlationId,
      tenantId: this.context.tenantId,
      userId: this.context.userId,
      sessionId: this.context.sessionId,
      entityId: this.context.entityId,
      data,
      tags: this.context.tags
    }

    // Console output
    this.consoleOutput(entry)

    // Emit event
    if (this.config.emitEvents) {
      this.emitEvent(entry)
    }
  }

  /**
   * Console output
   */
  private consoleOutput(entry: LogEntry): void {
    const parts: string[] = []

    if (this.config.includeTimestamps) {
      const time = new Date(entry.timestamp).toISOString().substr(11, 12)
      parts.push(`[${time}]`)
    }

    if (this.config.includeSource) {
      parts.push(`[${entry.source}]`)
    }

    parts.push(entry.message)

    const prefix = parts.join(' ')
    const dataStr = entry.data
      ? (this.config.prettyPrint
        ? JSON.stringify(entry.data, null, 2)
        : JSON.stringify(entry.data))
      : ''

    switch (entry.level) {
      case 'debug':
        console.debug(prefix, dataStr)
        break
      case 'info':
        console.log(prefix, dataStr)
        break
      case 'warn':
        console.warn(prefix, dataStr)
        break
      case 'error':
        console.error(prefix, dataStr)
        break
    }
  }

  /**
   * Emit log as event
   */
  private emitEvent(entry: LogEntry): void {
    const severityMap: Record<LogLevel, EventSeverity> = {
      debug: 'debug',
      info: 'info',
      warn: 'warn',
      error: 'error'
    }

    eventBus.emit({
      category: this.config.eventCategory,
      type: `log:${entry.level}`,
      severity: severityMap[entry.level],
      source: entry.source,
      message: entry.message,
      correlationId: entry.correlationId,
      tenantId: entry.tenantId,
      userId: entry.userId,
      sessionId: entry.sessionId,
      entityId: entry.entityId,
      data: entry.data,
      durationMs: entry.durationMs,
      tags: entry.tags
    })
  }
}

/**
 * Create a logger for a source
 */
export function createLogger(source: string, config?: Partial<LoggerConfig>): Logger {
  return new Logger({ source }, config)
}

/**
 * Pre-configured loggers for common modules
 */
export const loggers = {
  queue: createLogger('runtime-queue', { eventCategory: 'queue' }),
  dag: createLogger('dag-execution', { eventCategory: 'dag' }),
  resource: createLogger('resource-manager', { eventCategory: 'resource' }),
  lock: createLogger('artifact-locks', { eventCategory: 'lock' }),
  system: createLogger('system', { eventCategory: 'system' })
}

/**
 * Request logger middleware helper
 */
export function createRequestLogger(
  tenantId?: string,
  userId?: string,
  sessionId?: string
): Logger {
  return new Logger({
    source: 'request',
    tenantId,
    userId,
    sessionId,
    correlationId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  })
}
