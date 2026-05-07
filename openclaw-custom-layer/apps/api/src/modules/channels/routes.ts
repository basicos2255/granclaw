/**
 * Channels API Routes
 * P3: Real Integrations & Operational Channels
 *
 * HTTP handlers for channel management.
 * Note: These are handler functions to be registered with the main router.
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { ok, badRequest, notFound, serverError } from '../../shared/response'
import type { ChannelType, ApprovalMode } from '../channels-runtime/types'
import {
  createChannel,
  getChannel,
  getChannelsByTenant,
  connectChannel,
  disconnectChannel,
  getChannelStats,
  getProviderSummary,
  getRecentEvents
} from '../channels-runtime'

// Inline request helpers
function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

function getQueryParams(req: IncomingMessage): Record<string, string> {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`)
  const params: Record<string, string> = {}
  url.searchParams.forEach((value, key) => {
    params[key] = value
  })
  return params
}

// Helper to get tenantId from request
function getTenantId(req: IncomingMessage): string {
  return ((req as unknown as Record<string, unknown>).tenantId as string) || 'default-tenant'
}

/**
 * GET /api/channels/providers
 */
export function handleGetProviders(_req: IncomingMessage, res: ServerResponse): void {
  const providers = getProviderSummary()
  ok(res, { providers })
}

/**
 * GET /api/channels
 */
export function handleGetChannels(req: IncomingMessage, res: ServerResponse): void {
  const tenantId = getTenantId(req)
  const channels = getChannelsByTenant(tenantId)

  ok(res, {
    channels: channels.map(ch => ({
      id: ch.config.id,
      type: ch.config.type,
      name: ch.config.name,
      status: ch.status,
      stability: ch.stability,
      enabled: ch.config.enabled,
      lastActivity: ch.lastActivity,
      health: ch.health
    }))
  })
}

/**
 * GET /api/channels/stats
 */
export function handleGetStats(req: IncomingMessage, res: ServerResponse): void {
  const tenantId = getTenantId(req)
  const stats = getChannelStats(tenantId)
  ok(res, stats)
}

/**
 * POST /api/channels
 */
export async function handleCreateChannel(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const tenantId = getTenantId(req)

  try {
    const body = await parseBody(req)
    const { type, name, settings, credentialId, scopes, approvalMode, rateLimit, enabled } = body

    if (!type || !name) {
      return badRequest(res, 'type and name are required')
    }

    const channel = await createChannel({
      type: type as ChannelType,
      name: name as string,
      tenantId,
      enabled: (enabled as boolean) ?? true,
      credentialId: credentialId as string | undefined,
      scopes: (scopes as string[]) || [],
      settings: (settings as Record<string, unknown>) || {},
      approvalMode: (approvalMode as ApprovalMode) || 'auto',
      rateLimit: rateLimit ? {
        maxPerMinute: (rateLimit as Record<string, number>).maxPerMinute || 60,
        maxPerHour: (rateLimit as Record<string, number>).maxPerHour || 1000,
        maxPerDay: (rateLimit as Record<string, number>).maxPerDay || 10000
      } : undefined
    })

    ok(res, {
      id: channel.config.id,
      type: channel.config.type,
      name: channel.config.name,
      status: channel.status,
      health: channel.health
    }, 201)
  } catch (err) {
    serverError(res, (err as Error).message)
  }
}

/**
 * GET /api/channels/:id
 */
export function handleGetChannelById(_req: IncomingMessage, res: ServerResponse, channelId: string): void {
  const channel = getChannel(channelId)

  if (!channel) {
    return notFound(res, 'Channel not found')
  }

  ok(res, {
    id: channel.config.id,
    type: channel.config.type,
    name: channel.config.name,
    status: channel.status,
    stability: channel.stability,
    enabled: channel.config.enabled,
    scopes: channel.config.scopes,
    approvalMode: channel.config.approvalMode,
    settings: channel.config.settings,
    lastActivity: channel.lastActivity,
    lastError: channel.lastError,
    metrics: channel.metrics,
    health: channel.health,
    createdAt: channel.config.createdAt,
    updatedAt: channel.config.updatedAt
  })
}

/**
 * POST /api/channels/:id/connect
 */
export async function handleConnectChannel(_req: IncomingMessage, res: ServerResponse, channelId: string): Promise<void> {
  const result = await connectChannel(channelId)

  if (!result.success) {
    return badRequest(res, result.error || 'Connection failed')
  }

  const channel = getChannel(channelId)
  ok(res, {
    success: true,
    status: channel?.status,
    health: channel?.health
  })
}

/**
 * POST /api/channels/:id/disconnect
 */
export async function handleDisconnectChannel(_req: IncomingMessage, res: ServerResponse, channelId: string): Promise<void> {
  await disconnectChannel(channelId)
  const channel = getChannel(channelId)
  ok(res, { success: true, status: channel?.status })
}

/**
 * GET /api/channels/:id/events
 */
export function handleGetChannelEvents(req: IncomingMessage, res: ServerResponse, channelId: string): void {
  const params = getQueryParams(req)
  const limit = parseInt(params.limit || '20')
  const events = getRecentEvents(channelId, limit)
  ok(res, { events })
}
