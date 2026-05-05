/**
 * GranClaw Hub Admin Controller
 * FEATURE 053: Endpoints administrativos para config por tenant
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { ok, badRequest, forbidden } from '../../shared/response'
import type { AuthContext } from '../auth'
import {
  getGlobalHubConfig,
  getHubConfig,
  setTenantHubConfig,
  removeTenantHubConfig,
  listTenantConfigs,
  type GranClawHubConfig
} from './config'

/**
 * Validar config parcial
 */
function validateConfig(config: unknown): { valid: boolean; error?: string } {
  if (!config || typeof config !== 'object') {
    return { valid: false, error: 'Config must be an object' }
  }

  const cfg = config as Record<string, unknown>

  if (cfg.enabled !== undefined && typeof cfg.enabled !== 'boolean') {
    return { valid: false, error: 'enabled must be boolean' }
  }

  if (cfg.mode !== undefined && cfg.mode !== 'passthrough' && cfg.mode !== 'strict') {
    return { valid: false, error: 'mode must be "passthrough" or "strict"' }
  }

  if (cfg.blockedWords !== undefined) {
    if (!Array.isArray(cfg.blockedWords)) {
      return { valid: false, error: 'blockedWords must be an array' }
    }
    for (const word of cfg.blockedWords) {
      if (typeof word !== 'string') {
        return { valid: false, error: 'blockedWords must contain only strings' }
      }
    }
  }

  return { valid: true }
}

/**
 * Verificar si usuario es admin (si existe contexto)
 */
function isAdmin(context: AuthContext | null): boolean {
  // Si no hay contexto → modo desarrollo, permitir
  if (!context) return true
  // Si existe contexto → verificar rol admin
  return context.user.role === 'admin'
}

/**
 * GET /granclaw-hub/config
 * Devuelve config global y lista de tenants con sus configs
 */
export function handleGetAllConfig(
  _req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null
): void {
  if (!isAdmin(context)) {
    forbidden(res, 'Admin access required')
    return
  }

  const defaultConfig = getGlobalHubConfig()
  const tenantList = listTenantConfigs()

  const tenants: Record<string, GranClawHubConfig> = {}
  for (const { tenantId, config } of tenantList) {
    tenants[tenantId] = config
  }

  ok(res, {
    defaultConfig,
    tenants
  })
}

/**
 * GET /granclaw-hub/config/:tenantId
 * Devuelve config de un tenant (o fallback a global)
 */
export function handleGetTenantConfig(
  _req: IncomingMessage,
  res: ServerResponse,
  tenantId: string,
  context: AuthContext | null
): void {
  if (!isAdmin(context)) {
    forbidden(res, 'Admin access required')
    return
  }

  if (!tenantId || tenantId.trim() === '') {
    badRequest(res, 'tenantId is required')
    return
  }

  const config = getHubConfig(tenantId)

  ok(res, {
    tenantId,
    config,
    source: listTenantConfigs().some(t => t.tenantId === tenantId) ? 'tenant' : 'global'
  })
}

/**
 * POST /granclaw-hub/config/:tenantId
 * Establece config para un tenant
 */
export function handleSetTenantConfig(
  req: IncomingMessage,
  res: ServerResponse,
  tenantId: string,
  context: AuthContext | null
): void {
  if (!isAdmin(context)) {
    forbidden(res, 'Admin access required')
    return
  }

  if (!tenantId || tenantId.trim() === '') {
    badRequest(res, 'tenantId is required')
    return
  }

  let body = ''

  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', () => {
    if (!body) {
      badRequest(res, 'Request body is required')
      return
    }

    let config: Partial<GranClawHubConfig>
    try {
      config = JSON.parse(body)
    } catch {
      badRequest(res, 'Invalid JSON body')
      return
    }

    const validation = validateConfig(config)
    if (!validation.valid) {
      badRequest(res, validation.error || 'Invalid config')
      return
    }

    setTenantHubConfig(tenantId, config)

    ok(res, {
      success: true,
      tenantId,
      config: getHubConfig(tenantId)
    })
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}

/**
 * DELETE /granclaw-hub/config/:tenantId
 * Elimina config de un tenant (volverá a usar global)
 */
export function handleDeleteTenantConfig(
  _req: IncomingMessage,
  res: ServerResponse,
  tenantId: string,
  context: AuthContext | null
): void {
  if (!isAdmin(context)) {
    forbidden(res, 'Admin access required')
    return
  }

  if (!tenantId || tenantId.trim() === '') {
    badRequest(res, 'tenantId is required')
    return
  }

  const removed = removeTenantHubConfig(tenantId)

  ok(res, {
    success: true,
    tenantId,
    removed,
    message: removed ? 'Tenant config removed, will use global' : 'Tenant config did not exist'
  })
}
