/**
 * System State Types
 * FIX 123: OpenClaw Persistent Setup & Pairing Flow
 * FIX 123.1: OpenClaw Setup Hardening & Scoped Reauthorization
 *
 * Global system state that persists across restarts.
 */

/**
 * OpenClaw setup status
 */
export type OpenClawSetupStatus = 'ready' | 'setup_required' | 'unknown'

/**
 * FIX 123.1: Known scope keys for OpenClaw capabilities
 */
export type OpenClawScopeKey =
  | 'os:open_app'
  | 'os:install'
  | 'os:filesystem'
  | 'os:browser'
  | 'os:system'
  | 'openclaw:unknown_scope'

/**
 * FIX 123.1: Granular setup requirement
 */
export interface OpenClawSetupRequirement {
  id: string
  scopeKey: OpenClawScopeKey
  capabilityKey?: string
  provider: 'openclaw'
  reason: string
  originalError?: string
  status: 'active' | 'resolved'
  createdAt: string
  updatedAt: string
  resolvedAt?: string
}

/**
 * Pending action stored for retry after setup
 */
export interface PendingAction {
  input: string
  tenantId: string
  userId?: string
  timestamp: number
  capabilityKey?: string
  scopeKey?: OpenClawScopeKey
}

/**
 * System state persisted to disk
 */
export interface SystemState {
  /** OpenClaw requires setup/pairing (derived from setupRequirements) */
  openclawRequiresSetup: boolean
  /** Current setup status */
  openclawSetupStatus: OpenClawSetupStatus
  /** FIX 123.1: Granular setup requirements */
  setupRequirements: OpenClawSetupRequirement[]
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
  setupRequirements: [],
  version: 2
}
