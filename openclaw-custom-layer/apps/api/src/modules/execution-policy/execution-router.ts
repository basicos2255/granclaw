/**
 * Execution Router - AUTHORITATIVE
 * FEATURE 120: Hybrid Execution Policy v1
 * FIX 121: Authoritative Hybrid Router & Intent Classification
 *
 * This is the SINGLE authority for execution decisions.
 * The detector only provides signals. This router makes the final call.
 *
 * Priority order:
 * 1. Hub decision (if blocked, stop)
 * 2. Intent classification (install/complex → OpenClaw)
 * 3. Policy configuration
 * 4. Capability status
 */

import type {
  ExecutionRouteDecision,
  ExecutionRouteInput,
  ExecutionRoute,
  ExecutionConfidence
} from './types'
import { DETERMINISTIC_CAPABILITIES } from './types'
import { classifyIntent, shouldBlockLocalProposal, requiresOpenClaw, type IntentClassification } from './intent-classifier'

/**
 * Check if message explicitly requests OpenClaw
 */
function requestsOpenClaw(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('usa openclaw') ||
    lower.includes('use openclaw') ||
    lower.includes('con openclaw') ||
    lower.includes('with openclaw') ||
    lower.includes('usando ia') ||
    lower.includes('con ia') ||
    lower.includes('usando inteligencia artificial')
}

/**
 * Check if capability is deterministic (can be executed without AI)
 */
function isDeterministicCapability(capabilityKey: string): boolean {
  return DETERMINISTIC_CAPABILITIES.includes(capabilityKey)
}

/**
 * AUTHORITATIVE execution route decision.
 * This function is the SINGLE source of truth for how to execute a request.
 */
