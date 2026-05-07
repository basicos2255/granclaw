/**
 * Channel Manager
 * P3: Real Integrations & Operational Channels
 *
 * Manages channel instances, lifecycle, and health.
 */

import type {
  ChannelType,
  ChannelConfig,
  ChannelInstance,
  ChannelStatus,
  ChannelStability,
  ChannelCredentialRef
} from './types'
import { getChannelProvider, isProviderAvailable } from './registry'
import { hasRequiredScopes, isChannelSetupComplete } from './permissions'
import { emitChannelEvent } from './event-adapter'
import { eventBus } from '../event-bus'

/**
 * Channel instances by ID
 */
const channelInstances: Map<string, ChannelInstance> = new Map()

/**
 * Channel configs by tenant
 */
const channelsByTenant: Map<string, Set<string>> = new Map()

/**
 * Create a new channel configuration
 */
export async function createChannel(
  config: Omit<ChannelConfig, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ChannelInstance> {
  // Validate provider exists
  if (!isProviderAvailable(config.type)) {
    throw new Error(`Unknown channel type: ${config.type}`)
  }

  const provider = getChannelProvider(config.type)!

  // Generate ID
  const id = `ch_${config.type}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`

  // Create config
  const fullConfig: ChannelConfig = {
    ...config,
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  // Create instance
  const instance: ChannelInstance = {
    config: fullConfig,
    status: 'setup_required',
    stability: provider.stability,
    metrics: {
      messagesProcessed: 0,
      messagesPerHour: 0,
      errorsLastHour: 0,
      avgResponseMs: 0
    },
    health: {
      isHealthy: false,
      lastCheck: new Date().toISOString(),
      issues: ['Channel not yet connected']
    }
  }

  // Check setup status
  const setup = isChannelSetupComplete(fullConfig)
  if (!setup.complete) {
    instance.health.issues = setup.issues
  }

  // Store instance
  channelInstances.set(id, instance)

  // Track by tenant
  let tenantChannels = channelsByTenant.get(config.tenantId)
  if (!tenantChannels) {
    tenantChannels = new Set()
    channelsByTenant.set(config.tenantId, tenantChannels)
  }
  tenantChannels.add(id)

  console.log(`[ChannelManager] Created channel: ${id} (${config.type})`)

  return instance
}

/**
 * Get a channel by ID
 */
export function getChannel(channelId: string): ChannelInstance | undefined {
  return channelInstances.get(channelId)
}

/**
 * Get all channels for a tenant
 */
export function getChannelsByTenant(tenantId: string): ChannelInstance[] {
  const channelIds = channelsByTenant.get(tenantId)
  if (!channelIds) return []

  return Array.from(channelIds)
    .map(id => channelInstances.get(id))
    .filter((ch): ch is ChannelInstance => ch !== undefined)
}

/**
 * Get channels by type
 */
export function getChannelsByType(
  tenantId: string,
  type: ChannelType
): ChannelInstance[] {
  return getChannelsByTenant(tenantId)
    .filter(ch => ch.config.type === type)
}

/**
 * Update channel configuration
 */
export function updateChannel(
  channelId: string,
  updates: Partial<Omit<ChannelConfig, 'id' | 'type' | 'tenantId' | 'createdAt'>>
): ChannelInstance | undefined {
  const instance = channelInstances.get(channelId)
  if (!instance) return undefined

  // Apply updates
  instance.config = {
    ...instance.config,
    ...updates,
    updatedAt: new Date().toISOString()
  }

  // Re-check setup status
  const setup = isChannelSetupComplete(instance.config)
  if (!setup.complete) {
    instance.status = 'setup_required'
    instance.health.issues = setup.issues
    instance.health.isHealthy = false
  }

  console.log(`[ChannelManager] Updated channel: ${channelId}`)

  return instance
}

/**
 * Connect a channel (attempt to establish connection)
 */
export async function connectChannel(channelId: string): Promise<{
  success: boolean
  error?: string
}> {
  const instance = channelInstances.get(channelId)
  if (!instance) {
    return { success: false, error: 'Channel not found' }
  }

  // Check setup complete
  const setup = isChannelSetupComplete(instance.config)
  if (!setup.complete) {
    return { success: false, error: `Setup incomplete: ${setup.issues.join(', ')}` }
  }

  // Update status to connecting
  instance.status = 'connecting'

  try {
    // TODO: Actual connection logic per channel type
    // For now, simulate connection
    await new Promise(resolve => setTimeout(resolve, 500))

    // Update to connected
    instance.status = 'connected'
    instance.lastActivity = new Date().toISOString()
    instance.health.isHealthy = true
    instance.health.issues = []
    instance.health.lastCheck = new Date().toISOString()

    // Emit connected event
    await emitChannelEvent(
      channelId,
      instance.config.type,
      'channel:connected',
      { channelId, channelType: instance.config.type },
      { tenantId: instance.config.tenantId }
    )

    console.log(`[ChannelManager] Channel connected: ${channelId}`)

    return { success: true }
  } catch (err) {
    instance.status = 'error'
    instance.lastError = err instanceof Error ? err.message : 'Connection failed'
    instance.health.isHealthy = false
    instance.health.issues = [instance.lastError]

    // Emit error event
    await emitChannelEvent(
      channelId,
      instance.config.type,
      'channel:error',
      { channelId, error: instance.lastError },
      { tenantId: instance.config.tenantId }
    )

    return { success: false, error: instance.lastError }
  }
}

/**
 * Disconnect a channel
 */
export async function disconnectChannel(channelId: string): Promise<void> {
  const instance = channelInstances.get(channelId)
  if (!instance) return

  // TODO: Actual disconnection logic per channel type

  instance.status = 'disconnected'
  instance.lastActivity = new Date().toISOString()

  // Emit disconnected event
  await emitChannelEvent(
    channelId,
    instance.config.type,
    'channel:disconnected',
    { channelId, channelType: instance.config.type },
    { tenantId: instance.config.tenantId }
  )

  console.log(`[ChannelManager] Channel disconnected: ${channelId}`)
}

/**
 * Delete a channel
 */
export async function deleteChannel(channelId: string): Promise<boolean> {
  const instance = channelInstances.get(channelId)
  if (!instance) return false

  // Disconnect first
  await disconnectChannel(channelId)

  // Remove from instances
  channelInstances.delete(channelId)

  // Remove from tenant tracking
  const tenantChannels = channelsByTenant.get(instance.config.tenantId)
  if (tenantChannels) {
    tenantChannels.delete(channelId)
    if (tenantChannels.size === 0) {
      channelsByTenant.delete(instance.config.tenantId)
    }
  }

  console.log(`[ChannelManager] Channel deleted: ${channelId}`)

  return true
}

/**
 * Update channel status
 */
export function updateChannelStatus(
  channelId: string,
  status: ChannelStatus,
  error?: string
): void {
  const instance = channelInstances.get(channelId)
  if (!instance) return

  instance.status = status
  instance.lastActivity = new Date().toISOString()

  if (error) {
    instance.lastError = error
    instance.health.isHealthy = false
    instance.health.issues = [error]
  }

  if (status === 'connected') {
    instance.health.isHealthy = true
    instance.health.issues = []
  }

  instance.health.lastCheck = new Date().toISOString()
}

/**
 * Update channel metrics
 */
export function updateChannelMetrics(
  channelId: string,
  metrics: Partial<ChannelInstance['metrics']>
): void {
  const instance = channelInstances.get(channelId)
  if (!instance) return

  instance.metrics = {
    ...instance.metrics,
    ...metrics
  }
  instance.lastActivity = new Date().toISOString()
}

/**
 * Set channel credential
 */
export function setChannelCredential(
  channelId: string,
  credentialRef: ChannelCredentialRef
): { success: boolean; error?: string } {
  const instance = channelInstances.get(channelId)
  if (!instance) {
    return { success: false, error: 'Channel not found' }
  }

  // Validate scopes
  const { valid, missing } = hasRequiredScopes(instance.config.type, credentialRef.scopes)
  if (!valid) {
    return { success: false, error: `Missing required scopes: ${missing.join(', ')}` }
  }

  // Check credential status
  if (credentialRef.status !== 'active') {
    return { success: false, error: `Credential is ${credentialRef.status}` }
  }

  // Update config
  instance.config.credentialId = credentialRef.id
  instance.config.scopes = credentialRef.scopes
  instance.config.updatedAt = new Date().toISOString()

  // Re-check setup
  const setup = isChannelSetupComplete(instance.config)
  instance.health.issues = setup.issues
  if (setup.complete && instance.status === 'setup_required') {
    instance.status = 'disconnected'
  }

  console.log(`[ChannelManager] Credential set for channel: ${channelId}`)

  return { success: true }
}

/**
 * Health check for all channels
 */
export async function performHealthChecks(tenantId?: string): Promise<{
  checked: number
  healthy: number
  unhealthy: number
  issues: Array<{ channelId: string; issue: string }>
}> {
  const channels = tenantId
    ? getChannelsByTenant(tenantId)
    : Array.from(channelInstances.values())

  const issues: Array<{ channelId: string; issue: string }> = []
  let healthy = 0
  let unhealthy = 0

  for (const channel of channels) {
    // Skip disabled channels
    if (!channel.config.enabled) continue

    // Simple health check based on status
    const isHealthy = channel.status === 'connected'

    channel.health.isHealthy = isHealthy
    channel.health.lastCheck = new Date().toISOString()

    if (isHealthy) {
      healthy++
    } else {
      unhealthy++
      issues.push({
        channelId: channel.config.id,
        issue: channel.lastError || `Status: ${channel.status}`
      })
    }
  }

  return { checked: channels.length, healthy, unhealthy, issues }
}

/**
 * Get channel statistics
 */
export function getChannelStats(tenantId?: string): {
  total: number
  byType: Record<string, number>
  byStatus: Record<string, number>
  byStability: Record<string, number>
} {
  const channels = tenantId
    ? getChannelsByTenant(tenantId)
    : Array.from(channelInstances.values())

  const byType: Record<string, number> = {}
  const byStatus: Record<string, number> = {}
  const byStability: Record<string, number> = {}

  for (const channel of channels) {
    byType[channel.config.type] = (byType[channel.config.type] || 0) + 1
    byStatus[channel.status] = (byStatus[channel.status] || 0) + 1
    byStability[channel.stability] = (byStability[channel.stability] || 0) + 1
  }

  return {
    total: channels.length,
    byType,
    byStatus,
    byStability
  }
}

/**
 * Initialize channel manager
 */
export function initializeChannelManager(): void {
  // Listen for credential expiry events
  eventBus.on('credential:expired', (...args: unknown[]) => {
    const credentialId = args[0] as string
    // Find channels using this credential and mark auth expired
    for (const channel of channelInstances.values()) {
      if (channel.config.credentialId === credentialId) {
        updateChannelStatus(channel.config.id, 'auth_expired', 'Credential has expired')
        emitChannelEvent(
          channel.config.id,
          channel.config.type,
          'channel:auth_expired',
          { channelId: channel.config.id, credentialId },
          { tenantId: channel.config.tenantId }
        )
      }
    }
  })

  // Periodic health checks
  setInterval(() => {
    performHealthChecks().catch(err => {
      console.error('[ChannelManager] Health check failed:', err)
    })
  }, 60000) // Every minute

  console.log('[ChannelManager] Initialized')
}
