/**
 * System State Types
 * FIX 123: OpenClaw Persistent Setup & Pairing Flow
 *
 * Global system state that persists across restarts.
 */

/**
 * OpenClaw setup status
 */
export type OpenClawSetupStatus = 'ready' | 'setup_required' | 'unknown'

/**
 * Pending action stored for retry after setup
 */
export interface PendingAction {
  input: string
  tenantId: string
  userId?: string
  timestamp: number
  capabilityKey?: string
}

/**
 * System state persisted to disk
 */
export interface SystemState {
  /** OpenClaw requires setup/pairing */
  openclawRequiresSetup: boolean
  /** Current setup status */
  openclawSetupStatus: OpenClawSetupStatus
  /** Last error message from OpenClaw */
  lastError?: string
  /** Last time we checked OpenClaw status */
  lastChecked?: number
  /** Last successful OpenClaw execution */
  lastSuccessfulExecution?: number
  /** Pending action to retry after setup */
  pendingAction?: PendingAction
  /** State version for migrations */
  version: number
}

/**
 * Default system state
 */
export const DEFAULT_SYSTEM_STATE: SystemState = {
  openclawRequiresSetup: false,
  openclawSetupStatus: 'unknown',
  version: 1
}
