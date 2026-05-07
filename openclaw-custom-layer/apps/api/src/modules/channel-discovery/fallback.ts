/**
 * Fallback Strategy
 * P4.1R: OpenClaw-First Integrations & Productionization
 *
 * Handles fallback when OpenClaw fails or is unavailable.
 */

import type { ChannelType } from '../channels-runtime/types'
import type {
  FallbackStrategy,
  FallbackTrigger,
  FallbackAction,
  ChannelSource
} from './types'
import { getChannelSourceMapping } from './registry'

/**
 * Fallback strategies per channel type
 */
const fallbackStrategies: Map<ChannelType, FallbackStrategy> = new Map([
  // API Channel: Queue for retry, then use GranClaw provider
  ['api', {
    channelType: 'api',
    triggerConditions: [
      'openclaw_unavailable',
      'timeout',
      'network_error'
    ],
    fallbackAction: 'queue_for_retry',
    maxRetries: 3,
    cooldownMs: 5000
  }],

  // Webhook Channel: Queue for retry
  ['webhook', {
    channelType: 'webhook',
    triggerConditions: [
      'openclaw_unavailable',
      'timeout',
      'network_error'
    ],
    fallbackAction: 'queue_for_retry',
    maxRetries: 5,
    cooldownMs: 10000
  }],

  // Browser Channel: Escalate to human if automation fails
  ['browser', {
    channelType: 'browser',
    triggerConditions: [
      'timeout',
      'capability_disabled'
    ],
    fallbackAction: 'escalate_human',
    maxRetries: 1,
    cooldownMs: 0
  }],

  // Email Channel: Queue for retry
  ['email', {
    channelType: 'email',
    triggerConditions: [
      'auth_expired',
      'rate_limited',
      'network_error'
    ],
    fallbackAction: 'queue_for_retry',
    maxRetries: 3,
    cooldownMs: 60000
  }],

  // WhatsApp Channel: Escalate (no auto-fallback for messaging)
  ['whatsapp', {
    channelType: 'whatsapp',
    triggerConditions: [
      'auth_expired',
      'rate_limited',
      'capability_disabled'
    ],
    fallbackAction: 'escalate_human',
    maxRetries: 0,
    cooldownMs: 0
  }],

  // FTP/SFTP: Queue for retry
  ['ftp', {
    channelType: 'ftp',
    triggerConditions: [
      'auth_expired',
      'network_error',
      'timeout'
    ],
    fallbackAction: 'queue_for_retry',
    maxRetries: 3,
    cooldownMs: 30000
  }],
  ['sftp', {
    channelType: 'sftp',
    triggerConditions: [
      'auth_expired',
      'network_error',
      'timeout'
    ],
    fallbackAction: 'queue_for_retry',
    maxRetries: 3,
    cooldownMs: 30000
  }],

  // Calendar: Queue for retry
  ['calendar', {
    channelType: 'calendar',
    triggerConditions: [
      'auth_expired',
      'rate_limited',
      'network_error'
    ],
    fallbackAction: 'queue_for_retry',
    maxRetries: 3,
    cooldownMs: 30000
  }],

  // Filesystem: Require setup if access denied
  ['filesystem', {
    channelType: 'filesystem',
    triggerConditions: [
      'capability_disabled'
    ],
    fallbackAction: 'require_setup',
    maxRetries: 0,
    cooldownMs: 0
  }]
])

/**
 * Get fallback strategy for channel
 */
export function getFallbackStrategy(channelType: ChannelType): FallbackStrategy | undefined {
  return fallbackStrategies.get(channelType)
}

/**
 * Determine fallback action for error
 */
