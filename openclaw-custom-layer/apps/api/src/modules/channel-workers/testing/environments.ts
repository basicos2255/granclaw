/**
 * Runtime Environments
 * P5.1: Controlled Real Testing & Connector Hardening
 *
 * Environment configuration for controlled testing.
 */

/**
 * Runtime environment modes
 */
export type RuntimeEnvironment =
  | 'simulation'      // Fully mocked, no real connections
  | 'sandbox'         // Test accounts, real protocols
  | 'controlled_real' // Real accounts with safety limits
  | 'production'      // Full production mode

/**
 * Default environment
 */
let currentEnvironment: RuntimeEnvironment = 'sandbox'

/**
 * Environment configuration
 */
export interface EnvironmentConfig {
  mode: RuntimeEnvironment
  features: EnvironmentFeatures
  limits: EnvironmentLimits
  safety: EnvironmentSafety
}

/**
 * Features enabled per environment
 */
export interface EnvironmentFeatures {
  realConnections: boolean
  realSending: boolean
  realReceiving: boolean
  webhooksEnabled: boolean
  autonomousActions: boolean
  approvalRequired: boolean
}

/**
 * Limits per environment
 */
export interface EnvironmentLimits {
  maxWorkersPerChannel: number
  maxActionsPerHour: number
  maxRecipientsPerAction: number
  maxRetries: number
  cooldownMs: number
}

/**
 * Safety settings per environment
 */
export interface EnvironmentSafety {
  dryRunDefault: boolean
  requireApproval: boolean
  antiLoopEnabled: boolean
  escalationKeywords: string[]
  blockedPatterns: RegExp[]
}

/**
 * Environment configurations
 */
const environments: Record<RuntimeEnvironment, EnvironmentConfig> = {
  simulation: {
    mode: 'simulation',
    features: {
      realConnections: false,
      realSending: false,
      realReceiving: false,
      webhooksEnabled: false,
      autonomousActions: true,
      approvalRequired: false
    },
    limits: {
      maxWorkersPerChannel: 100,
      maxActionsPerHour: 10000,
      maxRecipientsPerAction: 1000,
      maxRetries: 10,
      cooldownMs: 0
    },
    safety: {
      dryRunDefault: true,
      requireApproval: false,
      antiLoopEnabled: false,
      escalationKeywords: [],
      blockedPatterns: []
    }
  },

  sandbox: {
    mode: 'sandbox',
    features: {
      realConnections: true,
      realSending: true,
      realReceiving: true,
      webhooksEnabled: true,
      autonomousActions: false,
      approvalRequired: true
    },
    limits: {
      maxWorkersPerChannel: 5,
      maxActionsPerHour: 100,
      maxRecipientsPerAction: 10,
      maxRetries: 3,
      cooldownMs: 5000
    },
    safety: {
      dryRunDefault: false,
      requireApproval: true,
      antiLoopEnabled: true,
      escalationKeywords: ['urgent', 'help', 'human', 'stop'],
      blockedPatterns: [/mass.?send/i, /bulk/i]
    }
  },

  controlled_real: {
    mode: 'controlled_real',
    features: {
      realConnections: true,
      realSending: true,
      realReceiving: true,
      webhooksEnabled: true,
      autonomousActions: false,
      approvalRequired: true
    },
    limits: {
      maxWorkersPerChannel: 10,
      maxActionsPerHour: 500,
      maxRecipientsPerAction: 50,
      maxRetries: 5,
      cooldownMs: 2000
    },
    safety: {
      dryRunDefault: false,
      requireApproval: true,
      antiLoopEnabled: true,
      escalationKeywords: ['urgent', 'help', 'human', 'stop', 'escalate'],
      blockedPatterns: [/mass.?send/i, /bulk/i, /spam/i]
    }
  },

  production: {
    mode: 'production',
    features: {
      realConnections: true,
      realSending: true,
      realReceiving: true,
      webhooksEnabled: true,
      autonomousActions: false, // Never autonomous by default
      approvalRequired: true
    },
    limits: {
      maxWorkersPerChannel: 20,
      maxActionsPerHour: 1000,
      maxRecipientsPerAction: 100,
      maxRetries: 5,
      cooldownMs: 1000
    },
    safety: {
      dryRunDefault: false,
      requireApproval: true,
      antiLoopEnabled: true,
      escalationKeywords: ['urgent', 'help', 'human', 'stop', 'escalate', 'emergency'],
      blockedPatterns: [/mass.?send/i, /bulk/i, /spam/i, /phish/i]
    }
  }
}

/**
 * Get current environment
 */
export function getCurrentEnvironment(): RuntimeEnvironment {
  return currentEnvironment
}

/**
 * Set current environment
 */
export function setEnvironment(env: RuntimeEnvironment): void {
  console.log(`[Environment] Switching to: ${env}`)
  currentEnvironment = env
}

/**
 * Get environment config
 */
export function getEnvironmentConfig(env?: RuntimeEnvironment): EnvironmentConfig {
  return environments[env ?? currentEnvironment]
}

/**
 * Check if feature is enabled
 */
export function isFeatureEnabled(
  feature: keyof EnvironmentFeatures,
  env?: RuntimeEnvironment
): boolean {
  const config = getEnvironmentConfig(env)
  return config.features[feature]
}

/**
 * Get limit value
 */
export function getLimit(
  limit: keyof EnvironmentLimits,
  env?: RuntimeEnvironment
): number {
  const config = getEnvironmentConfig(env)
  return config.limits[limit]
}

/**
 * Check if action is allowed
 */
export function isActionAllowed(
  action: string,
  env?: RuntimeEnvironment
): { allowed: boolean; reason?: string } {
  const config = getEnvironmentConfig(env)

  // Check blocked patterns
  for (const pattern of config.safety.blockedPatterns) {
    if (pattern.test(action)) {
      return {
        allowed: false,
        reason: `Action matches blocked pattern: ${pattern}`
      }
    }
  }

  return { allowed: true }
}

/**
 * Check if escalation keyword detected
 */
export function hasEscalationKeyword(
  text: string,
  env?: RuntimeEnvironment
): boolean {
  const config = getEnvironmentConfig(env)
  const lower = text.toLowerCase()

  return config.safety.escalationKeywords.some(keyword =>
    lower.includes(keyword.toLowerCase())
  )
}

/**
 * Validate environment transition
 */
export function canTransitionTo(
  targetEnv: RuntimeEnvironment
): { allowed: boolean; requirements?: string[] } {
  const current = currentEnvironment

  // Cannot go directly to production from simulation
  if (current === 'simulation' && targetEnv === 'production') {
    return {
      allowed: false,
      requirements: ['Must pass through sandbox and controlled_real first']
    }
  }

  // Cannot go to production without approval system enabled
  if (targetEnv === 'production') {
    return {
      allowed: true,
      requirements: [
        'Ensure approval system is enabled',
        'Verify all workers have safety gates',
        'Confirm monitoring is active'
      ]
    }
  }

  return { allowed: true }
}

/**
 * Environment summary for logging
 */
export function getEnvironmentSummary(): {
  mode: RuntimeEnvironment
  realConnections: boolean
  autonomousActions: boolean
  approvalRequired: boolean
  maxActionsPerHour: number
} {
  const config = getEnvironmentConfig()
  return {
    mode: config.mode,
    realConnections: config.features.realConnections,
    autonomousActions: config.features.autonomousActions,
    approvalRequired: config.features.approvalRequired,
    maxActionsPerHour: config.limits.maxActionsPerHour
  }
}
