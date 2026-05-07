/**
 * WhatsApp Controlled Mode
 * P5.1: Controlled Real Testing & Connector Hardening
 *
 * Safety controls for WhatsApp worker. NO open production.
 */

import { getCurrentEnvironment, getEnvironmentConfig, hasEscalationKeyword } from './environments'

/**
 * WhatsApp control configuration
 */
export interface WhatsAppControlConfig {
  dryRunMode: boolean
  approvalRequired: boolean
  antiLoopEnabled: boolean
  cooldownMs: number
  maxRepliesPerHour: number
  maxRepliesPerConversation: number
  escalationKeywords: string[]
  blockedPatterns: RegExp[]
}

/**
 * Conversation tracking
 */
export interface ConversationState {
  conversationId: string
  phoneNumber: string
  replyCount: number
  lastReplyAt: string
  escalated: boolean
  blocked: boolean
  processedMessageIds: Set<string>
}

/**
 * WhatsApp control state
 */
interface WhatsAppControlState {
  conversations: Map<string, ConversationState>
  hourlyReplies: number
  hourlyResetAt: string
  sessionState: Record<string, unknown>
  reconnectState: {
    attempts: number
    lastAttempt?: string
    backoffMs: number
  }
}

let controlState: WhatsAppControlState = {
  conversations: new Map(),
  hourlyReplies: 0,
  hourlyResetAt: new Date().toISOString(),
  sessionState: {},
  reconnectState: {
    attempts: 0,
    backoffMs: 1000
  }
}

/**
 * Default control config
 */
const defaultConfig: WhatsAppControlConfig = {
  dryRunMode: true,
  approvalRequired: true,
  antiLoopEnabled: true,
  cooldownMs: 5000,
  maxRepliesPerHour: 50,
  maxRepliesPerConversation: 10,
  escalationKeywords: ['human', 'help', 'stop', 'urgent', 'agent'],
  blockedPatterns: [
    /spam/i,
    /bulk/i,
    /mass.?message/i
  ]
}

let currentConfig: WhatsAppControlConfig = { ...defaultConfig }

/**
 * Initialize WhatsApp controls
 */
export function initializeWhatsAppControls(
  config?: Partial<WhatsAppControlConfig>
): void {
  currentConfig = { ...defaultConfig, ...config }

  // Reset state
  controlState = {
    conversations: new Map(),
    hourlyReplies: 0,
    hourlyResetAt: new Date().toISOString(),
    sessionState: {},
    reconnectState: {
      attempts: 0,
      backoffMs: 1000
    }
  }

  console.log('[WhatsAppControls] Initialized')
}

/**
 * Check if reply is allowed
 */
export function canReply(
  conversationId: string,
  phoneNumber: string,
  messageText: string
): {
  allowed: boolean
  reason?: string
  requiresApproval?: boolean
  dryRun?: boolean
} {
  const env = getCurrentEnvironment()
  const envConfig = getEnvironmentConfig()

  // Production mode requires explicit enablement
  if (env === 'production' && !envConfig.features.autonomousActions) {
    return {
      allowed: false,
      reason: 'WhatsApp autonomous replies disabled in production',
      requiresApproval: true
    }
  }

  // Check dry run mode
  if (currentConfig.dryRunMode) {
    return {
      allowed: true,
      dryRun: true,
      reason: 'Dry run mode - message will be logged but not sent'
    }
  }

  // Check hourly limit
  resetHourlyCounterIfNeeded()
  if (controlState.hourlyReplies >= currentConfig.maxRepliesPerHour) {
    return {
      allowed: false,
      reason: `Hourly reply limit (${currentConfig.maxRepliesPerHour}) reached`
    }
  }

  // Get or create conversation state
  let conversation = controlState.conversations.get(conversationId)
  if (!conversation) {
    conversation = {
      conversationId,
      phoneNumber,
      replyCount: 0,
      lastReplyAt: new Date(0).toISOString(),
      escalated: false,
      blocked: false,
      processedMessageIds: new Set()
    }
    controlState.conversations.set(conversationId, conversation)
  }

  // Check if blocked
  if (conversation.blocked) {
    return {
      allowed: false,
      reason: 'Conversation is blocked'
    }
  }

  // Check conversation limit
  if (conversation.replyCount >= currentConfig.maxRepliesPerConversation) {
    return {
      allowed: false,
      reason: `Conversation reply limit (${currentConfig.maxRepliesPerConversation}) reached`,
      requiresApproval: true
    }
  }

  // Check cooldown
  const lastReply = new Date(conversation.lastReplyAt).getTime()
  const cooldownRemaining = currentConfig.cooldownMs - (Date.now() - lastReply)
  if (cooldownRemaining > 0) {
    return {
      allowed: false,
      reason: `Cooldown active, ${cooldownRemaining}ms remaining`
    }
  }

  // Check blocked patterns
  for (const pattern of currentConfig.blockedPatterns) {
    if (pattern.test(messageText)) {
      return {
        allowed: false,
        reason: `Message matches blocked pattern`
      }
    }
  }

  // Check escalation keywords
  if (hasEscalationKeyword(messageText) || containsEscalationKeyword(messageText)) {
    conversation.escalated = true
    return {
      allowed: false,
      reason: 'Escalation keyword detected - requires human',
      requiresApproval: true
    }
  }

  // Check approval requirement
  if (currentConfig.approvalRequired) {
    return {
      allowed: true,
      requiresApproval: true,
      reason: 'Approval required before sending'
    }
  }

  return { allowed: true }
}

