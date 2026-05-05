/**
 * GranClaw Hub Rules
 * FEATURE 050: Reglas básicas de control
 * FEATURE 051: Integración con config y modos
 * FEATURE 052: Config recibida ya es del tenant correspondiente
 */

import type { GranClawHubContext, GranClawRuleResult, GranClawHubRule } from './types'
import type { GranClawHubConfig } from './config'

/**
 * Regla: Bloquear mensajes vacíos
 */
const emptyMessageRule: GranClawHubRule = {
  id: 'empty-message',
  name: 'Empty Message Block',
  check: (context: GranClawHubContext, _config: GranClawHubConfig): GranClawRuleResult => {
    if (!context.message || context.message.trim() === '') {
      return {
        allowed: false,
        reason: 'Empty message not allowed'
      }
    }
    return { allowed: true }
  }
}

/**
 * Regla: Bloquear palabras prohibidas (desde config)
 * FEATURE 051: Usa blockedWords desde config
 */
const blockedWordsRule: GranClawHubRule = {
  id: 'blocked-words',
  name: 'Blocked Words Check',
  check: (context: GranClawHubContext, config: GranClawHubConfig): GranClawRuleResult => {
    const messageLower = context.message.toLowerCase()
    for (const word of config.blockedWords) {
      if (messageLower.includes(word.toLowerCase())) {
        return {
          allowed: false,
          reason: `Message contains blocked word: ${word}`
        }
      }
    }
    return { allowed: true }
  }
}

/**
 * Lista de reglas activas
 */
const activeRules: GranClawHubRule[] = [
  emptyMessageRule,
  blockedWordsRule
]

/**
 * Resultado de aplicar reglas con log
 */
export interface ApplyRulesResult {
  allowed: boolean
  reason?: string
  modifiedMessage?: string
  triggeredRules: string[]
}

/**
 * Aplicar todas las reglas según config
 * FEATURE 051: Soporta modo passthrough y strict
 */
export function applyRules(context: GranClawHubContext, config: GranClawHubConfig): ApplyRulesResult {
  const triggeredRules: string[] = []

  for (const rule of activeRules) {
    const result = rule.check(context, config)

    if (!result.allowed) {
      triggeredRules.push(rule.id)

      // FEATURE 051: En modo passthrough, registrar pero no bloquear
      if (config.mode === 'passthrough') {
        continue
      }

      // En modo strict, bloquear
      return {
        allowed: false,
        reason: result.reason,
        modifiedMessage: result.modifiedMessage,
        triggeredRules
      }
    }
  }

  return {
    allowed: true,
    triggeredRules
  }
}

/**
 * Obtener lista de reglas activas (para debug/admin)
 */
export function getActiveRules(): Array<{ id: string; name: string }> {
  return activeRules.map(r => ({ id: r.id, name: r.name }))
}
