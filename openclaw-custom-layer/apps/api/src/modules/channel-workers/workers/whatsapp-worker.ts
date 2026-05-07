/**
 * WhatsApp Worker
 * P5: Durable Operational Workers & Real Connectors
 *
 * Worker for WhatsApp channel.
 * Provider justification: OpenClaw has no WhatsApp API capability.
 */

import { BaseWorker } from './base-worker'
import type { WorkerConfig, WorkerCredentials, WorkerFactory } from '../types'
import type { ChannelType } from '../../channels-runtime/types'

/**
 * WhatsApp-specific session data
 */
interface WhatsAppSessionData {
  phoneNumber?: string
  businessId?: string
  webhookVerified?: boolean
  lastMessageId?: string
}

/**
 * WhatsApp Worker Implementation
 */
export class WhatsAppWorker extends BaseWorker {
  private sessionData: WhatsAppSessionData = {}
  private webhookActive: boolean = false

  get channelType(): ChannelType {
    return 'whatsapp'
  }

  async connect(): Promise<void> {
    console.log('[WhatsAppWorker] Connecting...')

    // Validate credentials
    if (this.credentials.type !== 'apikey' && this.credentials.type !== 'oauth') {
      throw new Error('WhatsApp requires apikey or oauth credentials')
    }

    // Verify WhatsApp Business API access
    await this.verifyApiAccess()

    // Register webhook
    await this.registerWebhook()

    this.setConnected(true)
    this.setAuthenticated(true)

    console.log('[WhatsAppWorker] Connected successfully')
  }

  async disconnect(): Promise<void> {
    console.log('[WhatsAppWorker] Disconnecting...')

    // Unregister webhook
    this.webhookActive = false

    this.setConnected(false)
    this.setAuthenticated(false)

    console.log('[WhatsAppWorker] Disconnected')
  }

  async performHeartbeat(): Promise<boolean> {
    // Check API health
    // In production: call WhatsApp health endpoint
    return this._connected && this.webhookActive
  }

  /**
   * Verify API access
   */
  private async verifyApiAccess(): Promise<void> {
    // In production: call WhatsApp Business API
    await new Promise(resolve => setTimeout(resolve, 100))

    this.sessionData = {
      phoneNumber: '+1234567890',
      businessId: 'business_123',
      webhookVerified: false
    }
  }

  /**
   * Register webhook for incoming messages
   */
  private async registerWebhook(): Promise<void> {
    // In production: register webhook with WhatsApp
    await new Promise(resolve => setTimeout(resolve, 50))

    this.webhookActive = true
    this.sessionData.webhookVerified = true
  }

  /**
   * Send WhatsApp message
   */
  async sendMessage(to: string, message: string): Promise<string> {
    if (!this._connected) {
      throw new Error('Not connected')
    }

    // In production: call WhatsApp Send Message API
    console.log(`[WhatsAppWorker] Sending to ${to}: ${message.substring(0, 50)}...`)

    const messageId = `msg_${Date.now()}`
    this.sessionData.lastMessageId = messageId
    this.incrementProcessed()

    return messageId
  }

  protected getSessionData(): WhatsAppSessionData {
    return { ...this.sessionData }
  }

  protected async restoreSessionData(data: unknown): Promise<void> {
    const waData = data as WhatsAppSessionData
    if (waData.lastMessageId) {
      this.sessionData.lastMessageId = waData.lastMessageId
    }
  }
}

/**
 * WhatsApp worker factory
 */
export const whatsappWorkerFactory: WorkerFactory = (
  config: WorkerConfig,
  credentials: WorkerCredentials
) => {
  return new WhatsAppWorker(config, credentials)
}
