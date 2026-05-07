/**
 * Email Sandbox Configuration
 * P5.1: Controlled Real Testing & Connector Hardening
 *
 * Email sandbox for safe testing with real protocols.
 */

import { getEnvironmentConfig, getCurrentEnvironment } from './environments'

/**
 * Email sandbox configuration
 */
export interface EmailSandboxConfig {
  imapHost: string
  imapPort: number
  smtpHost: string
  smtpPort: number
  useTLS: boolean
  testAccount: string
  testPassword: string
  allowedDomains: string[]
  blockedDomains: string[]
  maxTestEmails: number
  retentionHours: number
}

/**
 * Email test thread
 */
export interface EmailTestThread {
  id: string
  subject: string
  messageCount: number
  firstMessageAt: string
  lastMessageAt: string
  participants: string[]
}

/**
 * Email attachment test
 */
export interface AttachmentTest {
  filename: string
  mimeType: string
  size: number
  checksum: string
  testResult?: 'pass' | 'fail'
  errorMessage?: string
}

/**
 * Email sandbox state
 */
interface EmailSandboxState {
  connected: boolean
  lastHeartbeat?: string
  processedCount: number
  dedupeSet: Set<string>
  testThreads: Map<string, EmailTestThread>
  lastError?: string
  reconnectAttempts: number
}

let sandboxState: EmailSandboxState = {
  connected: false,
  processedCount: 0,
  dedupeSet: new Set(),
  testThreads: new Map(),
  reconnectAttempts: 0
}

/**
 * Default sandbox config (e.g., Ethereal, Mailtrap, etc.)
 */
const defaultSandboxConfig: EmailSandboxConfig = {
  imapHost: 'imap.ethereal.email',
  imapPort: 993,
  smtpHost: 'smtp.ethereal.email',
  smtpPort: 587,
  useTLS: true,
  testAccount: '',
  testPassword: '',
  allowedDomains: ['ethereal.email', 'mailtrap.io', 'mailinator.com'],
  blockedDomains: [], // Will be populated from env config
  maxTestEmails: 100,
  retentionHours: 24
}

let currentConfig: EmailSandboxConfig = { ...defaultSandboxConfig }

/**
 * Initialize email sandbox
 */
export function initializeEmailSandbox(
  config?: Partial<EmailSandboxConfig>
): void {
  currentConfig = { ...defaultSandboxConfig, ...config }

  // Reset state
  sandboxState = {
    connected: false,
    processedCount: 0,
    dedupeSet: new Set(),
    testThreads: new Map(),
    reconnectAttempts: 0
  }

  console.log('[EmailSandbox] Initialized')
}

/**
 * Check if email is allowed in sandbox
 */
export function isEmailAllowed(email: string): {
  allowed: boolean
  reason?: string
} {
  const domain = email.split('@')[1]?.toLowerCase()

  if (!domain) {
    return { allowed: false, reason: 'Invalid email format' }
  }

  // Check blocked domains
  if (currentConfig.blockedDomains.includes(domain)) {
    return { allowed: false, reason: `Domain ${domain} is blocked` }
  }

  // In sandbox mode, only allow specific domains
  const env = getCurrentEnvironment()
  if (env === 'sandbox') {
    if (!currentConfig.allowedDomains.includes(domain)) {
      return {
        allowed: false,
        reason: `Domain ${domain} not in sandbox allowed list`
      }
    }
  }

  return { allowed: true }
}

/**
 * Check for duplicate message (dedupe)
 */
export function isDuplicateMessage(messageId: string): boolean {
  if (sandboxState.dedupeSet.has(messageId)) {
    return true
  }
  sandboxState.dedupeSet.add(messageId)
  return false
}

/**
 * Clear dedupe set (for testing)
 */
export function clearDedupeSet(): void {
  sandboxState.dedupeSet.clear()
}

/**
 * Track test thread
 */
export function trackTestThread(
  subject: string,
  messageId: string,
  from: string,
  to: string[]
): EmailTestThread {
  // Find or create thread
  let thread = sandboxState.testThreads.get(subject)
  const now = new Date().toISOString()

  if (!thread) {
    thread = {
      id: `thread_${Date.now()}`,
      subject,
      messageCount: 0,
      firstMessageAt: now,
      lastMessageAt: now,
      participants: []
    }
    sandboxState.testThreads.set(subject, thread)
  }

  // Update thread
  thread.messageCount++
  thread.lastMessageAt = now

  // Add participants
  const allParticipants = [from, ...to]
  for (const p of allParticipants) {
    if (!thread.participants.includes(p)) {
      thread.participants.push(p)
    }
  }

  return thread
}

/**
 * Get all test threads
 */
export function getTestThreads(): EmailTestThread[] {
  return Array.from(sandboxState.testThreads.values())
}

/**
 * Validate attachment for testing
 */
export function validateAttachment(
  filename: string,
  mimeType: string,
  size: number
): AttachmentTest {
  const test: AttachmentTest = {
    filename,
    mimeType,
    size,
    checksum: `checksum_${Date.now()}`
  }

  // Size limit for sandbox
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (size > maxSize) {
    test.testResult = 'fail'
    test.errorMessage = `Attachment size ${size} exceeds sandbox limit ${maxSize}`
    return test
  }

  // Blocked mime types in sandbox
  const blockedMimes = ['application/x-executable', 'application/x-msdownload']
  if (blockedMimes.includes(mimeType)) {
    test.testResult = 'fail'
    test.errorMessage = `MIME type ${mimeType} blocked in sandbox`
    return test
  }

  test.testResult = 'pass'
  return test
}

/**
 * Record sandbox connection
 */
export function recordConnection(success: boolean, error?: string): void {
  sandboxState.connected = success
  sandboxState.lastHeartbeat = new Date().toISOString()

  if (!success) {
    sandboxState.lastError = error
    sandboxState.reconnectAttempts++
  } else {
    sandboxState.reconnectAttempts = 0
  }
}

/**
 * Get sandbox state
 */
export function getEmailSandboxState(): {
  connected: boolean
  lastHeartbeat?: string
  processedCount: number
  dedupeSetSize: number
  testThreadCount: number
  reconnectAttempts: number
  lastError?: string
} {
  return {
    connected: sandboxState.connected,
    lastHeartbeat: sandboxState.lastHeartbeat,
    processedCount: sandboxState.processedCount,
    dedupeSetSize: sandboxState.dedupeSet.size,
    testThreadCount: sandboxState.testThreads.size,
    reconnectAttempts: sandboxState.reconnectAttempts,
    lastError: sandboxState.lastError
  }
}

/**
 * Increment processed count
 */
export function incrementProcessed(): void {
  sandboxState.processedCount++
}

/**
 * Get sandbox config
 */
export function getEmailSandboxConfig(): EmailSandboxConfig {
  return { ...currentConfig }
}

/**
 * Check if workflow should trigger
 */
export function shouldTriggerWorkflow(
  subject: string,
  from: string,
  body: string
): { trigger: boolean; reason: string } {
  // Check for test workflow triggers
  if (subject.includes('[TEST-WORKFLOW]')) {
    return { trigger: true, reason: 'Test workflow trigger in subject' }
  }

  if (body.includes('TRIGGER_WORKFLOW')) {
    return { trigger: true, reason: 'Workflow trigger keyword in body' }
  }

  return { trigger: false, reason: 'No trigger keywords found' }
}
