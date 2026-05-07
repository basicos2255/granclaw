/**
 * Safety Gates
 * P5.1: Controlled Real Testing & Connector Hardening
 *
 * Safety gates to prevent dangerous operations.
 */

import { getCurrentEnvironment, getEnvironmentConfig } from './environments'

/**
 * Safety gate types
 */
export type SafetyGate =
  | 'autonomous_whatsapp'
  | 'unrestricted_browser'
  | 'mass_send'
  | 'production_without_approvals'
  | 'uncontrolled_filesystem'
  | 'external_api_unlimited'

/**
 * Gate status
 */
export interface GateStatus {
  gate: SafetyGate
  blocked: boolean
  reason: string
  override?: {
    allowedBy: string
    expiresAt: string
  }
}

/**
 * Safety gates state
 */
interface SafetyGatesState {
  gates: Map<SafetyGate, GateStatus>
  overrides: Map<SafetyGate, { allowedBy: string; expiresAt: string }>
  violations: Array<{
    gate: SafetyGate
    timestamp: string
    action: string
    blocked: boolean
  }>
}

let gatesState: SafetyGatesState = {
  gates: new Map(),
  overrides: new Map(),
  violations: []
}

/**
 * Gate definitions
 */
const gateDefinitions: Record<SafetyGate, {
  description: string
  blockedByDefault: boolean
  requiresApproval: boolean
}> = {
  autonomous_whatsapp: {
    description: 'Autonomous WhatsApp messaging without human approval',
    blockedByDefault: true,
    requiresApproval: true
  },
  unrestricted_browser: {
    description: 'Browser automation without session limits',
    blockedByDefault: true,
    requiresApproval: true
  },
  mass_send: {
    description: 'Mass sending of messages/emails',
    blockedByDefault: true,
    requiresApproval: true
  },
  production_without_approvals: {
    description: 'Production mode without approval system enabled',
    blockedByDefault: true,
    requiresApproval: true
  },
  uncontrolled_filesystem: {
    description: 'Filesystem access outside sandbox',
    blockedByDefault: true,
    requiresApproval: true
  },
  external_api_unlimited: {
    description: 'Unlimited external API calls',
    blockedByDefault: true,
    requiresApproval: true
  }
}

/**
 * Initialize safety gates
 */
export function initializeSafetyGates(): void {
  gatesState = {
    gates: new Map(),
    overrides: new Map(),
    violations: []
  }

  // Initialize all gates
  for (const [gate, def] of Object.entries(gateDefinitions)) {
    gatesState.gates.set(gate as SafetyGate, {
      gate: gate as SafetyGate,
      blocked: def.blockedByDefault,
      reason: def.description
    })
  }

  console.log('[SafetyGates] Initialized')
}

/**
 * Check if action is allowed
 */
export function checkGate(gate: SafetyGate): {
  allowed: boolean
  reason?: string
} {
  const env = getCurrentEnvironment()
  const envConfig = getEnvironmentConfig()

  // Get gate status
  const status = gatesState.gates.get(gate)
  if (!status) {
    return { allowed: false, reason: 'Unknown gate' }
  }

  // Check override
  const override = gatesState.overrides.get(gate)
  if (override) {
    const expiresAt = new Date(override.expiresAt).getTime()
    if (Date.now() < expiresAt) {
      return { allowed: true }
    } else {
      // Override expired
      gatesState.overrides.delete(gate)
    }
  }

  // Gate-specific checks
  switch (gate) {
    case 'autonomous_whatsapp':
      if (env === 'simulation') return { allowed: true }
      if (!envConfig.features.autonomousActions) {
        return { allowed: false, reason: 'Autonomous actions disabled' }
      }
      break

    case 'production_without_approvals':
      if (env === 'production' && !envConfig.features.approvalRequired) {
        return { allowed: false, reason: 'Production requires approval system' }
      }
      break

    case 'mass_send':
      if (env !== 'simulation') {
        return { allowed: false, reason: 'Mass send blocked outside simulation' }
      }
      break

    case 'unrestricted_browser':
      if (env === 'production') {
        return { allowed: false, reason: 'Unrestricted browser blocked in production' }
      }
      break

    case 'uncontrolled_filesystem':
      if (env !== 'simulation' && env !== 'sandbox') {
        return { allowed: false, reason: 'Filesystem access restricted' }
      }
      break
  }

  // Default to gate status
  if (status.blocked) {
    return { allowed: false, reason: status.reason }
  }

  return { allowed: true }
}

