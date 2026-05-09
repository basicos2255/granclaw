/**
 * OpenClaw Auth Persistence
 * P6.4R: Persistent Pairing, Auth Lifecycle & Route Consistency
 *
 * Handles persistent storage of OpenClaw auth state.
 */

import { readFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { atomicWriteJson } from '../../shared/atomic-persistence'
import type { OpenClawAuthData } from './types'
import { DEFAULT_AUTH_STATE } from './types'

// =============================================================================
// Constants
// =============================================================================

const DATA_DIR = join(process.cwd(), 'data')
const STATE_FILE = join(DATA_DIR, 'openclaw-auth-state.json')
const MAX_EVENT_LOG = 50

// =============================================================================
// In-Memory Cache
// =============================================================================

let cachedState: OpenClawAuthData | null = null

// =============================================================================
// Directory Management
// =============================================================================

/**
 * Ensure data directory exists
 */
function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

// =============================================================================
// Load/Save Operations
// =============================================================================

/**
 * Load auth state from disk
 */
export function loadAuthState(): OpenClawAuthData {
  if (cachedState) {
    return cachedState
  }

  ensureDataDir()

  if (!existsSync(STATE_FILE)) {
    cachedState = { ...DEFAULT_AUTH_STATE }
    saveAuthState(cachedState)
    return cachedState
  }

  try {
    const raw = readFileSync(STATE_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<OpenClawAuthData>

    // Merge with defaults for forward compatibility
    cachedState = {
      ...DEFAULT_AUTH_STATE,
      ...parsed,
      recentEvents: parsed.recentEvents || [],
      scopesNeedingAuth: parsed.scopesNeedingAuth || []
    }

    return cachedState
  } catch (err) {
    console.error('[OpenClawAuth] Error loading state:', err)
    cachedState = { ...DEFAULT_AUTH_STATE }
    return cachedState
  }
}

/**
 * Save auth state to disk
 */
export function saveAuthState(state: OpenClawAuthData): boolean {
  // Update timestamp
  state.updatedAt = new Date().toISOString()

  // Trim event log if needed
  if (state.recentEvents.length > MAX_EVENT_LOG) {
    state.recentEvents = state.recentEvents.slice(0, MAX_EVENT_LOG)
  }

  const result = atomicWriteJson(STATE_FILE, state, {
    createBackup: true,
    ensureDir: true
  })

  if (result.success) {
    cachedState = state
    return true
  } else {
    console.error('[OpenClawAuth] Error saving state:', result.error)
    return false
  }
}

/**
 * Reset auth state to defaults
 */
export function resetAuthState(): OpenClawAuthData {
  cachedState = null
  const newState = { ...DEFAULT_AUTH_STATE }
  saveAuthState(newState)
  console.log('[OpenClawAuth] State reset to defaults')
  return loadAuthState()
}

/**
 * Force reload from disk (bypass cache)
 */
export function reloadAuthState(): OpenClawAuthData {
  cachedState = null
  return loadAuthState()
}

/**
 * Get state file path (for debugging)
 */
export function getStateFilePath(): string {
  return STATE_FILE
}

/**
 * Check if state file exists
 */
export function stateFileExists(): boolean {
  return existsSync(STATE_FILE)
}
