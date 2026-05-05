/**
 * GranClaw Hub Types
 * FEATURE 050: Capa de control previa al orchestrator
 * FEATURE 051: Logging de decisiones y modos
 */

import type { GranClawHubConfig } from './config'

/**
 * Contexto de entrada al Hub
 */
export interface GranClawHubContext {
  sessionId: string
  agentId?: string
  message: string
  tenantId?: string
  userId?: string
}

/**
 * Resultado del procesamiento del Hub
 * FEATURE 051: Añadido decisionLog
 */
export interface GranClawHubResult {
  allowed: boolean
  reason?: string
  modifiedMessage?: string
  decisionLog: string[]
}

/**
 * Resultado interno de una regla (sin decisionLog)
 */
export interface GranClawRuleResult {
  allowed: boolean
  reason?: string
  modifiedMessage?: string
}

/**
 * Regla del Hub
 * FEATURE 051: Recibe config para evaluar
 */
export interface GranClawHubRule {
  id: string
  name: string
  check: (context: GranClawHubContext, config: GranClawHubConfig) => GranClawRuleResult
}
