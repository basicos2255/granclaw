/**
 * GranClaw Hub Service
 * FEATURE 050: Capa de control previa al orchestrator
 * FEATURE 051: Logging de decisiones y config dinámica
 * FEATURE 052: Soporte multi-tenant
 */

import type { GranClawHubContext, GranClawHubResult } from './types'
import { applyRules, getActiveRules } from './rules'
import {
  getHubConfig,
  setHubConfig,
  setTenantHubConfig,
  getTenantHubConfig,
  removeTenantHubConfig,
  listTenantConfigs,
  DEFAULT_TENANT_ID,
  type GranClawHubConfig
} from './config'

/**
 * GranClaw Hub Service Interface
 * FEATURE 051: Añadido getConfig y setConfig
 * FEATURE 052: Añadido métodos para tenant config
 */
export interface GranClawHubService {
  process: (context: GranClawHubContext) => GranClawHubResult
  getRules: () => Array<{ id: string; name: string }>
  getConfig: (tenantId?: string) => GranClawHubConfig
  setConfig: (config: Partial<GranClawHubConfig>) => void
  setTenantConfig: (tenantId: string, config: Partial<GranClawHubConfig>) => void
  getTenantConfig: (tenantId: string) => GranClawHubConfig | null
  removeTenantConfig: (tenantId: string) => boolean
  listTenants: () => Array<{ tenantId: string; config: GranClawHubConfig }>
  isEnabled: (tenantId?: string) => boolean
}

/**
 * Crear instancia del Hub Service
 * FEATURE 051: Con logging de decisiones
 */
export function createGranClawHubService(): GranClawHubService {
  return {
    /**
     * Procesar contexto y aplicar reglas
     * FEATURE 051: Genera decisionLog detallado
     * FEATURE 052: Usa config por tenant
     */
    process(context: GranClawHubContext): GranClawHubResult {
      const tenantId = context.tenantId || DEFAULT_TENANT_ID
      const config = getHubConfig(tenantId)
      const decisionLog: string[] = []

      // FEATURE 052: Log tenant primero
      decisionLog.push(`Tenant: ${tenantId}`)
      // Log config estado
      decisionLog.push(`Hub enabled: ${config.enabled}`)

      // FEATURE 051: Si Hub deshabilitado, permitir sin procesar
      if (!config.enabled) {
        decisionLog.push('Hub disabled - allowing all')
        console.log('[HUB] Disabled, allowing:', context.sessionId)
        return {
          allowed: true,
          decisionLog
        }
      }

      decisionLog.push(`Mode: ${config.mode}`)
      decisionLog.push(`Blocked words: ${config.blockedWords.join(', ')}`)

      // FEATURE 052: Incluir tenant en log
      console.log('[HUB] Processing:', {
        tenant: tenantId,
        sessionId: context.sessionId,
        agentId: context.agentId,
        messageLength: context.message?.length || 0,
        mode: config.mode
      })

      // Aplicar reglas
      const rulesResult = applyRules(context, config)

      // Log reglas disparadas
      if (rulesResult.triggeredRules.length > 0) {
        for (const ruleId of rulesResult.triggeredRules) {
          decisionLog.push(`Rule triggered: ${ruleId}`)
        }
      }

      // Log decisión final
      if (rulesResult.allowed) {
        decisionLog.push('Execution allowed')
        console.log('[HUB] Allowed')
      } else {
        decisionLog.push(`Execution blocked: ${rulesResult.reason}`)
        console.log('[HUB] Blocked:', rulesResult.reason)
      }

      return {
        allowed: rulesResult.allowed,
        reason: rulesResult.reason,
        modifiedMessage: rulesResult.modifiedMessage,
        decisionLog
      }
    },

    /**
     * Obtener reglas activas
     */
    getRules() {
      return getActiveRules()
    },

    /**
     * FEATURE 051: Obtener config actual
     * FEATURE 052: Soporta tenantId opcional
     */
    getConfig(tenantId?: string) {
      return getHubConfig(tenantId)
    },

    /**
     * FEATURE 051: Actualizar config global
     */
    setConfig(config: Partial<GranClawHubConfig>) {
      setHubConfig(config)
    },

    /**
     * FEATURE 052: Establecer config para un tenant específico
     */
    setTenantConfig(tenantId: string, config: Partial<GranClawHubConfig>) {
      setTenantHubConfig(tenantId, config)
    },

    /**
     * FEATURE 052: Obtener config específica de un tenant (null si no existe)
     */
    getTenantConfig(tenantId: string) {
      return getTenantHubConfig(tenantId)
    },

    /**
     * FEATURE 052: Eliminar config de un tenant (volverá a usar global)
     */
    removeTenantConfig(tenantId: string) {
      return removeTenantHubConfig(tenantId)
    },

    /**
     * FEATURE 052: Listar todos los tenants con config específica
     */
    listTenants() {
      return listTenantConfigs()
    },

    /**
     * FEATURE 051: Verificar si Hub está habilitado
     * FEATURE 052: Soporta tenantId opcional
     */
    isEnabled(tenantId?: string) {
      return getHubConfig(tenantId).enabled
    }
  }
}

// Singleton instance
let hubServiceInstance: GranClawHubService | null = null

/**
 * Obtener instancia singleton del Hub Service
 */
export function getGranClawHubService(): GranClawHubService {
  if (!hubServiceInstance) {
    hubServiceInstance = createGranClawHubService()
  }
  return hubServiceInstance
}