export function decideExecutionRoute(input: ExecutionRouteInput): ExecutionRouteDecision {
  const {
    message,
    mode,
    hubAllowed,
    intent: providedIntent,
    detectedCapabilityKey,
    approvedCapability,
    policyConfig
  } = input

  // Classify intent if not provided
  const intent = providedIntent || classifyIntent(message)

  // === RULE 1: Hub blocked - no execution ===
  if (!hubAllowed) {
    return {
      provider: 'local',
      reason: 'Hub bloqueo la accion',
      confidence: 'high',
      needsAi: false,
      tokenSaving: true,
      intent
    }
  }

  // === RULE 2: User explicitly requests OpenClaw ===
  if (requestsOpenClaw(message)) {
    return {
      provider: 'openclaw',
      reason: 'Usuario solicito explicitamente OpenClaw/IA',
      capabilityKey: detectedCapabilityKey,
      confidence: 'high',
      needsAi: true,
      tokenSaving: false,
      intent
    }
  }

  // === RULE 3: Install/download actions ALWAYS go to OpenClaw ===
  // This prevents false positives like "descarga e instala" → editor
  if (intent.kind === 'install_download_action') {
    return {
      provider: 'openclaw',
      reason: 'Instalacion/descarga requiere agente multistep',
      capabilityKey: undefined, // Do NOT use detected capability
      confidence: 'high',
      needsAi: true,
      tokenSaving: false,
      shouldCreateProposal: false,
      intent
    }
  }

  // === RULE 4: Complex agent tasks go to OpenClaw ===
  if (intent.kind === 'complex_agent_task') {
    return {
      provider: 'openclaw',
      reason: 'Tarea compleja requiere razonamiento de agente',
      capabilityKey: undefined,
      confidence: 'high',
      needsAi: true,
      tokenSaving: false,
      intent
    }
  }

  // === RULE 5: Analysis tasks go to OpenClaw ===
  if (intent.kind === 'analysis_task') {
    return {
      provider: 'openclaw',
      reason: 'Analisis requiere razonamiento IA',
      capabilityKey: undefined,
      confidence: 'high',
      needsAi: true,
      tokenSaving: false,
      intent
    }
  }

  // === RULE 6: Provider explicitly set to OpenClaw ===
  if (policyConfig.provider === 'openclaw') {
    return {
      provider: 'openclaw',
      reason: 'Politica configurada para usar OpenClaw',
      capabilityKey: detectedCapabilityKey,
      confidence: 'high',
      needsAi: true,
      tokenSaving: false,
      intent
    }
  }

  // === RULE 7: Provider explicitly set to local ===
  if (policyConfig.provider === 'local') {
    if (approvedCapability?.enabled) {
      const needsConfirmation = shouldRequireConfirmation(
        approvedCapability.riskLevel,
        mode,
        policyConfig
      )
      return {
        provider: 'local',
        reason: needsConfirmation
          ? 'Politica local, capacidad aprobada (requiere confirmacion)'
          : 'Politica local, capacidad aprobada',
        capabilityKey: approvedCapability.capabilityKey,
        confidence: 'high',
        needsAi: false,
        tokenSaving: true,
        intent
      }
    }

    // No approved capability but policy is local
    // If intent blocks local proposal, go to openclaw anyway
    if (shouldBlockLocalProposal(intent)) {
      return {
        provider: 'openclaw',
        reason: 'Politica local pero intencion requiere agente',
        capabilityKey: undefined,
        confidence: 'medium',
        needsAi: true,
        tokenSaving: false,
        intent
      }
    }

    // Create proposal for local execution
    if (detectedCapabilityKey) {
      return {
        provider: 'proposal',
        reason: 'Politica local, capacidad detectada pero no aprobada',
        capabilityKey: detectedCapabilityKey,
        confidence: 'medium',
        needsAi: false,
        tokenSaving: true,
        shouldCreateProposal: true,
        intent
      }
    }

    // No capability detected, fallback to openclaw
    return {
      provider: 'openclaw',
      reason: 'Politica local pero sin capacidad detectada',
      confidence: 'low',
      needsAi: true,
      tokenSaving: false,
      intent
    }
  }

  // === AUTO MODE: Smart routing ===

  // Has approved, enabled capability
  if (approvedCapability?.enabled) {
    const capKey = approvedCapability.capabilityKey
    const isDeterministic = isDeterministicCapability(capKey)

    // Deterministic + avoidAiForLearnedActions = local execution
    if (isDeterministic && policyConfig.avoidAiForLearnedActions) {
      const needsConfirmation = shouldRequireConfirmation(
        approvedCapability.riskLevel,
        mode,
        policyConfig
      )

      return {
        provider: 'local',
        reason: needsConfirmation
          ? 'Accion aprendida deterministica (requiere confirmacion)'
          : 'Accion aprendida deterministica - ahorro tokens',
        capabilityKey: capKey,
        confidence: 'high',
        needsAi: false,
        tokenSaving: true,
        intent
      }
    }

    // Non-deterministic but approved
    if (policyConfig.preferOpenClawForNewActions && !isDeterministic) {
      return {
        provider: 'openclaw',
        reason: 'Capacidad no deterministica, preferencia OpenClaw',
        capabilityKey: capKey,
        confidence: 'medium',
        needsAi: true,
        tokenSaving: false,
        fallbackAvailable: policyConfig.allowLocalFallback,
        shouldUseFallback: policyConfig.allowLocalFallback,
        intent
      }
    }

    // Default: execute locally with approved capability
    return {
      provider: 'local',
      reason: 'Capacidad aprobada para ejecucion local',
      capabilityKey: capKey,
      confidence: 'medium',
      needsAi: false,
      tokenSaving: true,
      intent
    }
  }

  // Has detected capability but NOT approved
  if (detectedCapabilityKey) {
    const isDeterministic = isDeterministicCapability(detectedCapabilityKey)

    // If intent requires agent, don't create proposal for simple tools
    if (shouldBlockLocalProposal(intent)) {
      return {
        provider: 'openclaw',
        reason: 'Intencion compleja, no crear proposal local',
        capabilityKey: undefined,
        confidence: 'medium',
        needsAi: true,
        tokenSaving: false,
        shouldCreateProposal: false,
        intent
      }
    }

    // Deterministic tool not approved - create proposal
    if (isDeterministic) {
      return {
        provider: 'proposal',
        reason: 'Herramienta deterministica no aprobada',
        capabilityKey: detectedCapabilityKey,
        confidence: 'high',
        needsAi: false,
        tokenSaving: true,
        shouldCreateProposal: true,
        intent
      }
    }

    // Non-deterministic, prefer OpenClaw
    if (policyConfig.preferOpenClawForNewActions) {
      return {
        provider: 'openclaw',
        reason: 'Nueva accion, preferencia OpenClaw',
        capabilityKey: detectedCapabilityKey,
        confidence: 'medium',
        needsAi: true,
        tokenSaving: false,
        intent
      }
    }

    // Create proposal
    return {
      provider: 'proposal',
      reason: 'Capacidad detectada sin aprobacion',
      capabilityKey: detectedCapabilityKey,
      confidence: 'medium',
      needsAi: false,
      tokenSaving: true,
      shouldCreateProposal: true,
      intent
    }
  }

  // === NO CAPABILITY DETECTED ===

  // Intent requires OpenClaw
  if (requiresOpenClaw(intent)) {
    return {
      provider: 'openclaw',
      reason: 'Intencion requiere razonamiento IA',
      confidence: 'medium',
      needsAi: true,
      tokenSaving: false,
      intent
    }
  }

  // Simple question or unknown - delegate to OpenClaw
  return {
    provider: 'openclaw',
    reason: 'Sin capacidad detectada, delegando a OpenClaw',
    confidence: 'low',
    needsAi: true,
    tokenSaving: false,
    intent
  }
}

/**
 * Check if confirmation is required based on risk and mode
 */
function shouldRequireConfirmation(
  riskLevel: 'low' | 'medium' | 'high',
  mode: 'strict' | 'passthrough',
  policyConfig: {
    requireConfirmationForOsToolsInStrict: boolean
    requireConfirmationForHighRiskInFree: boolean
  }
): boolean {
  if (mode === 'strict') {
    return policyConfig.requireConfirmationForOsToolsInStrict
  }

  // Passthrough mode
  if (riskLevel === 'high') {
    return policyConfig.requireConfirmationForHighRiskInFree
  }

  return false
}

/**
 * Execution step for multi-step tasks (future use)
 */
export interface ExecutionStep {
  input: string
  preferredProvider: ExecutionRoute
  capabilityKey?: string
  needsAi: boolean
  canReuseLearnedAction: boolean
}

/**
 * Task execution plan (future use)
 */
export interface TaskExecutionPlan {
  steps: ExecutionStep[]
}

/**
 * Preview execution plan for a message (future use)
 */
export function createExecutionPlanPreview(
  message: string,
  detectedCapabilities: string[]
): TaskExecutionPlan {
  const intent = classifyIntent(message)

  const steps: ExecutionStep[] = [{
    input: message,
    preferredProvider: requiresOpenClaw(intent) ? 'openclaw' : 'local',
    capabilityKey: detectedCapabilities[0],
    needsAi: intent.needsAi,
    canReuseLearnedAction: detectedCapabilities.some(cap => isDeterministicCapability(cap)) && !intent.isMultiStep
  }]

  return { steps }
}
