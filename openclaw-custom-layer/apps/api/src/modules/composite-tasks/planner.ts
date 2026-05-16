/**
 * Composite Task Planner
 * FEATURE 130.2: Composite Tasks & Intelligent Task Chaining
 *
 * Builds composite execution plans by:
 * - Splitting input into substeps
 * - Finding reusable patterns/capabilities for each step
 * - Deciding execution strategy (task-memory, capability, openclaw)
 * - Optimizing by skipping already-done steps
 */

import {
  type CompositeTaskStep,
  type CompositeExecutionPlan,
  type BuildCompositePlanInput,
  type BuildCompositePlanResult,
  type StepPreconditionResult,
  type CompositeStepType,
  type SecurityWarning,
  type CapabilityReadinessSummary
} from './types'
import {
  findCompositeByInput,
  findCompositeBySignature,
  generateCompositeSignature
} from './service'
import {
  normalizeTaskInput,
  findPatternByInput,
  type TaskActionType,
  type NormalizedIntent
} from '../task-memory'
import { getEnabledCapabilityByKey, normalizeCapabilityKey, getCapabilityReadiness } from '../capabilities'
import { detectSuspiciousDownload, type SuspiciousDownloadResult } from '../execution-policy'

/**
 * Patterns for splitting compound inputs
 */
const SPLIT_PATTERNS = [
  /\s+y\s+(?:luego\s+)?/i,          // "y", "y luego"
  /\s+e\s+/i,                        // "e" (Spanish)
  /\s+,\s*/,                         // comma
  /\s+entonces\s+/i,                 // "entonces"
  /\s+después\s+/i,                  // "después"
  /\s+and\s+(?:then\s+)?/i,         // "and", "and then"
  /\s+then\s+/i,                     // "then"
  /\s*;\s*/,                         // semicolon
]

/**
 * Action chain patterns (common workflows)
 */
const ACTION_CHAINS: Record<string, TaskActionType[]> = {
  'instalar': ['download_file', 'install_app'],
  'install': ['download_file', 'install_app'],
  'descargar e instalar': ['download_file', 'install_app'],
  'download and install': ['download_file', 'install_app'],
  'instalar y abrir': ['download_file', 'install_app', 'open_app'],
  'install and open': ['download_file', 'install_app', 'open_app'],
  'descargar, instalar y abrir': ['download_file', 'install_app', 'open_app'],
  'download, install and open': ['download_file', 'install_app', 'open_app'],
}

/**
 * P6.14: Single action verbs that map to capabilities
 * These allow single actions to create single-step plans
 */
const SINGLE_ACTION_VERBS: Record<string, { actionType: TaskActionType; capability: string }> = {
  // Download actions
  'descarga': { actionType: 'download_file', capability: 'download' },
  'descargar': { actionType: 'download_file', capability: 'download' },
  'download': { actionType: 'download_file', capability: 'download' },
  'baja': { actionType: 'download_file', capability: 'download' },
  'bajar': { actionType: 'download_file', capability: 'download' },
  // Search actions
  'busca': { actionType: 'search_web', capability: 'web_search' },
  'buscar': { actionType: 'search_web', capability: 'web_search' },
  'search': { actionType: 'search_web', capability: 'web_search' },
  'encuentra': { actionType: 'search_web', capability: 'web_search' },
  'encontrar': { actionType: 'search_web', capability: 'web_search' },
  // Browser actions
  'navega': { actionType: 'navigate_url', capability: 'browser' },
  'navegar': { actionType: 'navigate_url', capability: 'browser' },
  'navigate': { actionType: 'navigate_url', capability: 'browser' },
  'abre': { actionType: 'navigate_url', capability: 'browser' },
  'abrir': { actionType: 'navigate_url', capability: 'browser' },
  'open': { actionType: 'navigate_url', capability: 'browser' },
  // Open app actions
  'ejecuta': { actionType: 'open_app', capability: 'filesystem' },
  'ejecutar': { actionType: 'open_app', capability: 'filesystem' },
  'run': { actionType: 'open_app', capability: 'filesystem' },
  'lanza': { actionType: 'open_app', capability: 'filesystem' },
  'lanzar': { actionType: 'open_app', capability: 'filesystem' },
}

