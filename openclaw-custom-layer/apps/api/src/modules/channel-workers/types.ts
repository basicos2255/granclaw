/**
 * Channel Workers Types
 * P5: Durable Operational Workers & Real Connectors
 *
 * Types for persistent channel workers with lifecycle management.
 */

import type { ChannelType } from '../channels-runtime/types'

/**
 * Worker status
 */
export type WorkerStatus =
  | 'starting'
  | 'running'
  | 'reconnecting'
  | 'degraded'
  | 'failed'
  | 'stopped'

/**
 * Worker health
 */
export interface WorkerHealth {
  healthy: boolean
  lastHeartbeat: string
  consecutiveFailures: number
  lastError?: string
  degradedReason?: string
}

/**
 * Channel worker state
 */
export interface ChannelWorker {
  id: string
  channelType: ChannelType
  channelId: string
  tenantId: string
  status: WorkerStatus
  health: WorkerHealth
  reconnectCount: number
  queuePressure: number
  runtimeState: WorkerRuntimeState
  startedAt: string
  lastActivityAt: string
}

/**
 * Worker runtime state
 */
export interface WorkerRuntimeState {
  connected: boolean
  authenticated: boolean
  sessionId?: string
  cursor?: string
  lastSync?: string
  pendingActions: number
  processedCount: number
  errorCount: number
}

/**
 * Worker configuration
 */
export interface WorkerConfig {
  channelType: ChannelType
  channelId: string
  tenantId: string
  heartbeatIntervalMs: number
  reconnectDelayMs: number
  maxReconnectAttempts: number
  healthCheckIntervalMs: number
  persistStateIntervalMs: number
}

/**
 * Worker lifecycle events
 */
export type WorkerEvent =
  | 'worker:starting'
  | 'worker:started'
  | 'worker:reconnecting'
  | 'worker:reconnected'
  | 'worker:degraded'
  | 'worker:failed'
  | 'worker:recovered'
  | 'worker:stopped'
  | 'worker:heartbeat'

/**
 * Worker event payload
 */
export interface WorkerEventPayload {
  workerId: string
  channelType: ChannelType
  channelId: string
  tenantId: string
  status: WorkerStatus
  timestamp: string
  error?: string
  metadata?: Record<string, unknown>
}

/**
 * Worker persistence state
 */
export interface WorkerPersistedState {
  workerId: string
  channelType: ChannelType
  channelId: string
  tenantId: string
  sessionData?: unknown
  cursor?: string
  lastProcessedId?: string
  authState?: {
    accessToken?: string
    refreshToken?: string
    expiresAt?: string
  }
  savedAt: string
}

/**
 * Worker handler interface
 */
export interface WorkerHandler {
  /**
   * Initialize worker connection
   */
  connect(): Promise<void>

  /**
   * Disconnect worker
   */
  disconnect(): Promise<void>

  /**
   * Check if worker is connected
   */
  isConnected(): boolean

  /**
   * Perform heartbeat check
   */
  heartbeat(): Promise<boolean>

  /**
   * Reconnect after failure
   */
  reconnect(): Promise<void>

  /**
   * Get current runtime state
   */
  getState(): WorkerRuntimeState

  /**
   * Save state for persistence
   */
  saveState(): WorkerPersistedState

  /**
   * Restore state from persistence
   */
  restoreState(state: WorkerPersistedState): Promise<void>
}

/**
 * Worker factory function type
 */
export type WorkerFactory = (
  config: WorkerConfig,
  credentials: WorkerCredentials
) => WorkerHandler

/**
 * Worker credentials
 */
export interface WorkerCredentials {
  type: 'oauth' | 'basic' | 'apikey' | 'session'
  accessToken?: string
  refreshToken?: string
  username?: string
  password?: string
  apiKey?: string
  sessionData?: unknown
}

/**
 * Worker registry entry
 */
export interface WorkerRegistryEntry {
  worker: ChannelWorker
  handler: WorkerHandler
  config: WorkerConfig
  heartbeatTimer?: ReturnType<typeof setInterval>
  persistTimer?: ReturnType<typeof setInterval>
}

/**
 * Worker manager stats
 */
export interface WorkerManagerStats {
  totalWorkers: number
  byStatus: Record<WorkerStatus, number>
  byChannelType: Record<string, number>
  healthyCount: number
  degradedCount: number
  failedCount: number
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  workerId: string
  healthy: boolean
  latencyMs: number
  error?: string
  checkedAt: string
}

/**
 * Recovery action
 */
export type RecoveryAction =
  | 'reconnect'
  | 'refresh_auth'
  | 'restore_session'
  | 'restart_worker'
  | 'escalate'

/**
 * Recovery result
 */
export interface RecoveryResult {
  success: boolean
  action: RecoveryAction
  workerId: string
  attempts: number
  error?: string
  recoveredAt?: string
}
