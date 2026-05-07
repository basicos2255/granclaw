/**
 * WhatsApp Channel
 * P3: Real Integrations & Operational Channels
 *
 * WhatsApp Business API integration.
 * STABILITY: beta (WhatsApp Business API)
 *           experimental (Web automation mode)
 */

import type {
  WhatsAppMessage,
  WhatsAppChat,
  ChannelStability
} from '../../channels-runtime/types'
import { emitChannelEvent } from '../../channels-runtime/event-adapter'
import { enqueueChannelAction, isRecursiveReply, checkRateLimits } from '../../channels-runtime/runtime-integration'
import { getChannel, updateChannelMetrics } from '../../channels-runtime/channel-manager'

/**
 * WhatsApp channel configuration
 */
export interface WhatsAppChannelConfig {
  mode: 'api' | 'web' // api = Business API (stable), web = automation (experimental)
  phoneNumberId?: string // For Business API
  businessAccountId?: string // For Business API
  webhookVerifyToken?: string
  autoReplyMode: 'off' | 'safe' | 'approval' | 'autonomous'
  maxAutoRepliesPerHour: number
  blockedKeywords?: string[] // Block auto-replies containing these
}

/**
 * Get stability level for current mode
 */
export function getWhatsAppStability(mode: 'api' | 'web'): ChannelStability {
  return mode === 'api' ? 'beta' : 'experimental'
}

/**
 * Auto-reply tracking
 */
interface AutoReplyTracker {
  repliesSent: number
  lastReply: string
  hourReset: number
}

const autoReplyTrackers: Map<string, AutoReplyTracker> = new Map()

/**
 * Check if auto-reply is allowed
 */
function canAutoReply(channelId: string, config: Partial<WhatsAppChannelConfig>): boolean {
  const now = Date.now()
  let tracker = autoReplyTrackers.get(channelId)

  if (!tracker || now > tracker.hourReset) {
    tracker = {
      repliesSent: 0,
      lastReply: '',
      hourReset: now + 3600000
    }
    autoReplyTrackers.set(channelId, tracker)
  }

  const maxReplies = config.maxAutoRepliesPerHour ?? 20
  return tracker.repliesSent < maxReplies
}

/**
 * Send a text message
 */
export async function sendMessage(
  channelId: string,
  to: string,
  body: string,
  options: {
    userId?: string
    replyToMessageId?: string
  } = {}
): Promise<{ queued: boolean; requestId?: string; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { queued: false, error: 'Channel not found' }
  }

  if (channel.config.type !== 'whatsapp') {
    return { queued: false, error: 'Not a WhatsApp channel' }
  }

  // Check for recursive replies (spam prevention)
  if (isRecursiveReply(channelId, body)) {
    return { queued: false, error: 'Recursive reply detected - blocked for safety' }
  }

  // Check rate limits
  const rateCheck = checkRateLimits(channelId)
  if (!rateCheck.allowed) {
    return { queued: false, error: rateCheck.reason }
  }

  return enqueueChannelAction(
    channel.config,
    'sendMessage',
    { to, body, replyToMessageId: options.replyToMessageId },
    { userId: options.userId, priority: 'normal' }
  )
}

/**
 * Send a template message (pre-approved by WhatsApp)
 */
export async function sendTemplate(
  channelId: string,
  to: string,
  templateName: string,
  components?: Array<{
    type: 'header' | 'body' | 'button'
    parameters: Array<{ type: string; text?: string; image?: { link: string } }>
  }>,
  options: {
    userId?: string
    language?: string
  } = {}
): Promise<{ queued: boolean; requestId?: string; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { queued: false, error: 'Channel not found' }
  }

  // Templates are safer - lower risk
  return enqueueChannelAction(
    channel.config,
    'sendTemplate',
    { to, templateName, components, language: options.language || 'es' },
    { userId: options.userId }
  )
}

/**
 * Send media (image, document, etc.)
 */
export async function sendMedia(
  channelId: string,
  to: string,
  media: {
    type: 'image' | 'document' | 'audio' | 'video'
    url: string
    caption?: string
    filename?: string
  },
  options: {
    userId?: string
  } = {}
): Promise<{ queued: boolean; requestId?: string; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { queued: false, error: 'Channel not found' }
  }

  return enqueueChannelAction(
    channel.config,
    'sendMedia',
    { to, ...media },
    { userId: options.userId }
  )
}

/**
 * Mark message as read
 */
export async function markAsRead(
  channelId: string,
  messageId: string
): Promise<void> {
  const channel = getChannel(channelId)
  if (!channel) return

  // Low risk action, execute directly
  // TODO: Implement actual API call
  console.log(`[WhatsAppChannel] Marking message as read: ${messageId}`)
}

/**
 * Get chat list
 */
export async function getChats(
  channelId: string,
  limit = 50
): Promise<WhatsAppChat[]> {
  const channel = getChannel(channelId)
  if (!channel) return []

  // TODO: Implement actual chat retrieval
  console.log(`[WhatsAppChannel] Getting chats for ${channelId}`)
  return []
}

/**
 * Get messages from a chat
 */
export async function getChatMessages(
  channelId: string,
  chatId: string,
  limit = 50
): Promise<WhatsAppMessage[]> {
  const channel = getChannel(channelId)
  if (!channel) return []

  // TODO: Implement actual message retrieval
  console.log(`[WhatsAppChannel] Getting messages for chat ${chatId}`)
  return []
}

/**
 * Process incoming message (from webhook)
 */