/**
 * Check for escalation keywords
 */
function containsEscalationKeyword(text: string): boolean {
  const lower = text.toLowerCase()
  return currentConfig.escalationKeywords.some(kw => lower.includes(kw.toLowerCase()))
}

/**
 * Record a reply
 */
export function recordReply(
  conversationId: string,
  messageId: string
): void {
  const conversation = controlState.conversations.get(conversationId)
  if (conversation) {
    conversation.replyCount++
    conversation.lastReplyAt = new Date().toISOString()
    conversation.processedMessageIds.add(messageId)
  }
  controlState.hourlyReplies++
}

/**
 * Check if message already processed (anti-loop)
 */
export function isMessageProcessed(
  conversationId: string,
  messageId: string
): boolean {
  const conversation = controlState.conversations.get(conversationId)
  if (!conversation) return false
  return conversation.processedMessageIds.has(messageId)
}

/**
 * Mark message as processed
 */
export function markMessageProcessed(
  conversationId: string,
  messageId: string
): void {
  let conversation = controlState.conversations.get(conversationId)
  if (!conversation) {
    conversation = {
      conversationId,
      phoneNumber: '',
      replyCount: 0,
      lastReplyAt: new Date(0).toISOString(),
      escalated: false,
      blocked: false,
      processedMessageIds: new Set()
    }
    controlState.conversations.set(conversationId, conversation)
  }
  conversation.processedMessageIds.add(messageId)
}

/**
 * Block a conversation
 */
export function blockConversation(conversationId: string): void {
  const conversation = controlState.conversations.get(conversationId)
  if (conversation) {
    conversation.blocked = true
  }
}

/**
 * Reset hourly counter if needed
 */
function resetHourlyCounterIfNeeded(): void {
  const resetAt = new Date(controlState.hourlyResetAt).getTime()
  const hourAgo = Date.now() - 3600000

  if (resetAt < hourAgo) {
    controlState.hourlyReplies = 0
    controlState.hourlyResetAt = new Date().toISOString()
  }
}

/**
 * Save session state for persistence
 */
export function saveSessionState(): Record<string, unknown> {
  return {
    conversations: Array.from(controlState.conversations.entries()).map(([id, conv]) => ({
      id,
      ...conv,
      processedMessageIds: Array.from(conv.processedMessageIds)
    })),
    hourlyReplies: controlState.hourlyReplies,
    hourlyResetAt: controlState.hourlyResetAt
  }
}

/**
 * Restore session state
 */
export function restoreSessionState(state: Record<string, unknown>): void {
  if (state.conversations && Array.isArray(state.conversations)) {
    for (const conv of state.conversations) {
      controlState.conversations.set(conv.id, {
        conversationId: conv.conversationId,
        phoneNumber: conv.phoneNumber,
        replyCount: conv.replyCount,
        lastReplyAt: conv.lastReplyAt,
        escalated: conv.escalated,
        blocked: conv.blocked,
        processedMessageIds: new Set(conv.processedMessageIds || [])
      })
    }
  }

  if (typeof state.hourlyReplies === 'number') {
    controlState.hourlyReplies = state.hourlyReplies
  }
  if (typeof state.hourlyResetAt === 'string') {
    controlState.hourlyResetAt = state.hourlyResetAt
  }
}

/**
 * Record reconnect attempt
 */
export function recordReconnect(success: boolean): void {
  if (success) {
    controlState.reconnectState.attempts = 0
    controlState.reconnectState.backoffMs = 1000
  } else {
    controlState.reconnectState.attempts++
    controlState.reconnectState.backoffMs = Math.min(
      controlState.reconnectState.backoffMs * 2,
      60000
    )
  }
  controlState.reconnectState.lastAttempt = new Date().toISOString()
}

/**
 * Get reconnect backoff
 */
export function getReconnectBackoff(): number {
  return controlState.reconnectState.backoffMs
}

/**
 * Get control state summary
 */
export function getWhatsAppControlState(): {
  conversationCount: number
  hourlyReplies: number
  escalatedCount: number
  blockedCount: number
  reconnectAttempts: number
  config: WhatsAppControlConfig
} {
  let escalatedCount = 0
  let blockedCount = 0

  for (const conv of controlState.conversations.values()) {
    if (conv.escalated) escalatedCount++
    if (conv.blocked) blockedCount++
  }

  return {
    conversationCount: controlState.conversations.size,
    hourlyReplies: controlState.hourlyReplies,
    escalatedCount,
    blockedCount,
    reconnectAttempts: controlState.reconnectState.attempts,
    config: currentConfig
  }
}
