/**
 * Email Worker
 * P5: Durable Operational Workers & Real Connectors
 *
 * Worker for email channel (IMAP/SMTP).
 * Provider justification: OpenClaw has no IMAP/SMTP capability.
 */

import { BaseWorker } from './base-worker'
import type { WorkerConfig, WorkerCredentials, WorkerFactory } from '../types'
import type { ChannelType } from '../../channels-runtime/types'

/**
 * Email-specific session data
 */
interface EmailSessionData {
  imapHost?: string
  smtpHost?: string
  mailboxes?: string[]
  lastUid?: number
}

/**
 * Email Worker Implementation
 */
export class EmailWorker extends BaseWorker {
  private sessionData: EmailSessionData = {}
  private pollInterval: ReturnType<typeof setInterval> | null = null

  get channelType(): ChannelType {
    return 'email'
  }

  async connect(): Promise<void> {
    console.log('[EmailWorker] Connecting...')

    // Validate credentials
    if (this.credentials.type !== 'basic' && this.credentials.type !== 'oauth') {
      throw new Error('Email requires basic or oauth credentials')
    }

    // Simulate IMAP connection
    // In production: use nodemailer/imapflow
    await this.simulateConnection()

    this.setConnected(true)
    this.setAuthenticated(true)

    // Start polling for new emails
    this.startPolling()

    console.log('[EmailWorker] Connected successfully')
  }

  async disconnect(): Promise<void> {
    console.log('[EmailWorker] Disconnecting...')

    // Stop polling
    this.stopPolling()

    // Close connections
    this.setConnected(false)
    this.setAuthenticated(false)

    console.log('[EmailWorker] Disconnected')
  }

  async performHeartbeat(): Promise<boolean> {
    // Check IMAP connection is alive
    // In production: send NOOP command
    return this._connected
  }

  /**
   * Start polling for new emails
   */
  private startPolling(): void {
    if (this.pollInterval) return

    this.pollInterval = setInterval(async () => {
      try {
        await this.checkNewEmails()
      } catch (error) {
        console.error('[EmailWorker] Poll error:', error)
        this.incrementError()
      }
    }, 30000) // Poll every 30 seconds
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }

  /**
   * Check for new emails
   */
  private async checkNewEmails(): Promise<void> {
    // In production: IMAP IDLE or poll INBOX
    const newCount = 0 // Simulated

    if (newCount > 0) {
      this.setPendingActions(newCount)
      console.log(`[EmailWorker] ${newCount} new emails`)
    }

    this.setLastSync()
  }

  /**
   * Simulate connection for development
   */
  private async simulateConnection(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100))

    this.sessionData = {
      imapHost: 'imap.example.com',
      smtpHost: 'smtp.example.com',
      mailboxes: ['INBOX', 'Sent', 'Drafts'],
      lastUid: 0
    }
  }

  protected getSessionData(): EmailSessionData {
    return { ...this.sessionData }
  }

  protected async restoreSessionData(data: unknown): Promise<void> {
    const emailData = data as EmailSessionData
    if (emailData.lastUid) {
      this.sessionData.lastUid = emailData.lastUid
    }
  }
}

/**
 * Email worker factory
 */
export const emailWorkerFactory: WorkerFactory = (
  config: WorkerConfig,
  credentials: WorkerCredentials
) => {
  return new EmailWorker(config, credentials)
}
