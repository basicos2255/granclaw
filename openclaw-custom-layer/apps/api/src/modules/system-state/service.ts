/**
 * System State Service
 * FIX 123: OpenClaw Persistent Setup & Pairing Flow
 * FIX 123.1: OpenClaw Setup Hardening & Scoped Reauthorization
 *
 * Manages persistent system state stored in data/system-state.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { SystemState, PendingAction, OpenClawSetupStatus, OpenClawSetupRequirement, OpenClawScopeKey } from './types'
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

    // FIX 123.1: Migrate from v1 to v2
    if (!parsed.version || parsed.version < 2) {
      console.log('[SystemState] Migrating from v1 to v2')
      parsed.setupRequirements = []
      parsed.version = 2
    }

    // Merge with defaults for any missing fields
    cachedState = {
      ...DEFAULT_SYSTEM_STATE,
      ...parsed,
      setupRequirements: parsed.setupRequirements || []
    }

    // FIX 123.1: Derive openclawRequiresSetup from active requirements
    cachedState.openclawRequiresSetup = cachedState.setupRequirements.some(r => r.status === 'active')

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
 * Mark OpenClaw as requiring setup (legacy - creates generic requirement)
 */
export function markOpenClawRequiresSetup(error: string): void {
  addSetupRequirement({
    scopeKey: 'openclaw:unknown_scope',
    reason: error,
    originalError: error
  })
}

/**
 * FIX 123.1: Add a granular setup requirement
 * FIX 124.2: Improved deduplication - matches by scope even if capabilityKey differs
 */