export async function processIncomingMessage(
  channelId: string,
  message: WhatsAppMessage,
  tenantId: string
): Promise<void> {
  const channel = getChannel(channelId)
  if (!channel) return

  const config = (channel.config.settings || {}) as Partial<WhatsAppChannelConfig> & { autoReplyMode?: string; maxAutoRepliesPerHour?: number }

  // Emit received event
  await emitChannelEvent(
    channelId,
    'whatsapp',
    'whatsapp:message_received',
    message,
    {
      tenantId,
      metadata: {
        chatId: message.chatId,
        from: message.from,
        type: message.type,
        hasMedia: !!message.mediaUrl
      }
    }
  )

  // Update metrics
  updateChannelMetrics(channelId, {
    messagesProcessed: (channel.metrics?.messagesProcessed || 0) + 1
  })

  // Handle auto-reply based on mode
  if (config.autoReplyMode !== 'off' && !message.isFromMe) {
    await handleAutoReply(channelId, message, config, tenantId)
  }

  console.log(`[WhatsAppChannel] Processed incoming message from ${message.from}`)
}

/**
 * Handle auto-reply logic
 */
async function handleAutoReply(
  channelId: string,
  message: WhatsAppMessage,
  config: Partial<WhatsAppChannelConfig>,
  tenantId: string
): Promise<void> {
  // Check if auto-reply is allowed
  if (!canAutoReply(channelId, config)) {
    console.log('[WhatsAppChannel] Auto-reply limit reached for this hour')
    return
  }

  // Check for blocked keywords
  if (config.blockedKeywords?.some(kw => message.body.toLowerCase().includes(kw.toLowerCase()))) {
    console.log('[WhatsAppChannel] Message contains blocked keyword, skipping auto-reply')
    return
  }

  switch (config.autoReplyMode) {
    case 'safe':
      // Only reply with safe, templated responses
      // Would trigger workflow for analysis
      console.log('[WhatsAppChannel] Safe mode: queueing for workflow analysis')
      break

    case 'approval':
      // Generate reply but require human approval
      console.log('[WhatsAppChannel] Approval mode: generating reply for approval')
      // Emit approval required event
      await emitChannelEvent(
        channelId,
        'whatsapp',
        'channel:message_received',
        {
          message,
          suggestedReply: generateSafeReply(message),
          requiresApproval: true
        },
        { tenantId }
      )
      break

    case 'autonomous':
      // Full auto-reply (use with caution)
      console.log('[WhatsAppChannel] Autonomous mode: auto-replying')
      // Track auto-reply
      const tracker = autoReplyTrackers.get(channelId)
      if (tracker) {
        tracker.repliesSent++
        tracker.lastReply = new Date().toISOString()
      }
      // Would trigger actual reply here
      break
  }
}

/**
 * Generate a safe auto-reply (very conservative)
 */
function generateSafeReply(message: WhatsAppMessage): string {
  // Very simple, safe replies only
  const lowerBody = message.body.toLowerCase()

  if (lowerBody.includes('hola') || lowerBody.includes('hi') || lowerBody.includes('buenos')) {
    return 'Hola! Gracias por tu mensaje. Te responderemos pronto.'
  }

  if (lowerBody.includes('precio') || lowerBody.includes('costo') || lowerBody.includes('cuanto')) {
    return 'Gracias por tu interes. Un representante te contactara con informacion de precios.'
  }

  if (lowerBody.includes('urgente') || lowerBody.includes('emergencia')) {
    return 'Hemos recibido tu mensaje urgente. Te contactaremos lo antes posible.'
  }

  return 'Gracias por tu mensaje. Te responderemos pronto.'
}

/**
 * Handle message sent confirmation
 */
export async function handleMessageSent(
  channelId: string,
  messageId: string,
  to: string,
  tenantId: string
): Promise<void> {
  await emitChannelEvent(
    channelId,
    'whatsapp',
    'whatsapp:message_sent',
    { messageId, to },
    { tenantId }
  )

  console.log(`[WhatsAppChannel] Message sent: ${messageId} to ${to}`)
}

/**
 * Handle status update (delivered, read, etc.)
 */
export async function handleStatusUpdate(
  channelId: string,
  messageId: string,
  status: 'sent' | 'delivered' | 'read' | 'failed',
  tenantId: string
): Promise<void> {
  await emitChannelEvent(
    channelId,
    'whatsapp',
    'whatsapp:status_update',
    { messageId, status },
    { tenantId }
  )

  if (status === 'failed') {
    const channel = getChannel(channelId)
    if (channel) {
      updateChannelMetrics(channelId, {
        errorsLastHour: (channel.metrics?.errorsLastHour || 0) + 1
      })
    }
  }

  console.log(`[WhatsAppChannel] Status update: ${messageId} -> ${status}`)
}

/**
 * Get chat summary for UI
 */
export function getChatSummary(
  channelId: string
): {
  totalChats: number
  unreadChats: number
  pendingReplies: number
  autoRepliesSent: number
} {
  const tracker = autoReplyTrackers.get(channelId)

  // TODO: Implement actual summary from data
  return {
    totalChats: 0,
    unreadChats: 0,
    pendingReplies: 0,
    autoRepliesSent: tracker?.repliesSent || 0
  }
}

/**
 * Validate webhook payload
 */
export function validateWebhook(
  channelId: string,
  token: string
): boolean {
  const channel = getChannel(channelId)
  if (!channel) return false

  const config = (channel.config.settings || {}) as Partial<WhatsAppChannelConfig> & { autoReplyMode?: string; maxAutoRepliesPerHour?: number }
  return config.webhookVerifyToken === token
}
