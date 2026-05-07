/**
 * Channel Runtime Types
 * P3: Real Integrations & Operational Channels
 *
 * Common types for all channel integrations.
 */

/**
 * Supported channel types
 */
export type ChannelType =
  | 'email'
  | 'ftp'
  | 'sftp'
  | 'browser'
  | 'whatsapp'
  | 'calendar'
  | 'api'
  | 'filesystem'
  | 'webhook'

/**
 * Channel connection status
 */
export type ChannelStatus =
  | 'connected'
  | 'disconnected'
  | 'connecting'
  | 'error'
  | 'auth_expired'
  | 'setup_required'
  | 'rate_limited'

/**
 * Channel stability level
 */
export type ChannelStability = 'stable' | 'beta' | 'experimental'

/**
 * Approval mode for channel actions
 */
export type ApprovalMode = 'auto' | 'approval_required' | 'always_ask' | 'always_allow'

/**
 * Channel configuration base
 */
export interface ChannelConfig {
  id: string
  type: ChannelType
  name: string
  tenantId: string
  enabled: boolean
  credentialId?: string
  scopes: string[]
  settings: Record<string, unknown>
  rateLimit?: {
    maxPerMinute: number
    maxPerHour: number
    maxPerDay: number
  }
  approvalMode: 'auto' | 'approval_required' | 'always_ask' | 'always_allow'
  createdAt: string
  updatedAt: string
}

/**
 * Channel instance with runtime state
 */
export interface ChannelInstance {
  config: ChannelConfig
  status: ChannelStatus
  stability: ChannelStability
  lastActivity?: string
  lastError?: string
  metrics: {
    messagesProcessed: number
    messagesPerHour: number
    errorsLastHour: number
    avgResponseMs: number
  }
  health: {
    isHealthy: boolean
    lastCheck: string
    issues: string[]
  }
}

/**
 * Channel event types
 */
export type ChannelEventType =
  // Connection events
  | 'channel:connected'
  | 'channel:disconnected'
  | 'channel:auth_expired'
  | 'channel:error'
  | 'channel:rate_limited'
  // Message events
  | 'channel:message_received'
  | 'channel:message_sent'
  | 'channel:message_failed'
  // Email specific
  | 'email:new_email'
  | 'email:email_sent'
  | 'email:attachment_received'
  // FTP specific
  | 'ftp:upload_complete'
  | 'ftp:download_complete'
  | 'ftp:sync_complete'
  | 'ftp:deployment_failed'
  // Browser specific
  | 'browser:page_loaded'
  | 'browser:action_complete'
  | 'browser:screenshot_taken'
  | 'browser:error'
  // WhatsApp specific
  | 'whatsapp:message_received'
  | 'whatsapp:message_sent'
  | 'whatsapp:status_update'
  // Calendar specific
  | 'calendar:event_created'
  | 'calendar:event_updated'
  | 'calendar:reminder_triggered'

/**
 * Channel event payload
 */
export interface ChannelEvent<T = unknown> {
  id: string
  type: ChannelEventType
  channelId: string
  channelType: ChannelType
  tenantId: string
  timestamp: string
  payload: T
  metadata?: Record<string, unknown>
  correlationId?: string
  workflowId?: string
}

/**
 * Channel action request
 */
export interface ChannelActionRequest<T = unknown> {
  id: string
  channelId: string
  action: string
  params: T
  tenantId: string
  userId?: string
  requiresApproval: boolean
  priority: 'low' | 'normal' | 'high' | 'urgent'
  timeout?: number
  retryPolicy?: {
    maxRetries: number
    backoffMs: number
  }
}

/**
 * Channel action result
 */
export interface ChannelActionResult<T = unknown> {
  requestId: string
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    retryable: boolean
  }
  executionMs: number
  approvalId?: string
}

/**
 * Channel provider interface
 */
export interface ChannelProvider {
  type: ChannelType
  stability: ChannelStability
  name: string
  description: string
  requiredScopes: string[]
  optionalScopes: string[]
  supportedActions: string[]
  configSchema: Record<string, unknown>
}

/**
 * Channel credentials reference (no secrets exposed)
 */
export interface ChannelCredentialRef {
  id: string
  name: string
  type: string
  scopes: string[]
  status: 'active' | 'expired' | 'revoked'
  expiresAt?: string
  lastUsed?: string
}

/**
 * Email-specific types
 */
export interface EmailMessage {
  id: string
  threadId?: string
  from: string
  to: string[]
  cc?: string[]
  subject: string
  body: string
  bodyHtml?: string
  attachments?: EmailAttachment[]
  receivedAt: string
  isRead: boolean
  labels?: string[]
  priority?: 'low' | 'normal' | 'high'
}

export interface EmailAttachment {
  id: string
  filename: string
  mimeType: string
  size: number
  url?: string
}

/**
 * FTP-specific types
 */
export interface FtpFile {
  path: string
  name: string
  size: number
  isDirectory: boolean
  modifiedAt: string
  permissions?: string
}

export interface FtpTransferResult {
  path: string
  success: boolean
  bytesTransferred: number
  durationMs: number
  error?: string
}

/**
 * Browser-specific types
 */
export interface BrowserAction {
  type: 'navigate' | 'click' | 'type' | 'screenshot' | 'extract' | 'wait' | 'scroll'
  selector?: string
  value?: string
  timeout?: number
}

export interface BrowserPageState {
  url: string
  title: string
  screenshot?: string
  extractedData?: Record<string, unknown>
}

/**
 * WhatsApp-specific types
 */
export interface WhatsAppMessage {
  id: string
  chatId: string
  from: string
  to?: string
  body: string
  timestamp: string
  isFromMe: boolean
  type: 'text' | 'image' | 'document' | 'audio' | 'video'
  mediaUrl?: string
  quotedMessageId?: string
}

export interface WhatsAppChat {
  id: string
  name: string
  isGroup: boolean
  lastMessage?: WhatsAppMessage
  unreadCount: number
  participants?: string[]
}

/**
 * Calendar-specific types
 */
export interface CalendarEvent {
  id: string
  calendarId: string
  title: string
  description?: string
  start: string
  end: string
  location?: string
  attendees?: string[]
  reminders?: CalendarReminder[]
  isAllDay: boolean
  recurrence?: string
}

export interface CalendarReminder {
  method: 'email' | 'popup' | 'sms'
  minutesBefore: number
}

/**
 * Channel workflow trigger
 */
export interface ChannelWorkflowTrigger {
  id: string
  channelId: string
  channelType: ChannelType
  eventType: ChannelEventType
  workflowId: string
  conditions?: Record<string, unknown>
  enabled: boolean
  tenantId: string
}

/**
 * Safety limits
 */
export interface ChannelSafetyLimits {
  maxMessagesPerMinute: number
  maxMessagesPerHour: number
  maxMessagesPerDay: number
  requireApprovalAbove: number
  blockRecursiveReplies: boolean
  humanEscalationThreshold: number
}
