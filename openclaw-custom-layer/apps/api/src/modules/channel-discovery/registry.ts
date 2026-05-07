/**
 * Channel Source Registry
 * P4.1R: OpenClaw-First Integrations & Productionization
 *
 * Maps channels to their source (OpenClaw native, adapter, or provider).
 */

import type { ChannelType } from '../channels-runtime/types'
import type {
  ChannelSource,
  ChannelSourceMapping,
  OpenClawCapabilityRef
} from './types'

/**
 * OpenClaw capabilities detected
 * Based on audit of openclaw-custom-layer
 */
const openclawCapabilities: Map<string, OpenClawCapabilityRef> = new Map([
  // Native Tools
  ['http', {
    toolName: 'http',
    type: 'tool',
    available: true,
    scopes: ['network.http'],
    limitations: ['No internal URLs', '10s timeout', 'GET/POST only']
  }],
  ['echo', {
    toolName: 'echo',
    type: 'tool',
    available: true,
    scopes: [],
    limitations: []
  }],
  ['time', {
    toolName: 'time',
    type: 'tool',
    available: true,
    scopes: [],
    limitations: []
  }],

  // OS Tools (capabilities)
  ['open_calculator', {
    toolName: 'open_calculator',
    type: 'capability',
    available: true,
    scopes: ['os.launch'],
    limitations: ['Passthrough mode only']
  }],
  ['open_web_browser', {
    toolName: 'open_web_browser',
    type: 'capability',
    available: true,
    scopes: ['os.launch'],
    limitations: ['Opens default browser', 'No control']
  }],
  ['open_text_editor_os', {
    toolName: 'open_text_editor_os',
    type: 'capability',
    available: true,
    scopes: ['os.launch'],
    limitations: ['Opens default editor', 'No control']
  }],
  ['open_file_explorer', {
    toolName: 'open_file_explorer',
    type: 'capability',
    available: true,
    scopes: ['os.launch'],
    limitations: ['Opens explorer', 'No control']
  }],
  ['open_terminal', {
    toolName: 'open_terminal',
    type: 'capability',
    available: true,
    scopes: ['os.launch'],
    limitations: ['Strict mode', 'Requires confirmation']
  }]
])

/**
 * Channel source mappings
 * Defines which source handles each channel type
 */
