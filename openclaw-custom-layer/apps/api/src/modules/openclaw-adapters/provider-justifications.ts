/**
 * Provider Justifications
 * P4.2: OpenClaw Capability Mapping & Adapter Consolidation
 *
 * Mandatory justifications for all GranClaw providers.
 * Each provider must document why OpenClaw is not enough.
 */

import type { ChannelType } from '../channels-runtime/types'
import type { ProviderJustification, ChannelSourceWithJustification } from './types'

/**
 * Provider justifications registry
 */
const providerJustifications: Map<ChannelType, ProviderJustification> = new Map([
  // Email Provider
  ['email', {
    reason: 'OpenClaw has no IMAP/SMTP capability',
    whyOpenClawNotEnough: 'http tool cannot do IMAP polling, SMTP auth, or email protocols',
    fallbackStrategy: 'queue_for_retry',
    stability: 'stable',
    futureMigrationPossible: false,
    migrateWhen: undefined
  }],

  // FTP Provider
  ['ftp', {
    reason: 'OpenClaw has no FTP protocol support',
    whyOpenClawNotEnough: 'http tool is HTTP-only, cannot speak FTP protocol',
    fallbackStrategy: 'queue_for_retry',
    stability: 'stable',
    futureMigrationPossible: false,
    migrateWhen: undefined
  }],

  // SFTP Provider
  ['sftp', {
    reason: 'OpenClaw has no SFTP/SSH protocol support',
    whyOpenClawNotEnough: 'http tool cannot do SSH connections or SFTP',
    fallbackStrategy: 'queue_for_retry',
    stability: 'stable',
    futureMigrationPossible: false,
    migrateWhen: undefined
  }],

  // Browser Provider
  ['browser', {
    reason: 'OpenClaw open_web_browser only launches browser',
    whyOpenClawNotEnough: 'OS tool launches default browser but cannot control it (no Playwright, no automation)',
    fallbackStrategy: 'escalate_human',
    stability: 'beta',
    futureMigrationPossible: true,
    migrateWhen: 'OpenClaw adds browser automation capability'
  }],

  // WhatsApp Provider
  ['whatsapp', {
    reason: 'OpenClaw has no WhatsApp API capability',
    whyOpenClawNotEnough: 'http tool cannot auth with WhatsApp Business API or web automation',
    fallbackStrategy: 'escalate_human',
    stability: 'beta',
    futureMigrationPossible: true,
    migrateWhen: 'OpenClaw adds WhatsApp connector'
  }],

  // Calendar Provider
  ['calendar', {
    reason: 'OpenClaw has no Calendar API capability',
    whyOpenClawNotEnough: 'Requires OAuth flows and calendar-specific APIs (Google, Outlook)',
    fallbackStrategy: 'queue_for_retry',
    stability: 'stable',
    futureMigrationPossible: true,
    migrateWhen: 'OpenClaw adds Calendar connector'
  }],

  // Filesystem Provider
  ['filesystem', {
    reason: 'OpenClaw open_file_explorer only launches file manager',
    whyOpenClawNotEnough: 'OS tool opens explorer UI but cannot read/write files programmatically',
    fallbackStrategy: 'require_setup',
    stability: 'stable',
    futureMigrationPossible: false,
    migrateWhen: undefined
  }]
])

/**
 * Get justification for a provider
 */
export function getProviderJustification(channelType: ChannelType): ProviderJustification | undefined {
  return providerJustifications.get(channelType)
}

/**
 * Check if channel requires provider (not adapter)
 */
export function requiresProvider(channelType: ChannelType): boolean {
  return providerJustifications.has(channelType)
}

/**
 * Get all channel sources with justifications
 */
export function getAllChannelSources(): ChannelSourceWithJustification[] {
  const sources: ChannelSourceWithJustification[] = []

  // Adapters (use OpenClaw http tool)
  sources.push({
    channelType: 'api',
    source: 'granclaw_adapter',
    openclawTool: 'http'
  })

  sources.push({
    channelType: 'webhook',
    source: 'granclaw_adapter',
    openclawTool: 'http'
  })

  // Providers (with justifications)
  for (const [channelType, justification] of providerJustifications) {
    sources.push({
      channelType,
      source: 'granclaw_provider',
      justification
    })
  }

  return sources
}

/**
 * Get classification summary
 */
export function getClassificationSummary(): {
  adapters: ChannelType[]
  providers: ChannelType[]
  total: number
} {
  const adapters: ChannelType[] = ['api', 'webhook']
  const providers = Array.from(providerJustifications.keys())

  return {
    adapters,
    providers,
    total: adapters.length + providers.length
  }
}

/**
 * Validate all providers have justifications
 */
export function validateProviderJustifications(): {
  valid: boolean
  missing: ChannelType[]
} {
  const requiredProviders: ChannelType[] = ['email', 'ftp', 'sftp', 'browser', 'whatsapp', 'calendar', 'filesystem']
  const missing: ChannelType[] = []

  for (const provider of requiredProviders) {
    if (!providerJustifications.has(provider)) {
      missing.push(provider)
    }
  }

  return {
    valid: missing.length === 0,
    missing
  }
}
