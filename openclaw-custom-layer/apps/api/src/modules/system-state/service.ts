/**
 * System State Service
 * FIX 123: OpenClaw Persistent Setup & Pairing Flow
 *
 * Manages persistent system state stored in data/system-state.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import type { SystemState, PendingAction, OpenClawSetupStatus } from './types'
import { DEFAULT_SYSTEM_STATE } from './types'

// Path to persistent state file
const DATA_DIR = join(process.cwd(), 'data')
const STATE_FILE = join(DATA_DIR, 'system-state.json')

// In-memory cache
let cachedState: SystemState | null = null

/**
 * Ensure data directory exists
 */
function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

/**
 * Load state from disk
 */
function loadState(): SystemState {
  if (cachedState) {
    return cachedState
  }

  ensureDataDir()

  if (!existsSync(STATE_FILE)) {
    cachedState = { ...DEFAULT_SYSTEM_STATE }
    saveState(cachedState)
    return cachedState
  }

  try {
    const raw = readFileSync(STATE_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<SystemState>

    // Merge with defaults for any missing fields
    cachedState = {
      ...DEFAULT_SYSTEM_STATE,
      ...parsed
    }

    return cachedState
  } catch (err) {
    console.error('[SystemState] Error loading state:', err)
    cachedState = { ...DEFAULT_SYSTEM_STATE }
    return cachedState
  }
}

/**
 * Save state to disk
 */
function saveState(state: SystemState): void {
  ensureDataDir()

  try {
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8')
    cachedState = state
    console.log('[SystemState] State saved to disk')
  } catch (err) {
    console.error('[SystemState] Error saving state:', err)
  }
}

/**
 * Get current system state
 */
export function getSystemState(): SystemState {
  return loadState()
}

/**
 * Check if OpenClaw requires setup
 */
export function openclawRequiresSetup(): boolean {
  const state = loadState()
  return state.openclawRequiresSetup
}

/**
 * Get OpenClaw setup status
 */
export function getOpenClawSetupStatus(): OpenClawSetupStatus {
  const state = loadState()
  return state.openclawSetupStatus
}

/**
 * Mark OpenClaw as requiring setup
 */
export function markOpenClawRequiresSetup(error: string): void {
  const state = loadState()

  state.openclawRequiresSetup = true
  state.openclawSetupStatus = 'setup_required'
  state.lastError = error
  state.lastChecked = Date.now()

  saveState(state)

  console.log(`[SystemState] OpenClaw marked as requiring setup: ${error}`)
}

/**
 * Mark OpenClaw as ready (setup complete)
 */
export function markOpenClawReady(): void {
  const state = loadState()

  state.openclawRequiresSetup = false
  state.openclawSetupStatus = 'ready'
  state.lastError = undefined
  state.lastChecked = Date.now()
  state.lastSuccessfulExecution = Date.now()

  saveState(state)

  console.log('[SystemState] OpenClaw marked as ready')
}

/**
 * Record successful OpenClaw execution
 */
export function recordSuccessfulExecution(): void {
  const state = loadState()

  // If we were in setup_required and now succeeded, mark as ready
  if (state.openclawRequiresSetup) {
    state.openclawRequiresSetup = false
    state.openclawSetupStatus = 'ready'
    state.lastError = undefined
  }

  state.lastSuccessfulExecution = Date.now()
  state.lastChecked = Date.now()

  saveState(state)
}

/**
 * Store pending action for retry after setup
 */
export function storePendingAction(action: PendingAction): void {
  const state = loadState()

  state.pendingAction = action

  saveState(state)

  console.log(`[SystemState] Pending action stored: "${action.input.substring(0, 50)}..."`)
}

/**
 * Get and clear pending action
 */
export function consumePendingAction(): PendingAction | undefined {
  const state = loadState()

  const action = state.pendingAction

  if (action) {
    state.pendingAction = undefined
    saveState(state)
    console.log('[SystemState] Pending action consumed')
  }

  return action
}

/**
 * Get pending action without clearing
 */
export function getPendingAction(): PendingAction | undefined {
  const state = loadState()
  return state.pendingAction
}

/**
 * Clear pending action
 */
export function clearPendingAction(): void {
  const state = loadState()

  if (state.pendingAction) {
    state.pendingAction = undefined
    saveState(state)
    console.log('[SystemState] Pending action cleared')
  }
}

/**
 * Update last checked timestamp
 */
export function updateLastChecked(): void {
  const state = loadState()
  state.lastChecked = Date.now()
  saveState(state)
}

/**
 * Reset system state (for testing)
 */
export function resetSystemState(): void {
  cachedState = null
  saveState({ ...DEFAULT_SYSTEM_STATE })
  console.log('[SystemState] State reset to defaults')
}

/**
 * Force reload from disk
 */
export function reloadState(): SystemState {
  cachedState = null
  return loadState()
}