const channelSourceMappings: Map<ChannelType, ChannelSourceMapping> = new Map([
  // EMAIL: GranClaw provider (OpenClaw has no email tool)
  ['email', {
    channelType: 'email',
    primarySource: 'granclaw_provider',
    granclawProvider: 'EmailChannelProvider',
    reason: 'OpenClaw has no native email tool. GranClaw implements IMAP/SMTP.'
  }],

  // FTP: GranClaw provider (OpenClaw has no FTP tool)
  ['ftp', {
    channelType: 'ftp',
    primarySource: 'granclaw_provider',
    granclawProvider: 'FtpChannelProvider',
    reason: 'OpenClaw has no native FTP tool. GranClaw implements FTP protocol.'
  }],

  // SFTP: GranClaw provider (OpenClaw has no SFTP tool)
  ['sftp', {
    channelType: 'sftp',
    primarySource: 'granclaw_provider',
    granclawProvider: 'SftpChannelProvider',
    reason: 'OpenClaw has no native SFTP tool. GranClaw implements SFTP protocol.'
  }],

  // BROWSER: GranClaw provider (OpenClaw open_web_browser only launches)
  ['browser', {
    channelType: 'browser',
    primarySource: 'granclaw_provider',
    openclawRef: openclawCapabilities.get('open_web_browser'),
    granclawProvider: 'BrowserChannelProvider',
    fallbackSource: 'fallback',
    reason: 'OpenClaw open_web_browser only launches browser. GranClaw adds Playwright automation.'
  }],

  // WHATSAPP: GranClaw provider (OpenClaw has no WhatsApp tool)
  ['whatsapp', {
    channelType: 'whatsapp',
    primarySource: 'granclaw_provider',
    granclawProvider: 'WhatsAppChannelProvider',
    reason: 'OpenClaw has no native WhatsApp tool. GranClaw implements Business API.'
  }],

  // CALENDAR: GranClaw provider (OpenClaw has no Calendar tool)
  ['calendar', {
    channelType: 'calendar',
    primarySource: 'granclaw_provider',
    granclawProvider: 'CalendarChannelProvider',
    reason: 'OpenClaw has no native Calendar tool. GranClaw implements Google/Outlook/CalDAV.'
  }],

  // API: GranClaw adapter over OpenClaw http tool
  ['api', {
    channelType: 'api',
    primarySource: 'granclaw_adapter',
    openclawRef: openclawCapabilities.get('http'),
    granclawProvider: 'ApiChannelAdapter',
    fallbackSource: 'granclaw_provider',
    reason: 'OpenClaw has http tool. GranClaw adapts with queue/validation/auth/metrics.'
  }],

  // FILESYSTEM: GranClaw provider (OpenClaw OS tools are app launchers)
  ['filesystem', {
    channelType: 'filesystem',
    primarySource: 'granclaw_provider',
    openclawRef: openclawCapabilities.get('open_file_explorer'),
    granclawProvider: 'FilesystemChannelProvider',
    reason: 'OpenClaw open_file_explorer only launches. GranClaw implements full FS operations.'
  }],

  // WEBHOOK: GranClaw adapter over OpenClaw http tool
  ['webhook', {
    channelType: 'webhook',
    primarySource: 'granclaw_adapter',
    openclawRef: openclawCapabilities.get('http'),
    granclawProvider: 'WebhookChannelAdapter',
    fallbackSource: 'granclaw_provider',
    reason: 'OpenClaw has http tool for outgoing. GranClaw adds incoming webhook handling.'
  }]
])

/**
 * Get OpenClaw capability by name
 */
export function getOpenClawCapability(name: string): OpenClawCapabilityRef | undefined {
  return openclawCapabilities.get(name)
}

/**
 * Get all OpenClaw capabilities
 */
export function getAllOpenClawCapabilities(): OpenClawCapabilityRef[] {
  return Array.from(openclawCapabilities.values())
}

/**
 * Get channel source mapping
 */
export function getChannelSourceMapping(type: ChannelType): ChannelSourceMapping | undefined {
  return channelSourceMappings.get(type)
}

/**
 * Get all channel source mappings
 */
export function getAllChannelSourceMappings(): ChannelSourceMapping[] {
  return Array.from(channelSourceMappings.values())
}

/**
 * Get channels by source type
 */
export function getChannelsBySource(source: ChannelSource): ChannelSourceMapping[] {
  return Array.from(channelSourceMappings.values())
    .filter(m => m.primarySource === source)
}

/**
 * Check if OpenClaw has capability for channel
 */
export function hasOpenClawCapability(type: ChannelType): boolean {
  const mapping = channelSourceMappings.get(type)
  return mapping?.openclawRef?.available ?? false
}

/**
 * Get source summary for audit
 */
export function getSourceSummary(): {
  openclaw_native: ChannelType[]
  granclaw_adapter: ChannelType[]
  granclaw_provider: ChannelType[]
} {
  const result = {
    openclaw_native: [] as ChannelType[],
    granclaw_adapter: [] as ChannelType[],
    granclaw_provider: [] as ChannelType[]
  }

  for (const [type, mapping] of channelSourceMappings) {
    if (mapping.primarySource === 'openclaw_native') {
      result.openclaw_native.push(type)
    } else if (mapping.primarySource === 'granclaw_adapter') {
      result.granclaw_adapter.push(type)
    } else if (mapping.primarySource === 'granclaw_provider') {
      result.granclaw_provider.push(type)
    }
  }

  return result
}
