/**
 * Execution Policy Types
 * FEATURE 120: Hybrid Execution Policy v1
 * FIX 121: Authoritative Hybrid Router & Intent Classification
 *
 * Defines policy for deciding between local and OpenClaw execution.
 */

import type { IntentClassification } from './intent-classifier'

/**
 * Execution provider options
 */
export type ExecutionProvider = 'auto' | 'openclaw' | 'local'

/**
 * Execution route decision
 */
export type ExecutionRoute = 'local' | 'openclaw' | 'proposal'

/**
 * Confidence level of execution decision
 */
export type ExecutionConfidence = 'low' | 'medium' | 'high'

/**
 * Execution policy configuration per tenant
 */
export interface ExecutionPolicyConfig {
  tenantId: string
  provider: ExecutionProvider
  /** Prefer OpenClaw for new/unknown actions */
  preferOpenClawForNewActions: boolean
  /** Allow local fallback if OpenClaw fails */
  allowLocalFallback: boolean
  /** Avoid AI for learned/deterministic actions */
  avoidAiForLearnedActions: boolean
  /** Require confirmation for OS tools in strict mode */
  requireConfirmationForOsToolsInStrict: boolean
  /** Require confirmation for high risk actions in free mode */
  requireConfirmationForHighRiskInFree: boolean
  updatedAt: string
}

/**
 * Execution route decision result
 * FIX 121: This is the AUTHORITATIVE decision - orchestrator must follow it.
 */
export interface ExecutionRouteDecision {
  /** Selected provider: local, openclaw, or proposal */
  provider: ExecutionRoute
  /** Human-readable reason */
  reason: string
  /** Matched capability key if any */
  capabilityKey?: string
  /** Confidence of decision */
  confidence: ExecutionConfidence
  /** Whether AI/reasoning is needed */
  needsAi: boolean
  /** Whether this saves tokens by avoiding AI */
  tokenSaving: boolean
  /** Whether fallback is available */
  fallbackAvailable?: boolean
  /** Whether to create a tool proposal */
  shouldCreateProposal?: boolean
  /** Whether to use local fallback on OpenClaw failure */
  shouldUseFallback?: boolean
  /** Intent classification used for decision */
  intent?: IntentClassification
}

/**
 * Input for execution route decision
 * FIX 121: Intent classification is now part of the input
 */
export interface ExecutionRouteInput {
  tenantId: string
  userId?: string
  message: string
  mode: 'strict' | 'passthrough'
  hubAllowed: boolean
  /** Intent classification - computed BEFORE capability detection */
  intent?: IntentClassification
  /** Detected capability key (signal, not authority) */
  detectedCapabilityKey?: string
  approvedCapability?: {
    id: string
    capabilityKey: string
    enabled: boolean
    riskLevel: 'low' | 'medium' | 'high'
  }
  policyConfig: ExecutionPolicyConfig
}

/**
 * Default execution policy configuration
 */
export const DEFAULT_EXECUTION_POLICY: Omit<ExecutionPolicyConfig, 'tenantId' | 'updatedAt'> = {
  provider: 'auto',
  preferOpenClawForNewActions: true,
  allowLocalFallback: true,
  avoidAiForLearnedActions: true,
  requireConfirmationForOsToolsInStrict: true,
  requireConfirmationForHighRiskInFree: true
}

/**
 * Deterministic capability keys that can be executed locally without AI
 */
export const DETERMINISTIC_CAPABILITIES: string[] = [
  'open_calculator',
  'open_web_browser',
  'open_text_editor_os',
  'open_text_editor',
  'open_file_explorer',
  'open_terminal',
  'read_local_file',
  'write_local_file',
  'list_sandbox_files'
]

/**
 * Keywords that indicate AI/reasoning is required
 */
export const AI_REQUIRED_KEYWORDS: string[] = [
  'analiza',
  'analyze',
  'investiga',
  'investigate',
  'decide',
  'compara',
  'compare',
  'informe',
  'report',
  'estrategia',
  'strategy',
  'evalua',
  'evaluate',
  'razona',
  'reason',
  'explica',
  'explain',
  'planifica',
  'plan',
  'recomienda',
  'recommend',
  'busca informacion',
  'search for',
  'investiga sobre',
  'research'
]