export function addSetupRequirement(params: {
  scopeKey: OpenClawScopeKey
  capabilityKey?: string
  reason: string
  originalError?: string
}): OpenClawSetupRequirement {
  const state = loadState()

  // FIX 124.2: Check for existing by SCOPE first (primary match)
  // This prevents creating multiple requirements for same scope with different capabilities
  const existingByScope = state.setupRequirements.find(
    r => r.status === 'active' && r.scopeKey === params.scopeKey
  )

  if (existingByScope) {
    // Update existing requirement
    existingByScope.updatedAt = new Date().toISOString()
    existingByScope.reason = params.reason
    existingByScope.originalError = params.originalError
    // FIX 124.2: Keep the most recent capabilityKey if provided
    if (params.capabilityKey) {
      existingByScope.capabilityKey = params.capabilityKey
    }
    saveState(state)
    console.log(`[SystemState] Updated existing requirement by scope: ${params.scopeKey} (${existingByScope.id})`)
    return existingByScope
  }

  // Create new requirement
  const requirement: OpenClawSetupRequirement = {
    id: randomUUID(),
    scopeKey: params.scopeKey,
    capabilityKey: params.capabilityKey,
    provider: 'openclaw',
    reason: params.reason,
    originalError: params.originalError,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  state.setupRequirements.push(requirement)
  state.openclawRequiresSetup = true
  state.openclawSetupStatus = 'setup_required'
  state.lastError = params.reason
  state.lastChecked = Date.now()

  saveState(state)

  console.log(`[SystemState] Added setup requirement: ${params.scopeKey} (${requirement.id})`)
  return requirement
}

/**
 * FIX 123.1: Get active setup requirements
 */
export function getActiveRequirements(): OpenClawSetupRequirement[] {
  const state = loadState()
  return state.setupRequirements.filter(r => r.status === 'active')
}

/**
 * FIX 123.1: Resolve a specific setup requirement
 */
export function resolveSetupRequirement(params: {
  id?: string
  scopeKey?: OpenClawScopeKey
  capabilityKey?: string
}): boolean {
  const state = loadState()
  let resolved = false

  for (const req of state.setupRequirements) {
    if (req.status !== 'active') continue

    // Match by id, scopeKey, or capabilityKey
    const matchesId = params.id && req.id === params.id
    const matchesScope = params.scopeKey && req.scopeKey === params.scopeKey
    const matchesCapability = params.capabilityKey && req.capabilityKey === params.capabilityKey

    if (matchesId || matchesScope || matchesCapability) {
      req.status = 'resolved'
      req.resolvedAt = new Date().toISOString()
      req.updatedAt = new Date().toISOString()
      resolved = true
      console.log(`[SystemState] Resolved requirement: ${req.scopeKey} (${req.id})`)
    }
  }

  if (resolved) {
    // Update derived state
    const hasActiveReqs = state.setupRequirements.some(r => r.status === 'active')
    state.openclawRequiresSetup = hasActiveReqs
    if (!hasActiveReqs) {
      state.openclawSetupStatus = 'ready'
      state.lastError = undefined
    }
    saveState(state)
  }

  return resolved
}

/**
 * FIX 123.1: Resolve all setup requirements
 */
export function resolveAllRequirements(): number {
  const state = loadState()
  let count = 0

  for (const req of state.setupRequirements) {
    if (req.status === 'active') {
      req.status = 'resolved'
      req.resolvedAt = new Date().toISOString()
      req.updatedAt = new Date().toISOString()
      count++
    }
  }

  if (count > 0) {
    state.openclawRequiresSetup = false
    state.openclawSetupStatus = 'ready'
    state.lastError = undefined
    saveState(state)
    console.log(`[SystemState] Resolved ${count} setup requirements`)
  }

  return count
}

/**
 * FIX 123.1: Check if execution should be blocked for specific scope/capability
 */
export function shouldBlockExecution(params: {
  scopeKey?: OpenClawScopeKey
  capabilityKey?: string
}): { blocked: boolean; requirement?: OpenClawSetupRequirement } {
  const state = loadState()
  const activeReqs = state.setupRequirements.filter(r => r.status === 'active')

  if (activeReqs.length === 0) {
    return { blocked: false }
  }

  // Check for exact capabilityKey match
  if (params.capabilityKey) {
    const matchingReq = activeReqs.find(r => r.capabilityKey === params.capabilityKey)
    if (matchingReq) {
      return { blocked: true, requirement: matchingReq }
    }
  }

  // Check for scopeKey match
  if (params.scopeKey) {
    const matchingReq = activeReqs.find(r => r.scopeKey === params.scopeKey)
    if (matchingReq) {
      return { blocked: true, requirement: matchingReq }
    }
  }

  // Check for generic unknown_scope (blocks everything)
  const genericReq = activeReqs.find(r => r.scopeKey === 'openclaw:unknown_scope')
  if (genericReq) {
    return { blocked: true, requirement: genericReq }
  }

  return { blocked: false }
}

/**
 * Mark OpenClaw as ready (verified - resolves all requirements)
 * FIX 123.1: Now requires verification via check-auth
 */
export function markOpenClawReady(): void {
  resolveAllRequirements()

  const state = loadState()
  state.lastSuccessfulExecution = Date.now()
  state.lastChecked = Date.now()
  saveState(state)

  console.log('[SystemState] OpenClaw marked as ready (all requirements resolved)')
}

/**
 * Record successful OpenClaw execution
 * FIX 123.1: Now resolves specific scope/capability requirement
 * FIX 124.2: Only resolves requirements compatible with executed scope
 */
export function recordSuccessfulExecution(params?: {
  scopeKey?: OpenClawScopeKey
  capabilityKey?: string
}): void {
  const state = loadState()

  // FIX 124.2: Resolve ONLY specific requirement if provided
  // This ensures we don't clear unrelated requirements
  if (params?.scopeKey || params?.capabilityKey) {
    const resolved = resolveSetupRequirement({
      scopeKey: params.scopeKey,
      capabilityKey: params.capabilityKey
    })
    if (resolved) {
      console.log(`[SystemState] Scope authorized by successful execution: ${params.scopeKey || params.capabilityKey}`)
    }
  }

  state.lastSuccessfulExecution = Date.now()
  state.lastChecked = Date.now()

  saveState(state)

  console.log('[SystemState] Successful execution recorded')
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
