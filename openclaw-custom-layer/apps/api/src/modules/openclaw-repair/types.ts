/**
 * OpenClaw Repair Types
 * FIX 125: Pairing Auto-Repair Action Button
 *
 * Types for managing repair sessions when OpenClaw needs pairing/scopes.
 */

import type { OpenClawScopeKey } from '../system-state'

/**
 * Status of a repair session
 */
export type RepairSessionStatus =
  | 'pending'        // Just created, waiting for user action
  | 'waiting_user'   // User navigated to setup, waiting for them to authorize
  | 'checking'       // Checking if authorization was successful
  | 'ready'          // Authorization verified, can retry action
  | 'failed'         // Authorization check failed
  | 'cancelled'      // User cancelled the repair

/**
 * Repair session for tracking OpenClaw pairing/scope recovery
 */
export interface RepairSession {
  /** Unique session ID */
  id: string
  /** Tenant ID */
  tenantId: string
  /** User ID */
  userId: string
  /** Scope that needs authorization */
  scopeKey: OpenClawScopeKey
  /** Specific capability if known */
  capabilityKey?: string
  /** Original user input that triggered the error */
  originalInput: string
  /** Current session status */
  status: RepairSessionStatus
  /** Error message from OpenClaw */
  originalError?: string
  /** Last check error if any */
  lastCheckError?: string
  /** Number of check attempts */
  checkAttempts: number
  /** When session was created */
  createdAt: string
  /** Last update timestamp */
  updatedAt: string
  /** When status became ready */
  readyAt?: string
  /** When retry was executed */
  retriedAt?: string
}

/**
 * Input for starting a repair session
 */
export interface StartRepairInput {
  /** Scope requiring authorization */
  scopeKey: OpenClawScopeKey
  /** Specific capability if known */
  capabilityKey?: string
  /** Original user input */
  originalInput: string
  /** Error message from OpenClaw */
  error?: string
}

/**
 * Result of starting a repair session
 */
export interface StartRepairResult {
  success: boolean
  repairSession?: RepairSession
  setupUrl?: string
  error?: string
}

/**
 * Result of checking repair authorization
 */
export interface CheckRepairResult {
  success: boolean
  repairSession?: RepairSession
  canRetry: boolean
  message: string
  instructions?: string
}

/**
 * Persisted state for all repair sessions
 */
export interface RepairSessionsState {
  version: number
  sessions: RepairSession[]
  lastUpdated: string
}

/**
 * Default state
 */
export const DEFAULT_REPAIR_SESSIONS_STATE: RepairSessionsState = {
  version: 1,
  sessions: [],
  lastUpdated: new Date().toISOString()
}

/**
 * History event types for repair flow
 */
export type RepairEventType =
  | 'repair_started'
  | 'repair_checked'
  | 'repair_ready'
  | 'repair_failed'
  | 'repair_cancelled'
  | 'retry_after_repair'

/**
 * Repair history event
 */
export interface RepairHistoryEvent {
  id: string
  repairSessionId: string
  eventType: RepairEventType
  tenantId: string
  userId: string
  scopeKey: string
  capabilityKey?: string
  timestamp: string
  details?: string
}
