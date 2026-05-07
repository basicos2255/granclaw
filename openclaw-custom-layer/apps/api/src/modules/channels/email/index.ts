/**
 * Email Channel
 * P3: Real Integrations & Operational Channels
 *
 * Email integration via IMAP/SMTP.
 */

import type {
  EmailMessage,
  EmailAttachment,
  ChannelActionRequest,
  ChannelActionResult
} from '../../channels-runtime/types'
import { emitChannelEvent, getRecentEvents } from '../../channels-runtime/event-adapter'
import { enqueueChannelAction } from '../../channels-runtime/runtime-integration'
import { getChannel, updateChannelMetrics } from '../../channels-runtime/channel-manager'

/**
 * Email channel configuration
 */
export interface EmailChannelConfig {
  imapHost: string
  imapPort: number
  smtpHost: string
  smtpPort: number
  username: string
  // Password comes from credentials vault, not stored here
  pollIntervalMs: number
  folder: string
  markReadOnFetch: boolean
}

/**
 * Email thread summary
 */
export interface EmailThreadSummary {
  threadId: string
  subject: string
  participants: string[]
  messageCount: number
  lastMessageAt: string
  isUrgent: boolean
  summary?: string
}

/**
 * Processed emails tracking (in-memory for demo)
 */
const processedEmails: Map<string, Set<string>> = new Map()

/**
 * Get or create processed set for channel
 */
function getProcessedSet(channelId: string): Set<string> {
  let set = processedEmails.get(channelId)
  if (!set) {
    set = new Set()
    processedEmails.set(channelId, set)
  }
  return set
}

/**
 * Check if email was already processed
 */
export function isEmailProcessed(channelId: string, emailId: string): boolean {
  return getProcessedSet(channelId).has(emailId)
}

/**
 * Mark email as processed
 */
export function markEmailProcessed(channelId: string, emailId: string): void {
  getProcessedSet(channelId).add(emailId)
}

/**
 * Send an email
 */
export async function sendEmail(
  channelId: string,
  params: {
    to: string[]
    cc?: string[]
    bcc?: string[]
    subject: string
    body: string
    bodyHtml?: string
    attachments?: Array<{ filename: string; content: string; contentType: string }>
    replyTo?: string
    inReplyTo?: string
  },
  options: {
    userId?: string
    priority?: 'low' | 'normal' | 'high' | 'urgent'
  } = {}
): Promise<{ queued: boolean; requestId?: string; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { queued: false, error: 'Channel not found' }
  }

  if (channel.config.type !== 'email') {
    return { queued: false, error: 'Not an email channel' }
  }

  // Enqueue action
  return enqueueChannelAction(channel.config, 'send', params, options)
}

/**
 * Reply to an email
 */
export async function replyToEmail(
  channelId: string,
  originalEmailId: string,
  params: {
    body: string
    bodyHtml?: string
    attachments?: Array<{ filename: string; content: string; contentType: string }>
  },
  options: {
    userId?: string
    replyAll?: boolean
  } = {}
): Promise<{ queued: boolean; requestId?: string; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { queued: false, error: 'Channel not found' }
  }

  return enqueueChannelAction(
    channel.config,
    options.replyAll ? 'replyAll' : 'reply',
    { originalEmailId, ...params },
    { userId: options.userId }
  )
}

/**
 * Forward an email
 */
export async function forwardEmail(
  channelId: string,
  originalEmailId: string,
  to: string[],
  additionalMessage?: string
): Promise<{ queued: boolean; requestId?: string; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { queued: false, error: 'Channel not found' }
  }

  return enqueueChannelAction(
    channel.config,
    'forward',
    { originalEmailId, to, additionalMessage },
    {}
  )
}

/**
 * Mark email as read
 */
export async function markEmailRead(
  channelId: string,
  emailId: string
): Promise<void> {
  const channel = getChannel(channelId)
  if (!channel) return

  // This is a low-risk action, execute directly
  markEmailProcessed(channelId, emailId)

  // Update metrics
  updateChannelMetrics(channelId, {
    messagesProcessed: (channel.metrics?.messagesProcessed || 0) + 1
  })
}

/**
 * Search emails
 */