export function determineFallbackAction(
  channelType: ChannelType,
  error: Error,
  retryCount: number
): { action: FallbackAction; canRetry: boolean; waitMs: number } {
  const strategy = fallbackStrategies.get(channelType)

  if (!strategy) {
    return {
      action: 'escalate_human',
      canRetry: false,
      waitMs: 0
    }
  }

  const trigger = classifyError(error)

  // Check if trigger matches strategy
  if (!strategy.triggerConditions.includes(trigger)) {
    return {
      action: 'escalate_human',
      canRetry: false,
      waitMs: 0
    }
  }

  // Check if retries exhausted
  if (retryCount >= strategy.maxRetries) {
    return {
      action: strategy.fallbackAction === 'queue_for_retry'
        ? 'escalate_human'
        : strategy.fallbackAction,
      canRetry: false,
      waitMs: 0
    }
  }

  return {
    action: strategy.fallbackAction,
    canRetry: strategy.fallbackAction === 'queue_for_retry',
    waitMs: strategy.cooldownMs * Math.pow(2, retryCount) // Exponential backoff
  }
}

/**
 * Classify error to fallback trigger
 */
export function classifyError(error: Error): FallbackTrigger {
  const message = error.message.toLowerCase()

  if (message.includes('timeout')) {
    return 'timeout'
  }
  if (message.includes('auth') || message.includes('expired') || message.includes('401')) {
    return 'auth_expired'
  }
  if (message.includes('rate') || message.includes('429') || message.includes('limit')) {
    return 'rate_limited'
  }
  if (message.includes('network') || message.includes('connection') || message.includes('econnrefused')) {
    return 'network_error'
  }
  if (message.includes('disabled') || message.includes('capability')) {
    return 'capability_disabled'
  }

  return 'openclaw_unavailable'
}

/**
 * Get fallback source for channel
 */
export function getFallbackSource(channelType: ChannelType): ChannelSource | undefined {
  const mapping = getChannelSourceMapping(channelType)
  return mapping?.fallbackSource
}

/**
 * Check if channel has fallback available
 */
export function hasFallbackAvailable(channelType: ChannelType): boolean {
  const mapping = getChannelSourceMapping(channelType)
  return mapping?.fallbackSource !== undefined
}

/**
 * Execute fallback action
 */
export async function executeFallback(
  channelType: ChannelType,
  action: FallbackAction,
  context: {
    tenantId: string
    channelId: string
    originalRequest: unknown
    error: Error
    retryCount: number
  }
): Promise<{
  success: boolean
  action: FallbackAction
  result?: unknown
  nextRetryAt?: string
}> {
  switch (action) {
    case 'queue_for_retry': {
      const strategy = fallbackStrategies.get(channelType)
      const waitMs = (strategy?.cooldownMs ?? 5000) * Math.pow(2, context.retryCount)
      const nextRetryAt = new Date(Date.now() + waitMs).toISOString()

      // In real implementation, would enqueue to runtime-queue
      console.log(`[Fallback] Queuing ${channelType} for retry at ${nextRetryAt}`)

      return {
        success: true,
        action,
        nextRetryAt
      }
    }

    case 'use_granclaw_provider': {
      // Switch to GranClaw native provider
      console.log(`[Fallback] Switching ${channelType} to GranClaw provider`)
      return {
        success: true,
        action
      }
    }

    case 'require_setup': {
      console.log(`[Fallback] ${channelType} requires setup`)
      return {
        success: false,
        action,
        result: { setupRequired: true, channelType }
      }
    }

    case 'escalate_human': {
      console.log(`[Fallback] Escalating ${channelType} to human`)
      return {
        success: false,
        action,
        result: { escalated: true, reason: context.error.message }
      }
    }

    case 'skip': {
      console.log(`[Fallback] Skipping ${channelType} action`)
      return {
        success: true,
        action
      }
    }
  }
}

/**
 * Get fallback summary for audit
 */
export function getFallbackSummary(): Array<{
  channelType: ChannelType
  hasFallback: boolean
  fallbackAction: FallbackAction
  maxRetries: number
}> {
  return Array.from(fallbackStrategies.entries()).map(([type, strategy]) => ({
    channelType: type,
    hasFallback: true,
    fallbackAction: strategy.fallbackAction,
    maxRetries: strategy.maxRetries
  }))
}