/**
 * P6.16: Capability validation requirements
 * Maps capabilities to their semantic validation settings.
 *
 * CRITICAL: Provider text response alone does NOT mean success.
 * We must validate that the actual action was performed.
 */
const CAPABILITY_VALIDATION: Record<string, {
  validationRequired: boolean
  validationType: 'file_downloaded' | 'app_installed' | 'app_opened' | 'process_running' | 'url_reachable' | 'file_exists' | 'directory_exists' | 'custom' | undefined
  validationCritical: boolean
  requiresConfirmation: boolean
}> = {
  'download': {
    validationRequired: true,
    validationType: 'file_downloaded',
    validationCritical: true,  // Download MUST succeed
    requiresConfirmation: true
  },
  'filesystem': {
    validationRequired: true,
    validationType: 'file_exists',
    validationCritical: false,
    requiresConfirmation: false
  },
  'browser': {
    validationRequired: true,
    validationType: 'url_reachable',
    validationCritical: false,
    requiresConfirmation: false
  },
  'web_search': {
    validationRequired: false,  // Search results are returned inline
    validationType: undefined,
    validationCritical: false,
    requiresConfirmation: false
  },
  'command_execution': {
    validationRequired: true,
    validationType: 'process_running',
    validationCritical: false,
    requiresConfirmation: true  // Commands need confirmation
  }
}

/**
 * P6.16: Get validation settings for a capability
 */
function getCapabilityValidation(capability: string): typeof CAPABILITY_VALIDATION[string] {
  return CAPABILITY_VALIDATION[capability] || {
    validationRequired: false,
    validationType: undefined,
    validationCritical: false,
    requiresConfirmation: false
  }
}

/**
 * Generate unique plan ID
 */
