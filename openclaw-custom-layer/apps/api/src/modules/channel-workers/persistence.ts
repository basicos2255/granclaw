/**
 * Worker State Persistence
 * P5: Durable Operational Workers & Real Connectors
 *
 * Persists worker state to survive restarts.
 */

import * as fs from 'fs'
import * as path from 'path'
import type { WorkerPersistedState } from './types'

/**
 * Data directory for worker states
 */
const DATA_DIR = path.join(process.cwd(), 'data')
const WORKERS_FILE = path.join(DATA_DIR, 'worker-states.json')

/**
 * In-memory cache
 */
let stateCache: Map<string, WorkerPersistedState> = new Map()
let loaded = false

/**
 * Ensure data directory exists
 */
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

/**
 * Load all states from disk
 */
export function loadAllStates(): Map<string, WorkerPersistedState> {
  if (loaded) {
    return stateCache
  }

  ensureDataDir()

  try {
    if (fs.existsSync(WORKERS_FILE)) {
      const data = fs.readFileSync(WORKERS_FILE, 'utf-8')
      const states = JSON.parse(data) as WorkerPersistedState[]

      stateCache = new Map()
      for (const state of states) {
        stateCache.set(state.channelId, state)
      }

      console.log(`[Persistence] Loaded ${stateCache.size} worker states`)
    }
  } catch (error) {
    console.error('[Persistence] Failed to load states:', error)
    stateCache = new Map()
  }

  loaded = true
  return stateCache
}

/**
 * Save all states to disk
 */
export function saveAllStates(): void {
  ensureDataDir()

  try {
    const states = Array.from(stateCache.values())
    fs.writeFileSync(WORKERS_FILE, JSON.stringify(states, null, 2))
    console.log(`[Persistence] Saved ${states.length} worker states`)
  } catch (error) {
    console.error('[Persistence] Failed to save states:', error)
  }
}

/**
 * Load state for a specific channel
 */
export function loadWorkerState(channelId: string): WorkerPersistedState | null {
  if (!loaded) {
    loadAllStates()
  }

  return stateCache.get(channelId) || null
}

/**
 * Save state for a worker
 */
export function saveWorkerState(state: WorkerPersistedState): void {
  if (!loaded) {
    loadAllStates()
  }

  state.savedAt = new Date().toISOString()
  stateCache.set(state.channelId, state)

  // Debounced save to disk
  scheduleSave()
}

/**
 * Delete state for a channel
 */
export function deleteWorkerState(channelId: string): boolean {
  if (!loaded) {
    loadAllStates()
  }

  const deleted = stateCache.delete(channelId)
  if (deleted) {
    scheduleSave()
  }

  return deleted
}

/**
 * Clear all states
 */
export function clearAllStates(): void {
  stateCache.clear()
  saveAllStates()
}

/**
 * Get all channel IDs with saved state
 */
export function getSavedChannelIds(): string[] {
  if (!loaded) {
    loadAllStates()
  }

  return Array.from(stateCache.keys())
}

/**
 * Check if state exists for channel
 */
export function hasWorkerState(channelId: string): boolean {
  if (!loaded) {
    loadAllStates()
  }

  return stateCache.has(channelId)
}

/**
 * Debounce save to disk
 */
let saveTimeout: ReturnType<typeof setTimeout> | null = null

function scheduleSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }

  saveTimeout = setTimeout(() => {
    saveAllStates()
    saveTimeout = null
  }, 1000) // Save after 1 second of no changes
}

/**
 * Force immediate save
 */
export function flushToDisk(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }
  saveAllStates()
}

/**
 * Get persistence stats
 */
export function getPersistenceStats(): {
  totalStates: number
  oldestState?: string
  newestState?: string
  fileSize?: number
} {
  if (!loaded) {
    loadAllStates()
  }

  let oldest: string | undefined
  let newest: string | undefined

  for (const state of stateCache.values()) {
    if (!oldest || state.savedAt < oldest) {
      oldest = state.savedAt
    }
    if (!newest || state.savedAt > newest) {
      newest = state.savedAt
    }
  }

  let fileSize: number | undefined
  try {
    if (fs.existsSync(WORKERS_FILE)) {
      const stats = fs.statSync(WORKERS_FILE)
      fileSize = stats.size
    }
  } catch {
    // Ignore
  }

  return {
    totalStates: stateCache.size,
    oldestState: oldest,
    newestState: newest,
    fileSize
  }
}

/**
 * Cleanup old states
 */
export function cleanupOldStates(maxAgeMs: number): number {
  if (!loaded) {
    loadAllStates()
  }

  const cutoff = Date.now() - maxAgeMs
  let cleaned = 0

  for (const [channelId, state] of stateCache) {
    const savedAt = new Date(state.savedAt).getTime()
    if (savedAt < cutoff) {
      stateCache.delete(channelId)
      cleaned++
    }
  }

  if (cleaned > 0) {
    saveAllStates()
    console.log(`[Persistence] Cleaned up ${cleaned} old states`)
  }

  return cleaned
}
