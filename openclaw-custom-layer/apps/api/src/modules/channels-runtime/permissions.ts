/**
 * Channel Permissions
 * P3: Real Integrations & Operational Channels
 *
 * Permission and scope management for channels.
 */

import type { ChannelType, ChannelConfig, ChannelCredentialRef } from './types'
import { getChannelProvider } from './registry'

/**
 * Scope definition
 */
interface ScopeDefinition {
  id: string
  name: string
  description: string
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  requiresApproval: boolean
}

/**
 * Scope definitions by channel type
 */
const scopeDefinitions: Record<string, ScopeDefinition> = {
  // Email scopes
  'email.read': {
    id: 'email.read',
    name: 'Read Emails',
    description: 'Read incoming emails and threads',
    riskLevel: 'low',
    requiresApproval: false
  },
  'email.send': {
    id: 'email.send',
    name: 'Send Emails',
    description: 'Send emails on your behalf',
    riskLevel: 'medium',
    requiresApproval: true
  },
  'email.attachments': {
    id: 'email.attachments',
    name: 'Manage Attachments',
    description: 'Download and upload email attachments',
    riskLevel: 'medium',
    requiresApproval: false
  },
  'email.labels': {
    id: 'email.labels',
    name: 'Manage Labels',
    description: 'Create and apply email labels',
    riskLevel: 'low',
    requiresApproval: false
  },

  // FTP scopes
  'ftp.read': {
    id: 'ftp.read',
    name: 'Read Files',
    description: 'Download files from FTP server',
    riskLevel: 'low',
    requiresApproval: false
  },
  'ftp.write': {
    id: 'ftp.write',
    name: 'Write Files',
    description: 'Upload files to FTP server',
    riskLevel: 'medium',
    requiresApproval: true
  },
  'ftp.delete': {
    id: 'ftp.delete',
    name: 'Delete Files',
    description: 'Delete files from FTP server',
    riskLevel: 'high',
    requiresApproval: true
  },
  'ftp.admin': {
    id: 'ftp.admin',
    name: 'Admin Access',
    description: 'Full administrative access to FTP server',
    riskLevel: 'critical',
    requiresApproval: true
  },

  // SFTP scopes (same as FTP)
  'sftp.read': {
    id: 'sftp.read',
    name: 'Read Files',
    description: 'Download files from SFTP server',
    riskLevel: 'low',
    requiresApproval: false
  },
  'sftp.write': {
    id: 'sftp.write',
    name: 'Write Files',
    description: 'Upload files to SFTP server',
    riskLevel: 'medium',
    requiresApproval: true
  },
  'sftp.delete': {
    id: 'sftp.delete',
    name: 'Delete Files',
    description: 'Delete files from SFTP server',
    riskLevel: 'high',
    requiresApproval: true
  },
  'sftp.admin': {
    id: 'sftp.admin',
    name: 'Admin Access',
    description: 'Full administrative access to SFTP server',
    riskLevel: 'critical',
    requiresApproval: true
  },

  // Browser scopes
  'browser.navigate': {
    id: 'browser.navigate',
    name: 'Navigate Pages',
    description: 'Navigate to web pages',
    riskLevel: 'low',
    requiresApproval: false
  },
  'browser.interact': {
    id: 'browser.interact',
    name: 'Interact with Pages',
    description: 'Click, type, and interact with web elements',
    riskLevel: 'medium',
    requiresApproval: false
  },
  'browser.screenshot': {
    id: 'browser.screenshot',
    name: 'Take Screenshots',
    description: 'Capture screenshots of web pages',
    riskLevel: 'low',
    requiresApproval: false
  },
  'browser.download': {
    id: 'browser.download',
    name: 'Download Files',
    description: 'Download files from web pages',
    riskLevel: 'medium',
    requiresApproval: true
  },

  // WhatsApp scopes
  'whatsapp.read': {
    id: 'whatsapp.read',
    name: 'Read Messages',
    description: 'Read incoming WhatsApp messages',
    riskLevel: 'low',
    requiresApproval: false
  },
  'whatsapp.send': {
    id: 'whatsapp.send',
    name: 'Send Messages',
    description: 'Send WhatsApp messages',
    riskLevel: 'high',
    requiresApproval: true
  },
  'whatsapp.media': {
    id: 'whatsapp.media',
    name: 'Send Media',
    description: 'Send images, documents, and media',
    riskLevel: 'medium',
    requiresApproval: true
  },
  'whatsapp.templates': {
    id: 'whatsapp.templates',
    name: 'Use Templates',
    description: 'Send pre-approved message templates',
    riskLevel: 'low',
    requiresApproval: false
  },

  // Calendar scopes
  'calendar.read': {
    id: 'calendar.read',
    name: 'Read Calendar',
    description: 'View calendar events',
    riskLevel: 'low',
    requiresApproval: false
  },
  'calendar.write': {
    id: 'calendar.write',
    name: 'Manage Events',
    description: 'Create, update, and delete calendar events',
    riskLevel: 'medium',
    requiresApproval: false
  },
  'calendar.freebusy': {
    id: 'calendar.freebusy',
    name: 'View Availability',
    description: 'Check free/busy times',
    riskLevel: 'low',
    requiresApproval: false
  },
  'calendar.sharing': {
    id: 'calendar.sharing',
    name: 'Share Calendar',
    description: 'Share calendar with others',
    riskLevel: 'medium',
    requiresApproval: true
  },

  // Webhook scopes
  'webhook.receive': {
    id: 'webhook.receive',
    name: 'Receive Webhooks',
    description: 'Receive incoming webhook calls',
    riskLevel: 'low',
    requiresApproval: false
  },
  'webhook.send': {
    id: 'webhook.send',
    name: 'Send Webhooks',
    description: 'Send outgoing webhook calls',
    riskLevel: 'medium',
    requiresApproval: false
  },
  'webhook.verify': {
    id: 'webhook.verify',
    name: 'Verify Webhooks',
    description: 'Verify webhook signatures',
    riskLevel: 'low',
    requiresApproval: false
  },

  // Filesystem scopes
  'fs.read': {
    id: 'fs.read',
    name: 'Read Files',
    description: 'Read local files',
    riskLevel: 'medium',
    requiresApproval: false
  },
  'fs.write': {
    id: 'fs.write',
    name: 'Write Files',
    description: 'Write local files',
    riskLevel: 'high',
    requiresApproval: true
  },
  'fs.delete': {
    id: 'fs.delete',
    name: 'Delete Files',
    description: 'Delete local files',
    riskLevel: 'critical',
    requiresApproval: true
  },
  'fs.watch': {
    id: 'fs.watch',
    name: 'Watch Files',
    description: 'Monitor file changes',
    riskLevel: 'low',
    requiresApproval: false
  },

  // API scopes
  'api.call': {
    id: 'api.call',
    name: 'Make API Calls',
    description: 'Make HTTP requests to external APIs',
    riskLevel: 'medium',
    requiresApproval: false
  },
  'api.auth': {
    id: 'api.auth',
    name: 'Authenticated Calls',
    description: 'Make authenticated API calls',
    riskLevel: 'medium',
    requiresApproval: false
  }
}

