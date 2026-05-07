/**
 * Channel Runtime Integration
 * P3: Real Integrations & Operational Channels
 *
 * Integrates channels with the runtime queue and DAG system.
 */

import type {
  ChannelEvent,
  ChannelActionRequest,
  ChannelActionResult,
  ChannelConfig,
  ChannelSafetyLimits
} from './types'
import { eventBus } from '../event-bus'
import { emitChannelEvent } from './event-adapter'
import { actionRequiresApproval, getActionRiskLevel } from './permissions'

/**
 * Default safety limits
 */
const DEFAULT_SAFETY_LIMITS: ChannelSafetyLimits = {
  maxMessagesPerMinute: 10,
  maxMessagesPerHour: 100,
  maxMessagesPerDay: 500,
  requireApprovalAbove: 50,
  blockRecursiveReplies: true,
  humanEscalationThreshold: 5
}

/**
 * Rate limit tracking per channel
 */
interface RateLimitTracker {
  minuteCount: number
  hourCount: number
  dayCount: number
  minuteReset: number
  hourReset: number
  dayReset: number
  consecutiveErrors: number
  lastMessageHash?: string
}

const rateLimitTrackers: Map<string, RateLimitTracker> = new Map()

/**
 * Get or create rate limit tracker
 */
function getRateLimitTracker(channelId: string): RateLimitTracker {
  const now = Date.now()
  let tracker = rateLimitTrackers.get(channelId)

  if (!tracker) {
    tracker = {
      minuteCount: 0,
      hourCount: 0,
      dayCount: 0,
      minuteReset: now + 60000,
      hourReset: now + 3600000,
      dayReset: now + 86400000,
      consecutiveErrors: 0
    }
    rateLimitTrackers.set(channelId, tracker)
  }

  // Reset counters if time has passed
  if (now > tracker.minuteReset) {
    tracker.minuteCount = 0
    tracker.minuteReset = now + 60000
  }
  if (now > tracker.hourReset) {
    tracker.hourCount = 0
    tracker.hourReset = now + 3600000
  }
  if (now > tracker.dayReset) {
    tracker.dayCount = 0
    tracker.dayReset = now + 86400000
  }

  return tracker
}

/**
 * Check if action is within rate limits
 */
export function checkRateLimits(
  channelId: string,
  limits: ChannelSafetyLimits = DEFAULT_SAFETY_LIMITS
): { allowed: boolean; reason?: string; waitMs?: number } {
  const tracker = getRateLimitTracker(channelId)

  if (tracker.minuteCount >= limits.maxMessagesPerMinute) {
    return {
      allowed: false,
      reason: 'Rate limit exceeded: max per minute',
      waitMs: tracker.minuteReset - Date.now()
    }
  }

  if (tracker.hourCount >= limits.maxMessagesPerHour) {
    return {
      allowed: false,
      reason: 'Rate limit exceeded: max per hour',
      waitMs: tracker.hourReset - Date.now()
    }
  }

  if (tracker.dayCount >= limits.maxMessagesPerDay) {
    return {
      allowed: false,
      reason: 'Rate limit exceeded: max per day',
      waitMs: tracker.dayReset - Date.now()
    }
  }

  return { allowed: true }
}

/**
 * Increment rate limit counters
 */
export function incrementRateLimits(channelId: string): void {
  const tracker = getRateLimitTracker(channelId)
  tracker.minuteCount++
  tracker.hourCount++
  tracker.dayCount++
}

/**
 * Check for recursive reply (spam prevention)
 */
export function isRecursiveReply(
  channelId: string,
  messageContent: string,
  limits: ChannelSafetyLimits = DEFAULT_SAFETY_LIMITS
): boolean {
  if (!limits.blockRecursiveReplies) return false

  const tracker = getRateLimitTracker(channelId)
  const hash = simpleHash(messageContent)

  if (tracker.lastMessageHash === hash) {
    return true
  }

  tracker.lastMessageHash = hash
  return false
}

/**
 * Simple hash for message comparison
 */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(36)
}

/**
 * Check if human escalation is needed
 */
export function needsHumanEscalation(
  channelId: string,
  limits: ChannelSafetyLimits = DEFAULT_SAFETY_LIMITS
): boolean {
  const tracker = getRateLimitTracker(channelId)
  return tracker.consecutiveErrors >= limits.humanEscalationThreshold
}

/**
 * Record error for escalation tracking
 */
export function recordChannelError(channelId: string): void {
  const tracker = getRateLimitTracker(channelId)
  tracker.consecutiveErrors++
}

/**
 * Reset error count on success
 */
export function recordChannelSuccess(channelId: string): void {
  const tracker = getRateLimitTracker(channelId)
  tracker.consecutiveErrors = 0
}

/**
 * Enqueue channel action to runtime queue
 */
