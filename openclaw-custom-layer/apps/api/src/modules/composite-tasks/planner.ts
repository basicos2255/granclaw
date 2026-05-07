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
  type CompositeStepType
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
import { getEnabledCapabilityByKey, normalizeCapabilityKey } from '../capabilities'

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

  // If only one substep and no chain, not a composite
  if (substeps.length <= 1 && !actionChain) {
    return {
      found: false,
      reason: 'Input es tarea simple, no composite',
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

  return {
    found: true,
    plan,
    reason: `Plan compuesto creado (${steps.length} pasos)`,
    confidence,
    stepsFromTaskMemory,
    stepsFromCapabilities,
    stepsRequiringAi,
    estimatedTokenSaving: tokenSaving
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

  return false
}
