/**
 * Channel Registry
 * P3: Real Integrations & Operational Channels
 *
 * Registry of available channel providers.
 */

import type { ChannelType, ChannelProvider, ChannelStability } from './types'

/**
 * Channel provider definitions
 */
const channelProviders: Map<ChannelType, ChannelProvider> = new Map()

/**
 * Register a channel provider
 */
export function registerChannelProvider(provider: ChannelProvider): void {
  channelProviders.set(provider.type, provider)
  console.log(`[ChannelRegistry] Registered provider: ${provider.type} (${provider.stability})`)
}

/**
 * Get a channel provider by type
 */
export function getChannelProvider(type: ChannelType): ChannelProvider | undefined {
  return channelProviders.get(type)
}

/**
 * Get all registered providers
 */
export function getAllChannelProviders(): ChannelProvider[] {
  return Array.from(channelProviders.values())
}

/**
 * Get providers by stability level
 */
export function getProvidersByStability(stability: ChannelStability): ChannelProvider[] {
  return Array.from(channelProviders.values())
    .filter(p => p.stability === stability)
}

/**
 * Check if a provider is available
 */
export function isProviderAvailable(type: ChannelType): boolean {
  return channelProviders.has(type)
}

/**
 * Initialize built-in providers
 */
export function initializeBuiltInProviders(): void {
  // Email provider
  registerChannelProvider({
    type: 'email',
    stability: 'stable',
    name: 'Email (IMAP/SMTP)',
    description: 'Send and receive emails via IMAP/SMTP',
    requiredScopes: ['email.read', 'email.send'],
    optionalScopes: ['email.attachments', 'email.labels'],
    supportedActions: [
      'send',
      'reply',
      'forward',
      'markRead',
      'archive',
      'label',
      'getThread',
      'search'
    ],
    configSchema: {
      type: 'object',
      properties: {
        imapHost: { type: 'string' },
        imapPort: { type: 'number', default: 993 },
        smtpHost: { type: 'string' },
        smtpPort: { type: 'number', default: 587 },
        pollIntervalMs: { type: 'number', default: 60000 }
      },
      required: ['imapHost', 'smtpHost']
    }
  })

  // FTP provider
  registerChannelProvider({
    type: 'ftp',
    stability: 'stable',
    name: 'FTP',
    description: 'File transfer via FTP protocol',
    requiredScopes: ['ftp.read', 'ftp.write'],
    optionalScopes: ['ftp.delete', 'ftp.admin'],
    supportedActions: [
      'upload',
      'download',
      'list',
      'delete',
      'mkdir',
      'rename',
      'sync'
    ],
    configSchema: {
      type: 'object',
      properties: {
        host: { type: 'string' },
        port: { type: 'number', default: 21 },
        secure: { type: 'boolean', default: false },
        basePath: { type: 'string', default: '/' }
      },
      required: ['host']
    }
  })

  // SFTP provider
  registerChannelProvider({
    type: 'sftp',
    stability: 'stable',
    name: 'SFTP',
    description: 'Secure file transfer via SFTP protocol',
    requiredScopes: ['sftp.read', 'sftp.write'],
    optionalScopes: ['sftp.delete', 'sftp.admin'],
    supportedActions: [
      'upload',
      'download',
      'list',
      'delete',
      'mkdir',
      'rename',
      'sync'
    ],
    configSchema: {
      type: 'object',
      properties: {
        host: { type: 'string' },
        port: { type: 'number', default: 22 },
        basePath: { type: 'string', default: '/' }
      },
      required: ['host']
    }
  })

  // Browser automation provider
  registerChannelProvider({
    type: 'browser',
    stability: 'beta',
    name: 'Browser Automation',
    description: 'Automate web browser actions via Playwright',
    requiredScopes: ['browser.navigate', 'browser.interact'],
    optionalScopes: ['browser.screenshot', 'browser.download'],
    supportedActions: [
      'navigate',
      'click',
      'type',
      'screenshot',
      'extract',
      'wait',
      'scroll',
      'evaluate'
    ],
    configSchema: {
      type: 'object',
      properties: {
        browserType: { type: 'string', enum: ['chromium', 'firefox', 'webkit'], default: 'chromium' },
        headless: { type: 'boolean', default: true },
        timeout: { type: 'number', default: 30000 },
        viewport: {
          type: 'object',
          properties: {
            width: { type: 'number', default: 1280 },
            height: { type: 'number', default: 720 }
          }
        }
      }
    }
  })

  // WhatsApp provider (Business API)
  registerChannelProvider({
    type: 'whatsapp',
    stability: 'beta',
    name: 'WhatsApp Business',
    description: 'WhatsApp Business API integration',
    requiredScopes: ['whatsapp.read', 'whatsapp.send'],
    optionalScopes: ['whatsapp.media', 'whatsapp.templates'],
    supportedActions: [
      'sendMessage',
      'sendTemplate',
      'sendMedia',
      'markRead',
      'getChat',
      'listChats'
    ],
    configSchema: {
      type: 'object',
      properties: {
        phoneNumberId: { type: 'string' },
        businessAccountId: { type: 'string' },
        webhookVerifyToken: { type: 'string' },
        autoReplyMode: { type: 'string', enum: ['off', 'safe', 'approval', 'autonomous'], default: 'safe' }
      },
      required: ['phoneNumberId', 'businessAccountId']
    }
  })

  // Calendar provider
  registerChannelProvider({
    type: 'calendar',
    stability: 'stable',
    name: 'Calendar',
    description: 'Calendar integration (Google/Outlook)',
    requiredScopes: ['calendar.read', 'calendar.write'],
    optionalScopes: ['calendar.freebusy', 'calendar.sharing'],
    supportedActions: [
      'createEvent',
      'updateEvent',
      'deleteEvent',
      'getEvent',
      'listEvents',
      'getAvailability'
    ],
    configSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string', enum: ['google', 'outlook', 'caldav'], default: 'google' },
        calendarId: { type: 'string' },
        defaultReminders: { type: 'array', items: { type: 'number' } }
      },
      required: ['provider']
    }
  })

  // Webhook provider
  registerChannelProvider({
    type: 'webhook',
    stability: 'stable',
    name: 'Webhook',
    description: 'Incoming and outgoing webhooks',
    requiredScopes: ['webhook.receive', 'webhook.send'],
    optionalScopes: ['webhook.verify'],
    supportedActions: [
      'send',
      'configure',
      'verify'
    ],
    configSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT'], default: 'POST' },
        headers: { type: 'object' },
        secret: { type: 'string' }
      }
    }
  })

  // Filesystem provider
  registerChannelProvider({
    type: 'filesystem',
    stability: 'stable',
    name: 'Local Filesystem',
    description: 'Local file system operations',
    requiredScopes: ['fs.read', 'fs.write'],
    optionalScopes: ['fs.delete', 'fs.watch'],
    supportedActions: [
      'read',
      'write',
      'delete',
      'list',
      'watch',
      'copy',
      'move'
    ],
    configSchema: {
      type: 'object',
      properties: {
        basePath: { type: 'string' },
        watchEnabled: { type: 'boolean', default: false },
        allowedExtensions: { type: 'array', items: { type: 'string' } }
      },
      required: ['basePath']
    }
  })

  // API provider
  registerChannelProvider({
    type: 'api',
    stability: 'stable',
    name: 'External API',
    description: 'Generic HTTP API integration',
    requiredScopes: ['api.call'],
    optionalScopes: ['api.auth'],
    supportedActions: [
      'get',
      'post',
      'put',
      'patch',
      'delete'
    ],
    configSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string' },
        authType: { type: 'string', enum: ['none', 'bearer', 'basic', 'apikey', 'oauth2'] },
        headers: { type: 'object' },
        timeout: { type: 'number', default: 30000 }
      },
      required: ['baseUrl']
    }
  })

  console.log(`[ChannelRegistry] Initialized ${channelProviders.size} built-in providers`)
}

/**
 * Get provider summary for UI
 */
export function getProviderSummary(): Array<{
  type: ChannelType
  name: string
  stability: ChannelStability
  description: string
}> {
  return Array.from(channelProviders.values()).map(p => ({
    type: p.type,
    name: p.name,
    stability: p.stability,
    description: p.description
  }))
}