/**
 * Get scope definition
 */
export function getScopeDefinition(scopeId: string): ScopeDefinition | undefined {
  return scopeDefinitions[scopeId]
}

/**
 * Get all scopes for a channel type
 */
export function getScopesForChannelType(type: ChannelType): ScopeDefinition[] {
  const provider = getChannelProvider(type)
  if (!provider) return []

  const allScopes = [...provider.requiredScopes, ...provider.optionalScopes]
  return allScopes
    .map(s => scopeDefinitions[s])
    .filter((s): s is ScopeDefinition => s !== undefined)
}

/**
 * Check if a channel has required scopes
 */
export function hasRequiredScopes(
  channelType: ChannelType,
  grantedScopes: string[]
): { valid: boolean; missing: string[] } {
  const provider = getChannelProvider(channelType)
  if (!provider) return { valid: false, missing: [] }

  const missing = provider.requiredScopes.filter(s => !grantedScopes.includes(s))
  return { valid: missing.length === 0, missing }
}

/**
 * Check if an action requires approval
 */
export function actionRequiresApproval(
  action: string,
  scopes: string[],
  approvalMode: ChannelConfig['approvalMode']
): boolean {
  // Always allow mode
  if (approvalMode === 'always_allow') return false

  // Always ask mode
  if (approvalMode === 'always_ask') return true

  // Approval required mode - check scope risk
  if (approvalMode === 'approval_required') {
    return scopes.some(s => {
      const def = scopeDefinitions[s]
      return def && def.requiresApproval
    })
  }

  // Auto mode - only require for critical/high risk
  return scopes.some(s => {
    const def = scopeDefinitions[s]
    return def && (def.riskLevel === 'critical' || def.riskLevel === 'high')
  })
}

/**
 * Get risk level for an action
 */
export function getActionRiskLevel(scopes: string[]): 'low' | 'medium' | 'high' | 'critical' {
  let maxRisk: 'low' | 'medium' | 'high' | 'critical' = 'low'
  const riskOrder = ['low', 'medium', 'high', 'critical']

  for (const scope of scopes) {
    const def = scopeDefinitions[scope]
    if (def && riskOrder.indexOf(def.riskLevel) > riskOrder.indexOf(maxRisk)) {
      maxRisk = def.riskLevel
    }
  }

  return maxRisk
}

/**
 * Validate credential has required scopes
 */
export function validateCredentialScopes(
  credential: ChannelCredentialRef,
  requiredScopes: string[]
): { valid: boolean; missing: string[] } {
  const missing = requiredScopes.filter(s => !credential.scopes.includes(s))
  return { valid: missing.length === 0, missing }
}

/**
 * Get human-readable scope description
 */
export function getScopeDescription(scopeId: string): string {
  const def = scopeDefinitions[scopeId]
  return def ? `${def.name}: ${def.description}` : scopeId
}

/**
 * Check if channel is setup complete
 */
export function isChannelSetupComplete(config: ChannelConfig): {
  complete: boolean
  issues: string[]
} {
  const issues: string[] = []

  // Check credential
  if (!config.credentialId) {
    issues.push('No credential configured')
  }

  // Check required scopes
  const { valid, missing } = hasRequiredScopes(config.type, config.scopes)
  if (!valid) {
    issues.push(`Missing required scopes: ${missing.join(', ')}`)
  }

  // Check enabled
  if (!config.enabled) {
    issues.push('Channel is disabled')
  }

  return { complete: issues.length === 0, issues }
}