function generatePlanId(): string {
  return `plan-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
}

/**
 * Generate unique step ID
 */
function generateStepId(): string {
  return `step-${Math.random().toString(36).substring(2, 8)}`
}

/**
 * Split input into substeps
 */
export function splitInputIntoSteps(input: string): string[] {
  let parts = [input]

  // Try each split pattern
  for (const pattern of SPLIT_PATTERNS) {
    const newParts: string[] = []
    for (const part of parts) {
      const split = part.split(pattern).map(s => s.trim()).filter(s => s.length > 0)
      newParts.push(...split)
    }
    parts = newParts
  }

  // Remove duplicates and empty
  return [...new Set(parts)].filter(p => p.length > 0)
}

/**
 * Detect if input implies a chain action
 */
function detectActionChain(input: string): TaskActionType[] | null {
  const lower = input.toLowerCase()

  for (const [pattern, chain] of Object.entries(ACTION_CHAINS)) {
    if (lower.includes(pattern)) {
      return chain
    }
  }

  return null
}

/**
 * P6.14: Detect if input is a single capability-backed action
 * Returns the action details if found, null otherwise
 */
function detectSingleAction(input: string): { actionType: TaskActionType; capability: string; verb: string } | null {
  const lower = input.toLowerCase().trim()

  // Check each single action verb at the START of the input
  for (const [verb, details] of Object.entries(SINGLE_ACTION_VERBS)) {
    // Match verb at start of input (e.g., "descarga un archivo", "busca en google")
    if (lower.startsWith(verb + ' ') || lower === verb) {
      return { ...details, verb }
    }
  }

  // Also check if verb appears after common prefixes
  const prefixPatterns = [
    /^(por favor|porfavor|please)\s+/i,
    /^(quiero|necesito|want to|need to)\s+/i,
    /^(puedes|puede|can you)\s+/i,
    /^(me|te)\s+(puedes|puede)\s+/i,
  ]

  let strippedInput = lower
  for (const pattern of prefixPatterns) {
    strippedInput = strippedInput.replace(pattern, '')
  }

  if (strippedInput !== lower) {
    for (const [verb, details] of Object.entries(SINGLE_ACTION_VERBS)) {
      if (strippedInput.startsWith(verb + ' ') || strippedInput === verb) {
        return { ...details, verb }
      }
    }
  }

  return null
}

/**
 * Extract target entity from input
 */
function extractTargetFromInput(input: string): string | undefined {
  const normalized = normalizeTaskInput(input)
  return normalized.targetEntity
}

/**
 * Build a single step from substep input
 */
function buildStepFromInput(
  substep: string,
  order: number,
  tenantId: string
): CompositeTaskStep {
  const normalized = normalizeTaskInput(substep)
  const capabilityKey = normalized.targetEntity
    ? normalizeCapabilityKey(`${normalized.actionType}_${normalized.targetEntity}`)
    : undefined

  // Determine step type
  let stepType: CompositeStepType = 'openclaw'
  let taskPatternId: string | undefined
  let requiresAi = true

  // Try task memory first
  const patternResult = findPatternByInput({
    input: substep,
    tenantId
  })

  if (patternResult.found && patternResult.pattern && patternResult.confidence >= 0.75) {
    stepType = 'task_memory'
    taskPatternId = patternResult.pattern.id
    requiresAi = false
  } else if (capabilityKey) {
    // Try capability
    const capability = getEnabledCapabilityByKey(tenantId, capabilityKey)
    if (capability) {
      stepType = 'capability'
      requiresAi = false
    }
  }

  return {
    stepId: generateStepId(),
    order,
    type: stepType,
    actionType: normalized.actionType,
    targetEntity: normalized.targetEntity,
    description: substep,
    taskPatternId,
    capabilityKey,
    requiresAi,
    requiresConfirmation: false,
    dependsOnPrevious: order > 1,
    estimatedDurationMs: estimateStepDuration(normalized.actionType)
  }
}

/**
 * Estimate step duration based on action type
 */
function estimateStepDuration(actionType: TaskActionType): number {
  const durations: Record<string, number> = {
    'open_app': 2000,
    'close_app': 1000,
    'install_app': 30000,
    'uninstall_app': 15000,
    'download_file': 20000,
    'navigate_url': 3000,
    'search_web': 5000,
    'file_operation': 2000,
    'folder_operation': 2000,
    'system_command': 5000,
    'play_media': 2000,
    'control_media': 1000,
    'script_execution': 10000,
    'clipboard_action': 500,
    'keyboard_action': 500,
    'mouse_action': 500,
    'general_task': 10000
  }
  return durations[actionType] || 5000
}

/**
 * Check if step can be skipped (already done)
 */
export function checkStepPreconditions(
  step: CompositeTaskStep,
  _tenantId: string
): StepPreconditionResult {
  // TODO: Implement real checks
  // - Check if app already installed
  // - Check if file already downloaded
  // - Check if app already open

  // For now, always execute
  return {
    canExecute: true,
    shouldSkip: false,
    warnings: []
  }
}

/**
 * Build composite execution plan
 */
export function buildCompositeExecutionPlan(
  input: BuildCompositePlanInput
): BuildCompositePlanResult {
  const { input: userInput, tenantId, userId, skipOptimization, forceOpenClaw } = input

  // First check for existing composite task
  const existingComposite = findCompositeByInput(tenantId, userInput)
  if (existingComposite && !forceOpenClaw) {
    console.log(`[CompositePlanner] Found existing composite: ${existingComposite.id}`)

    // Build plan from existing composite
    const plan: CompositeExecutionPlan = {
      id: generatePlanId(),
      tenantId,
      userId,
      sourceInput: userInput,
      compositeTaskId: existingComposite.id,
      steps: existingComposite.steps.map(s => ({ ...s, status: 'pending' })),
      confidence: existingComposite.successRate,
      estimatedDurationMs: existingComposite.avgDurationMs || calculateTotalDuration(existingComposite.steps),
      requiresAi: existingComposite.steps.some(s => s.requiresAi),
      tokenSavingEstimate: existingComposite.tokensEstimatedSaved,
      reusedPatternIds: existingComposite.steps
        .filter(s => s.taskPatternId)
        .map(s => s.taskPatternId!),
      reusedCapabilityKeys: existingComposite.steps
        .filter(s => s.capabilityKey)
        .map(s => s.capabilityKey!),
      skippableSteps: [],
      createdAt: new Date().toISOString()
    }

    // Check for skippable steps
    if (!skipOptimization) {
      for (const step of plan.steps) {
        const precondition = checkStepPreconditions(step, tenantId)
        if (precondition.shouldSkip) {
          plan.skippableSteps.push(step.stepId)
        }
      }
    }

    return {
      found: true,
      plan,
      existingComposite,
      reason: `Reutilizando composite existente (${existingComposite.executionCount} ejecuciones)`,
      confidence: existingComposite.successRate,
      stepsFromTaskMemory: plan.steps.filter(s => s.type === 'task_memory').length,
      stepsFromCapabilities: plan.steps.filter(s => s.type === 'capability').length,
      stepsRequiringAi: plan.steps.filter(s => s.requiresAi).length,
      estimatedTokenSaving: plan.tokenSavingEstimate
    }
  }

  // Check for action chain pattern
  const targetEntity = extractTargetFromInput(userInput)
  const actionChain = detectActionChain(userInput)

  let substeps: string[]

  if (actionChain && targetEntity) {
    // Use predefined chain with target
    substeps = actionChain.map(action => {
      switch (action) {
        case 'download_file':
          return `descargar ${targetEntity}`
        case 'install_app':
          return `instalar ${targetEntity}`
        case 'open_app':
          return `abrir ${targetEntity}`
        case 'close_app':
          return `cerrar ${targetEntity}`
        default:
          return `${action} ${targetEntity}`
      }
    })
    console.log(`[CompositePlanner] Detected action chain for ${targetEntity}: ${actionChain.join(' -> ')}`)
  } else {
    // Split input into substeps
    substeps = splitInputIntoSteps(userInput)
  }

  // If only one substep and no chain, check for single capability action
  if (substeps.length <= 1 && !actionChain) {
    // P6.14: Check if this is a single capability-backed action
    const singleAction = detectSingleAction(userInput)

    if (singleAction) {
      console.log(`[CompositePlanner P6.16] Detected single capability action: ${singleAction.verb} -> ${singleAction.capability}`)

      // P6.16: Get semantic validation settings for this capability
      const validation = getCapabilityValidation(singleAction.capability)
      console.log(`[CompositePlanner P6.16] Validation for ${singleAction.capability}: required=${validation.validationRequired}, type=${validation.validationType}, critical=${validation.validationCritical}`)

      // Create a single-step plan for the capability action
      const singleStep: CompositeTaskStep = {
        stepId: generateStepId(),
        order: 1,
        type: 'openclaw',  // Will be executed via provider
        actionType: singleAction.actionType,
        targetEntity: targetEntity || undefined,
        description: userInput,
        capabilityKey: singleAction.capability,
        requiresAi: true,
        requiresConfirmation: validation.requiresConfirmation,
        dependsOnPrevious: false,
        estimatedDurationMs: estimateStepDuration(singleAction.actionType),
        // P6.16: Semantic validation for capability actions
        validationRequired: validation.validationRequired,
        validationType: validation.validationType,
        validationCritical: validation.validationCritical
      }

      const plan: CompositeExecutionPlan = {
        id: generatePlanId(),
        tenantId,
        userId,
        sourceInput: userInput,
        steps: [singleStep],
        confidence: 0.8,  // Moderate confidence for single action
        estimatedDurationMs: singleStep.estimatedDurationMs || 5000,
        requiresAi: true,
        tokenSavingEstimate: 0,
        reusedPatternIds: [],
        reusedCapabilityKeys: [singleAction.capability],
        skippableSteps: [],
        createdAt: new Date().toISOString()
      }

      // P6.14: Get capability readiness to include in response
      const readiness = getCapabilityReadiness(tenantId, singleAction.capability)
      const capabilityReadiness = {
        capability: readiness.capability as string,
        implemented: readiness.implemented,
        configured: readiness.configured,
        available: readiness.available,
        statusMessage: readiness.statusMessage
      }

      // P6.14: Check for suspicious download requests
      const securityWarnings: SecurityWarning[] = []
      if (singleAction.capability === 'download') {
        const downloadCheck = detectSuspiciousDownload(userInput)
        if (downloadCheck.isSuspicious) {
          console.log(`[CompositePlanner P6.14] Suspicious download detected: ${downloadCheck.reason}`)
          securityWarnings.push({
            type: 'suspicious_download',
            riskLevel: downloadCheck.riskLevel as 'low' | 'medium' | 'high',
            message: downloadCheck.reason || 'Descarga sospechosa detectada',
            recommendedAction: downloadCheck.recommendedAction
          })
        }
      }

      console.log(`[CompositePlanner P6.14] Capability readiness: ${JSON.stringify(capabilityReadiness)}`)

      return {
        found: true,
        plan,
        reason: `Plan de un paso para acción ${singleAction.verb} (capability: ${singleAction.capability})`,
        confidence: 0.8,
        stepsFromTaskMemory: 0,
        stepsFromCapabilities: 1,
        stepsRequiringAi: 1,
        estimatedTokenSaving: 0,
        // P6.14: Include capability readiness so UI can show warnings
        capabilityReadiness,
        blockingCapabilities: capabilityReadiness.available ? undefined : [capabilityReadiness],
        // P6.14: Include security warnings for risky requests
        securityWarnings: securityWarnings.length > 0 ? securityWarnings : undefined
      }
    }

    // Truly simple task - no capability backing
    return {
      found: false,
      reason: 'Input es tarea simple sin capability asociada',
      confidence: 0,
      stepsFromTaskMemory: 0,
      stepsFromCapabilities: 0,
      stepsRequiringAi: 1,
      estimatedTokenSaving: 0
    }
  }

  // Build steps for each substep
  const steps: CompositeTaskStep[] = substeps.map((substep, idx) =>
    buildStepFromInput(substep, idx + 1, tenantId)
  )

  // Force OpenClaw if requested
  if (forceOpenClaw) {
    steps.forEach(s => {
      s.type = 'openclaw'
      s.requiresAi = true
      s.taskPatternId = undefined
    })
  }

  // Calculate metrics
  const stepsFromTaskMemory = steps.filter(s => s.type === 'task_memory').length
  const stepsFromCapabilities = steps.filter(s => s.type === 'capability').length
  const stepsRequiringAi = steps.filter(s => s.requiresAi).length
  const totalDuration = calculateTotalDuration(steps)
  const tokenSaving = (stepsFromTaskMemory + stepsFromCapabilities) * 500

  // Calculate confidence
  const confidence = calculatePlanConfidence(steps)

  // Build plan
  const plan: CompositeExecutionPlan = {
    id: generatePlanId(),
    tenantId,
    userId,
    sourceInput: userInput,
    steps,
    confidence,
    estimatedDurationMs: totalDuration,
    requiresAi: stepsRequiringAi > 0,
    tokenSavingEstimate: tokenSaving,
    reusedPatternIds: steps
      .filter(s => s.taskPatternId)
      .map(s => s.taskPatternId!),
    reusedCapabilityKeys: steps
      .filter(s => s.capabilityKey)
      .map(s => s.capabilityKey!),
    skippableSteps: [],
    createdAt: new Date().toISOString()
  }

  // Check for skippable steps
  if (!skipOptimization) {
    for (const step of plan.steps) {
      const precondition = checkStepPreconditions(step, tenantId)
      if (precondition.shouldSkip) {
        plan.skippableSteps.push(step.stepId)
      }
    }
  }

  console.log(`[CompositePlanner] Built plan with ${steps.length} steps: ${stepsFromTaskMemory} task-memory, ${stepsFromCapabilities} capability, ${stepsRequiringAi} openclaw`)

  // P6.17R: Check capability readiness for ALL steps with capability keys
  // This ensures multistep plans also get blocked if capabilities are not available
  // Using CapabilityReadinessSummary to match BuildCompositePlanResult types
  const capabilityReadinessResults: CapabilityReadinessSummary[] = []
  const blockingCapabilities: CapabilityReadinessSummary[] = []

  for (const step of steps) {
    if (step.capabilityKey) {
      const readiness = getCapabilityReadiness(step.capabilityKey, tenantId)
      const summary: CapabilityReadinessSummary = {
        capability: readiness.capability as string,
        capabilityKey: step.capabilityKey,
        available: readiness.available,
        implemented: readiness.implemented,
        configured: readiness.configured,
        statusMessage: readiness.statusMessage,
        reason: readiness.statusMessage // Alias for compatibility
      }
      capabilityReadinessResults.push(summary)

      if (!readiness.available) {
        blockingCapabilities.push(summary)
      }
    }
  }

  if (blockingCapabilities.length > 0) {
    console.log(`[CompositePlanner P6.17R] Multistep plan has ${blockingCapabilities.length} blocking capabilities: ${blockingCapabilities.map(c => c.capabilityKey || c.capability).join(', ')}`)
  }

  return {
    found: true,
    plan,
    reason: `Plan compuesto creado (${steps.length} pasos)`,
    confidence,
    stepsFromTaskMemory,
    stepsFromCapabilities,
    stepsRequiringAi,
    estimatedTokenSaving: tokenSaving,
    // P6.17R: Include capability readiness for multistep plans
    capabilityReadiness: capabilityReadinessResults.length > 0 ? capabilityReadinessResults : undefined,
    blockingCapabilities: blockingCapabilities.length > 0 ? blockingCapabilities : undefined
  }
}

/**
 * Calculate total duration from steps
 */
function calculateTotalDuration(steps: CompositeTaskStep[]): number {
  return steps.reduce((sum, s) => sum + (s.estimatedDurationMs || 5000), 0)
}

/**
 * Calculate plan confidence based on step sources
 */
function calculatePlanConfidence(steps: CompositeTaskStep[]): number {
  if (steps.length === 0) return 0

  // Each task_memory step = 1.0, capability = 0.9, openclaw = 0.7
  const weights: Record<string, number> = {
    'task_memory': 1.0,
    'capability': 0.9,
    'openclaw': 0.7,
    'manual': 0.5
  }

  const totalConfidence = steps.reduce((sum, s) => sum + (weights[s.type] || 0.5), 0)
  return totalConfidence / steps.length
}

/**
 * Check if input is a composite task candidate
 * P6.14: Also returns true for single capability-backed actions
 */
export function isCompositeCandidate(input: string): boolean {
  // Check for split patterns
  for (const pattern of SPLIT_PATTERNS) {
    if (pattern.test(input)) {
      return true
    }
  }

  // Check for action chains
  const lower = input.toLowerCase()
  for (const pattern of Object.keys(ACTION_CHAINS)) {
    if (lower.includes(pattern)) {
      return true
    }
  }

  // P6.14: Check for single capability-backed actions
  const singleAction = detectSingleAction(input)
  if (singleAction) {
    return true
  }

  return false
}