export async function searchEmails(
  channelId: string,
  query: {
    from?: string
    to?: string
    subject?: string
    body?: string
    after?: string
    before?: string
    hasAttachment?: boolean
    isUnread?: boolean
  },
  limit = 50
): Promise<EmailMessage[]> {
  const channel = getChannel(channelId)
  if (!channel) return []

  // TODO: Implement actual IMAP search
  // For now return empty array
  console.log(`[EmailChannel] Searching emails in ${channelId}:`, query)
  return []
}

/**
 * Get email thread
 */
export async function getEmailThread(
  channelId: string,
  threadId: string
): Promise<EmailMessage[]> {
  const channel = getChannel(channelId)
  if (!channel) return []

  // TODO: Implement actual thread retrieval
  console.log(`[EmailChannel] Getting thread ${threadId} from ${channelId}`)
  return []
}

/**
 * Classify email (for workflow triggers)
 */
export function classifyEmail(email: EmailMessage): {
  type: 'invoice' | 'support' | 'urgent' | 'newsletter' | 'personal' | 'unknown'
  confidence: number
  keywords: string[]
} {
  const subject = email.subject.toLowerCase()
  const body = email.body.toLowerCase()
  const combined = `${subject} ${body}`

  // Simple keyword-based classification
  if (combined.includes('factura') || combined.includes('invoice') || combined.includes('pago')) {
    return { type: 'invoice', confidence: 0.8, keywords: ['factura', 'invoice', 'pago'] }
  }

  if (combined.includes('urgente') || combined.includes('urgent') || combined.includes('asap')) {
    return { type: 'urgent', confidence: 0.9, keywords: ['urgente', 'urgent'] }
  }

  if (combined.includes('soporte') || combined.includes('support') || combined.includes('ayuda') || combined.includes('help')) {
    return { type: 'support', confidence: 0.7, keywords: ['soporte', 'support', 'ayuda'] }
  }

  if (combined.includes('unsubscribe') || combined.includes('newsletter') || combined.includes('darse de baja')) {
    return { type: 'newsletter', confidence: 0.85, keywords: ['newsletter', 'unsubscribe'] }
  }

  return { type: 'unknown', confidence: 0.5, keywords: [] }
}

/**
 * Process incoming email (called by poller/webhook)
 */
export async function processIncomingEmail(
  channelId: string,
  email: EmailMessage,
  tenantId: string
): Promise<void> {
  // Skip if already processed
  if (isEmailProcessed(channelId, email.id)) {
    return
  }

  // Mark as processed
  markEmailProcessed(channelId, email.id)

  // Classify email
  const classification = classifyEmail(email)

  // Emit event
  await emitChannelEvent(
    channelId,
    'email',
    'email:new_email',
    {
      email,
      classification
    },
    {
      tenantId,
      metadata: {
        threadId: email.threadId,
        hasAttachments: (email.attachments?.length || 0) > 0,
        classification: classification.type
      }
    }
  )

  // Update metrics
  const channel = getChannel(channelId)
  if (channel) {
    updateChannelMetrics(channelId, {
      messagesProcessed: (channel.metrics?.messagesProcessed || 0) + 1
    })
  }

  console.log(`[EmailChannel] Processed incoming email: ${email.id} (${classification.type})`)
}

/**
 * Extract attachments from email
 */
export async function extractAttachments(
  channelId: string,
  emailId: string
): Promise<EmailAttachment[]> {
  // TODO: Implement actual attachment extraction
  console.log(`[EmailChannel] Extracting attachments from ${emailId}`)
  return []
}

/**
 * Get thread summaries for inbox view
 */
export async function getInboxSummary(
  channelId: string,
  limit = 20
): Promise<EmailThreadSummary[]> {
  // TODO: Implement actual inbox summary
  // For now return recent events as summary
  const events = getRecentEvents(channelId, limit)

  return events
    .filter(e => e.type === 'email:new_email')
    .map(e => {
      const payload = e.payload as { email: EmailMessage; classification: { type: string } }
      return {
        threadId: payload.email.threadId || payload.email.id,
        subject: payload.email.subject,
        participants: [payload.email.from, ...payload.email.to],
        messageCount: 1,
        lastMessageAt: payload.email.receivedAt,
        isUrgent: payload.classification?.type === 'urgent',
        summary: payload.email.body.substring(0, 100)
      }
    })
}