export async function enqueueChannelAction<T = unknown>(
  config: ChannelConfig,
  action: string,
  params: T,
  options: {
    userId?: string
    priority?: 'low' | 'normal' | 'high' | 'urgent'
    timeout?: number
    correlationId?: string
  } = {}
): Promise<{ queued: boolean; requestId?: string; approvalRequired?: boolean; error?: string }> {
  // Check rate limits first
  const rateCheck = checkRateLimits(config.id, config.rateLimit as ChannelSafetyLimits | undefined)
  if (!rateCheck.allowed) {
    return { queued: false, error: rateCheck.reason }
  }

  // Check if approval is required
  const scopesForAction = getScopesForAction(config.type, action)
  const requiresApproval = actionRequiresApproval(action, scopesForAction, config.approvalMode)
  const riskLevel = getActionRiskLevel(scopesForAction)

  // Generate request ID
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const request: ChannelActionRequest<T> = {
    id: requestId,
    channelId: config.id,
    action,
    params,
    tenantId: config.tenantId,
    userId: options.userId,
    requiresApproval,
    priority: options.priority || 'normal',
    timeout: options.timeout,
    retryPolicy: {
      maxRetries: 3,
      backoffMs: 1000
    }
  }

  // If approval required, create approval request
  if (requiresApproval) {
    eventBus.emit('approval:required', {
      id: `apr_${requestId}`,
      type: 'channel_action',
      channelId: config.id,
      channelType: config.type,
      action,
      riskLevel,
      request,
      tenantId: config.tenantId,
      userId: options.userId,
      createdAt: new Date().toISOString()
    })

    return { queued: true, requestId, approvalRequired: true }
  }

  // Emit to runtime queue
  eventBus.emit('runtime:enqueue', {
    type: 'channel_action',
    request,
    correlationId: options.correlationId
  })

  // Track rate limit
  incrementRateLimits(config.id)

  return { queued: true, requestId, approvalRequired: false }
}

/**
 * Get scopes required for an action
 */
function getScopesForAction(channelType: string, action: string): string[] {
  // Map common actions to scopes
  const scopeMap: Record<string, Record<string, string[]>> = {
    email: {
      send: ['email.send'],
      reply: ['email.send'],
      forward: ['email.send'],
      read: ['email.read'],
      markRead: ['email.read'],
      archive: ['email.read'],
      label: ['email.labels']
    },
    ftp: {
      upload: ['ftp.write'],
      download: ['ftp.read'],
      delete: ['ftp.delete'],
      list: ['ftp.read'],
      sync: ['ftp.read', 'ftp.write']
    },
    sftp: {
      upload: ['sftp.write'],
      download: ['sftp.read'],
      delete: ['sftp.delete'],
      list: ['sftp.read'],
      sync: ['sftp.read', 'sftp.write']
    },
    browser: {
      navigate: ['browser.navigate'],
      click: ['browser.interact'],
      type: ['browser.interact'],
      screenshot: ['browser.screenshot'],
      extract: ['browser.navigate'],
      download: ['browser.download']
    },
    whatsapp: {
      sendMessage: ['whatsapp.send'],
      sendTemplate: ['whatsapp.templates'],
      sendMedia: ['whatsapp.media'],
      read: ['whatsapp.read'],
      markRead: ['whatsapp.read']
    },
    calendar: {
      createEvent: ['calendar.write'],
      updateEvent: ['calendar.write'],
      deleteEvent: ['calendar.write'],
      getEvent: ['calendar.read'],
      listEvents: ['calendar.read'],
      getAvailability: ['calendar.freebusy']
    }
  }

  return scopeMap[channelType]?.[action] || []
}

/**
 * Execute approved channel action
 */
export async function executeApprovedAction(
  approvalId: string,
  request: ChannelActionRequest
): Promise<void> {
  console.log(`[RuntimeIntegration] Executing approved action: ${request.action} on ${request.channelId}`)

  // Check rate limits again before execution
  const rateCheck = checkRateLimits(request.channelId)
  if (!rateCheck.allowed) {
    eventBus.emit('channel:action_failed', {
      requestId: request.id,
      approvalId,
      error: rateCheck.reason
    })
    return
  }

  // Emit to runtime queue for execution
  eventBus.emit('runtime:enqueue', {
    type: 'channel_action',
    request,
    approvalId,
    approved: true
  })

  // Track rate limit
  incrementRateLimits(request.channelId)
}

/**
 * Handle channel action result
 */
export function handleActionResult(result: ChannelActionResult): void {
  const channelId = result.requestId.split('_')[1] // Extract from request ID pattern

  if (result.success) {
    recordChannelSuccess(channelId)
    eventBus.emit('channel:action_complete', result)
  } else {
    recordChannelError(channelId)

    // Check if human escalation needed
    if (needsHumanEscalation(channelId)) {
      eventBus.emit('channel:escalation_required', {
        channelId,
        reason: 'Consecutive errors threshold exceeded',
        lastError: result.error
      })
    }

    eventBus.emit('channel:action_failed', result)
  }
}

/**
 * Create runtime job from channel event
 */
export function createJobFromChannelEvent(
  event: ChannelEvent,
  workflowId: string
): void {
  eventBus.emit('runtime:enqueue', {
    type: 'workflow_trigger',
    workflowId,
    trigger: {
      type: 'channel_event',
      channelId: event.channelId,
      channelType: event.channelType,
      eventType: event.type,
      payload: event.payload
    },
    tenantId: event.tenantId,
    correlationId: event.correlationId || event.id
  })

  console.log(`[RuntimeIntegration] Created workflow job from channel event: ${event.type} -> ${workflowId}`)
}

/**
 * Initialize runtime integration
 */
export function initializeRuntimeIntegration(): void {
  // Listen for workflow triggers from events
  eventBus.on('workflow:trigger', (data: unknown) => {
    const { workflowId, channelEvent } = data as { workflowId: string; channelEvent: ChannelEvent; tenantId: string }
    createJobFromChannelEvent(channelEvent, workflowId)
  })

  // Listen for action results
  eventBus.on('channel:action_result', (result: unknown) => {
    handleActionResult(result as ChannelActionResult)
  })

  console.log('[RuntimeIntegration] Initialized')
}
