/**
 * GranClaw Hub Configuration
 * FEATURE 051: Configuración dinámica del Hub
 * FEATURE 052: Soporte multi-tenant básico
 */

/**
 * Modos de ejecución del Hub
 * - passthrough: No bloquea, solo registra
 * - strict: Aplica reglas y bloquea si corresponde
 */
export type GranClawHubMode = 'passthrough' | 'strict'

/**
 * Configuración del Hub
 */
export interface GranClawHubConfig {
  enabled: boolean
  mode: GranClawHubMode
  blockedWords: string[]
}

/**
 * Tenant ID por defecto
 */
export const DEFAULT_TENANT_ID = 'default'

/**
 * Configuración por defecto (global)
 */
const defaultConfig: GranClawHubConfig = {
  enabled: true,
  mode: 'strict',
  blockedWords: ['forbidden']
}

// Config global (singleton mutable)
let globalConfig: GranClawHubConfig = { ...defaultConfig }

// FEATURE 052: Configs por tenant (en memoria)
const tenantConfigs: Map<string, GranClawHubConfig> = new Map()

/**
 * Normalizar tenantId (vacío → default)
 */
function normalizeTenantId(tenantId?: string): string {
  return tenantId?.trim() || DEFAULT_TENANT_ID
}

/**
 * Obtener configuración para un tenant
 * FEATURE 052: Si existe config específica del tenant, usarla; si no, usar global
 */
export function getHubConfig(tenantId?: string): GranClawHubConfig {
  const normalizedId = normalizeTenantId(tenantId)

  // Buscar config específica del tenant
  const tenantConfig = tenantConfigs.get(normalizedId)
  if (tenantConfig) {
    return { ...tenantConfig }
  }

  // Fallback a config global
  return { ...globalConfig }
}

/**
 * Actualizar configuración global
 */
export function setHubConfig(config: Partial<GranClawHubConfig>): void {
  globalConfig = {
    ...globalConfig,
    ...config
  }
  console.log('[HUB] Global config updated:', globalConfig)
}

/**
 * FEATURE 052: Obtener config específica de un tenant (o null si no existe)
 */
export function getTenantHubConfig(tenantId: string): GranClawHubConfig | null {
  const normalizedId = normalizeTenantId(tenantId)
  const config = tenantConfigs.get(normalizedId)
  return config ? { ...config } : null
}

/**
 * FEATURE 052: Establecer config específica para un tenant
 */
export function setTenantHubConfig(tenantId: string, config: Partial<GranClawHubConfig>): void {
  const normalizedId = normalizeTenantId(tenantId)

  // Obtener config base (existente del tenant o global)
  const existingConfig = tenantConfigs.get(normalizedId) || { ...globalConfig }

  const newConfig: GranClawHubConfig = {
    ...existingConfig,
    ...config
  }

  tenantConfigs.set(normalizedId, newConfig)
  console.log(`[HUB] Tenant "${normalizedId}" config updated:`, newConfig)
}

/**
 * FEATURE 052: Eliminar config específica de un tenant (volverá a usar global)
 */
export function removeTenantHubConfig(tenantId: string): boolean {
  const normalizedId = normalizeTenantId(tenantId)
  const existed = tenantConfigs.delete(normalizedId)
  if (existed) {
    console.log(`[HUB] Tenant "${normalizedId}" config removed, will use global`)
  }
  return existed
}

/**
 * FEATURE 052: Listar todos los tenants con config específica
 */
export function listTenantConfigs(): Array<{ tenantId: string; config: GranClawHubConfig }> {
  const result: Array<{ tenantId: string; config: GranClawHubConfig }> = []
  tenantConfigs.forEach((config, tenantId) => {
    result.push({ tenantId, config: { ...config } })
  })
  return result
}

/**
 * Resetear a configuración por defecto (global y elimina configs de tenants)
 */
export function resetHubConfig(): void {
  globalConfig = { ...defaultConfig }
  tenantConfigs.clear()
  console.log('[HUB] Config reset to default (global and tenant configs cleared)')
}

/**
 * Obtener config global (sin considerar tenant)
 */
export function getGlobalHubConfig(): GranClawHubConfig {
  return { ...globalConfig }
}