/**
 * Request gate override (requires approval)
 */
export function requestGateOverride(
  gate: SafetyGate,
  requestedBy: string,
  durationMs: number = 3600000 // 1 hour default
): {
  approved: boolean
  requiresManualApproval?: boolean
  reason?: string
} {
  const def = gateDefinitions[gate]
  if (!def) {
    return { approved: false, reason: 'Unknown gate' }
  }

  // Simulation mode auto-approves
  const env = getCurrentEnvironment()
  if (env === 'simulation') {
    approveGateOverride(gate, requestedBy, durationMs)
    return { approved: true }
  }

  // Other modes require manual approval
  if (def.requiresApproval) {
    return {
      approved: false,
      requiresManualApproval: true,
      reason: 'Gate requires manual approval'
    }
  }

  return { approved: false, reason: 'Gate override not allowed' }
}

/**
 * Approve gate override (admin action)
 */
export function approveGateOverride(
  gate: SafetyGate,
  allowedBy: string,
  durationMs: number
): void {
  const expiresAt = new Date(Date.now() + durationMs).toISOString()

  gatesState.overrides.set(gate, { allowedBy, expiresAt })

  const status = gatesState.gates.get(gate)
  if (status) {
    status.blocked = false
    status.override = { allowedBy, expiresAt }
  }

  console.log(`[SafetyGates] Override approved: ${gate} by ${allowedBy}`)
}

/**
 * Revoke gate override
 */
export function revokeGateOverride(gate: SafetyGate): void {
  gatesState.overrides.delete(gate)

  const status = gatesState.gates.get(gate)
  if (status) {
    const def = gateDefinitions[gate]
    status.blocked = def?.blockedByDefault ?? true
    status.override = undefined
  }

  console.log(`[SafetyGates] Override revoked: ${gate}`)
}

/**
 * Record gate violation attempt
 */
export function recordViolation(
  gate: SafetyGate,
  action: string,
  blocked: boolean
): void {
  gatesState.violations.push({
    gate,
    timestamp: new Date().toISOString(),
    action,
    blocked
  })

  // Keep only last 100 violations
  if (gatesState.violations.length > 100) {
    gatesState.violations = gatesState.violations.slice(-100)
  }

  if (blocked) {
    console.warn(`[SafetyGates] Blocked: ${gate} - ${action}`)
  }
}

/**
 * Get all gate statuses
 */
export function getAllGateStatuses(): GateStatus[] {
  return Array.from(gatesState.gates.values())
}

/**
 * Get violations
 */
export function getViolations(limit = 50): typeof gatesState.violations {
  return gatesState.violations.slice(-limit)
}

/**
 * Check production readiness
 */
export function checkProductionReadiness(): {
  ready: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  const envConfig = getEnvironmentConfig('production')

  // Check approval system
  if (!envConfig.features.approvalRequired) {
    blockers.push('Approval system must be enabled for production')
  }

  // Check autonomous actions disabled
  if (envConfig.features.autonomousActions) {
    blockers.push('Autonomous actions must be disabled for production')
  }

  // Check all critical gates are blocked
  const criticalGates: SafetyGate[] = [
    'autonomous_whatsapp',
    'mass_send',
    'production_without_approvals'
  ]

  for (const gate of criticalGates) {
    const check = checkGate(gate)
    if (check.allowed) {
      blockers.push(`Safety gate ${gate} must be blocked for production`)
    }
  }

  return {
    ready: blockers.length === 0,
    blockers
  }
}

/**
 * Get safety summary
 */
export function getSafetySummary(): {
  totalGates: number
  blockedGates: number
  activeOverrides: number
  recentViolations: number
  productionReady: boolean
} {
  const now = Date.now()
  const activeOverrides = Array.from(gatesState.overrides.values())
    .filter(o => new Date(o.expiresAt).getTime() > now).length

  const recentViolations = gatesState.violations
    .filter(v => Date.now() - new Date(v.timestamp).getTime() < 3600000).length

  const { ready } = checkProductionReadiness()

  return {
    totalGates: gatesState.gates.size,
    blockedGates: Array.from(gatesState.gates.values()).filter(g => g.blocked).length,
    activeOverrides,
    recentViolations,
    productionReady: ready
  }
}
