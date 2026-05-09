/**
 * OpenClaw Capability Check
 * P6.4R: Persistent Pairing, Auth Lifecycle & Route Consistency
 *
 * Validates capability usability based on auth state.
 */

import { loadAuthState } from './persistence'
import { getAuthHealth, recordScopeNeedsAuth, clearScopeAuth } from './pairing-state'
import type { CapabilityUsabilityResult, OpenClawAuthState } from './types'

// =============================================================================
// Capability Usability Check (CRITICAL FUNCTION)
// =============================================================================

/**
 * Check if a capability is actually usable
 *
 * This is the CRITICAL function that should be called before
 * attempting to execute any OpenClaw capability.
 *
 * @param scopeKey - The scope key to check (e.g., 'os:browser', 'os:filesystem')
 * @returns Usability result with detailed status
 */
export function isCapabilityActuallyUsable(scopeKey?: string): CapabilityUsabilityResult {
  const state = loadAuthState()

  // 1. Check overall state first
  if (state.overall === 'disconnected') {
    return {
      usable: false,
      reason: 'OpenClaw is not connected',
      requiresAuth: false
    }
  }

  if (state.overall === 'unknown') {
    return {
      usable: false,
      reason: 'OpenClaw connection status unknown. Run health check first.',
      requiresAuth: false
    }
  }

  if (state.overall === 'expired') {
    return {
      usable: false,
      reason: 'OpenClaw session has expired',
      requiresAuth: true,
      repairUrl: '/openclaw/repair'
    }
  }

  if (state.overall === 'reauthorization_required') {
    return {
      usable: false,
      reason: 'OpenClaw requires re-authorization',
      requiresAuth: true,
      repairUrl: '/openclaw/repair'
    }
  }

  if (state.overall === 'repair_required') {
    return {
      usable: false,
      reason: 'OpenClaw requires manual repair',
      requiresAuth: true,
      repairUrl: '/openclaw/repair'
    }
  }

  // 2. Check specific scope if provided
  if (scopeKey && state.scopesNeedingAuth.includes(scopeKey)) {
    return {
      usable: false,
      reason: `Scope ${scopeKey} requires re-authorization`,
      requiresAuth: true,
      scopeKey,
      repairUrl: `/openclaw/repair?scope=${encodeURIComponent(scopeKey)}`
    }
  }

  // 3. Check if we're degraded (some scopes failing but not this one)
  if (state.overall === 'degraded') {
    // If specific scope was requested and it's not in the failing list, allow it
    if (scopeKey) {
      return {
        usable: true,
        requiresAuth: false
      }
    }

    // If no specific scope, report degraded state
    return {
      usable: true, // Still usable, but degraded
      reason: 'OpenClaw is operating in degraded mode. Some scopes may require re-authorization.',
      requiresAuth: false
    }
  }

  // 4. All checks passed - capability is usable
  if (state.overall === 'paired' || state.overall === 'connected') {
    return {
      usable: true,
      requiresAuth: false
    }
  }

  // 5. Unknown state - be conservative
  return {
    usable: false,
    reason: `Unknown OpenClaw state: ${state.overall}`,
    requiresAuth: false
  }
}

// =============================================================================
// Scope Management
// =============================================================================

/**
 * Mark a scope as needing re-authorization
 */
export function markScopeNeedsAuth(scopeKey: string): void {
  recordScopeNeedsAuth(scopeKey)
}

/**
 * Mark a scope as re-authorized
 */
export function markScopeAuthorized(scopeKey: string): void {
  clearScopeAuth(scopeKey)
}

/**
 * Get list of scopes needing authorization
 */
export function getScopesNeedingAuth(): string[] {
  const state = loadAuthState()
  return [...state.scopesNeedingAuth]
}

/**
 * Check if any scopes need authorization
 */
export function hasScopesNeedingAuth(): boolean {
  const state = loadAuthState()
  return state.scopesNeedingAuth.length > 0
}

// =============================================================================
// Batch Capability Check
// =============================================================================

/**
 * Check multiple capabilities at once
 */
export function checkMultipleCapabilities(
  scopeKeys: string[]
): Map<string, CapabilityUsabilityResult> {
  const results = new Map<string, CapabilityUsabilityResult>()

  for (const scopeKey of scopeKeys) {
    results.set(scopeKey, isCapabilityActuallyUsable(scopeKey))
  }

  return results
}

/**
 * Check if all specified capabilities are usable
 */
export function areAllCapabilitiesUsable(scopeKeys: string[]): boolean {
  return scopeKeys.every(key => isCapabilityActuallyUsable(key).usable)
}

/**
 * Get unusable capabilities from a list
 */
export function getUnusableCapabilities(scopeKeys: string[]): string[] {
  return scopeKeys.filter(key => !isCapabilityActuallyUsable(key).usable)
}

// =============================================================================
// Pre-Execution Check
// =============================================================================

/**
 * Pre-execution capability check
 * Returns detailed info for UI display before execution
 */
export function preExecutionCheck(scopeKey?: string): {
  canProceed: boolean
  state: OpenClawAuthState
  warning?: string
  error?: string
  repairUrl?: string
} {
  const health = getAuthHealth()
  const usability = isCapabilityActuallyUsable(scopeKey)

  if (!usability.usable) {
    return {
      canProceed: false,
      state: health.overall,
      error: usability.reason,
      repairUrl: usability.repairUrl
    }
  }

  // Check for warnings (degraded state)
  if (health.overall === 'degraded') {
    return {
      canProceed: true,
      state: health.overall,
      warning: 'Some OpenClaw scopes are degraded. This capability may work, but others might fail.'
    }
  }

  return {
    canProceed: true,
    state: health.overall
  }
}
