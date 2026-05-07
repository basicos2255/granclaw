/**
 * Base Worker Implementation
 * P5: Durable Operational Workers & Real Connectors
 *
 * Base class for all channel workers.
 */

import type {
  WorkerHandler,
  WorkerConfig,
  WorkerCredentials,
  WorkerRuntimeState,
  WorkerPersistedState
} from '../types'
import type { ChannelType } from '../../channels-runtime/types'

/**
 * Abstract base worker that provides common functionality
 */
export abstract class BaseWorker implements WorkerHandler {
  protected config: WorkerConfig
  protected credentials: WorkerCredentials
  protected state: WorkerRuntimeState
  protected _connected: boolean = false
  protected _authenticated: boolean = false

  constructor(config: WorkerConfig, credentials: WorkerCredentials) {
    this.config = config
    this.credentials = credentials
    this.state = {
      connected: false,
      authenticated: false,
      pendingActions: 0,
      processedCount: 0,
      errorCount: 0
    }
  }

  /**
   * Channel type this worker handles
   */
  abstract get channelType(): ChannelType

  /**
   * Connect to the channel
   */
  abstract connect(): Promise<void>

  /**
   * Disconnect from the channel
   */
  abstract disconnect(): Promise<void>

  /**
   * Perform channel-specific heartbeat
   */
  abstract performHeartbeat(): Promise<boolean>

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this._connected
  }

  /**
   * Heartbeat check
   */
  async heartbeat(): Promise<boolean> {
    if (!this._connected) {
      return false
    }

    try {
      const healthy = await this.performHeartbeat()
      return healthy
    } catch (error) {
      console.error(`[${this.channelType}Worker] Heartbeat failed:`, error)
      return false
    }
  }

  /**
   * Reconnect after failure
   */
  async reconnect(): Promise<void> {
    console.log(`[${this.channelType}Worker] Reconnecting...`)

    try {
      await this.disconnect()
    } catch {
      // Ignore disconnect errors during reconnect
    }

    await this.connect()
  }

  /**
   * Get current runtime state
   */
  getState(): WorkerRuntimeState {
    return { ...this.state }
  }

  /**
   * Save state for persistence
   */
  saveState(): WorkerPersistedState {
    return {
      workerId: `worker_${this.config.channelType}_${this.config.channelId}`,
      channelType: this.config.channelType,
      channelId: this.config.channelId,
      tenantId: this.config.tenantId,
      sessionData: this.getSessionData(),
      cursor: this.state.cursor,
      authState: this.getAuthState(),
      savedAt: new Date().toISOString()
    }
  }

  /**
   * Restore state from persistence
   */
  async restoreState(state: WorkerPersistedState): Promise<void> {
    console.log(`[${this.channelType}Worker] Restoring state...`)

    if (state.cursor) {
      this.state.cursor = state.cursor
    }

    if (state.sessionData) {
      await this.restoreSessionData(state.sessionData)
    }

    if (state.authState) {
      await this.restoreAuthState(state.authState)
    }
  }

  /**
   * Get session data for persistence (override in subclass)
   */
  protected getSessionData(): unknown {
    return undefined
  }

  /**
   * Get auth state for persistence (override in subclass)
   */
  protected getAuthState(): WorkerPersistedState['authState'] {
    return {
      accessToken: this.credentials.accessToken,
      refreshToken: this.credentials.refreshToken
    }
  }

  /**
   * Restore session data (override in subclass)
   */
  protected async restoreSessionData(_data: unknown): Promise<void> {
    // Override in subclass
  }

  /**
   * Restore auth state (override in subclass)
   */
  protected async restoreAuthState(
    auth: NonNullable<WorkerPersistedState['authState']>
  ): Promise<void> {
    if (auth.accessToken) {
      this.credentials.accessToken = auth.accessToken
    }
    if (auth.refreshToken) {
      this.credentials.refreshToken = auth.refreshToken
    }
  }

  /**
   * Update connection state
   */
  protected setConnected(connected: boolean): void {
    this._connected = connected
    this.state.connected = connected
  }

  /**
   * Update authentication state
   */
  protected setAuthenticated(authenticated: boolean): void {
    this._authenticated = authenticated
    this.state.authenticated = authenticated
  }

  /**
   * Increment processed count
   */
  protected incrementProcessed(): void {
    this.state.processedCount++
  }

  /**
   * Increment error count
   */
  protected incrementError(): void {
    this.state.errorCount++
  }

  /**
   * Set pending actions count
   */
  protected setPendingActions(count: number): void {
    this.state.pendingActions = count
  }

  /**
   * Update cursor position
   */
  protected setCursor(cursor: string): void {
    this.state.cursor = cursor
  }

  /**
   * Update last sync time
   */
  protected setLastSync(): void {
    this.state.lastSync = new Date().toISOString()
  }
}
