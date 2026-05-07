/**
 * Workflow Validation Service
 * FEATURE 130.3: Validated Workflows & Artifact Verification
 *
 * Core service for workflow validation, policy management, and integration.
 */

import type {
  ValidationResult,
  StepValidation,
  StepValidationResult,
  WorkflowArtifact,
  ValidationPolicy,
  WorkflowValidationSummary,
  WorkflowValidationDebugInfo
} from './types'
import { DEFAULT_VALIDATION_POLICY } from './types'
import {
  getValidationForAction,
  validateStep,
  createArtifactFromValidation,
  canLearnWorkflow,
  summarizeValidations
} from './artifact-checks'
import type { TaskActionType } from '../task-memory/types'

/**
 * In-memory policy storage (per tenant)
 */
const tenantPolicies: Map<string, ValidationPolicy> = new Map()

/**
 * Get validation policy for tenant
 */
export function getValidationPolicy(tenantId: string): ValidationPolicy {
  return tenantPolicies.get(tenantId) || { ...DEFAULT_VALIDATION_POLICY }
}

/**
 * Set validation policy for tenant
 */
export function setValidationPolicy(tenantId: string, policy: Partial<ValidationPolicy>): ValidationPolicy {
  const current = getValidationPolicy(tenantId)
  const updated = { ...current, ...policy }
  tenantPolicies.set(tenantId, updated)
  console.log(`[WorkflowValidation] Policy updated for tenant ${tenantId}:`, updated)
  return updated
}

/**
 * Reset validation policy to defaults
 */
export function resetValidationPolicy(tenantId: string): ValidationPolicy {
  tenantPolicies.delete(tenantId)
  console.log(`[WorkflowValidation] Policy reset for tenant ${tenantId}`)
  return { ...DEFAULT_VALIDATION_POLICY }
}

/**
 * Validate a single step and return full result
 */
export async function validateWorkflowStep(
  stepId: string,
  stepOrder: number,
  actionType: TaskActionType,
  targetEntity: string | undefined,
  tenantId: string,
  customValidation?: StepValidation
): Promise<StepValidationResult> {
  const policy = getValidationPolicy(tenantId)

  // Get validation requirements for action
  const validation = customValidation || getValidationForAction(actionType, targetEntity)

  // If no validation required, return success
  if (!validation.required) {
    return {
      ok: true,
      validationType: validation.type,
      reason: 'Validación no requerida para este tipo de acción',
      warnings: [],
      evidence: [],
      checkedAt: new Date().toISOString(),
      stepId,
      stepOrder,
      actionType,
      targetEntity,
      validationAttempts: 0
    }
  }

  console.log(`[WorkflowValidation] Validating step ${stepId}: ${actionType}:${targetEntity || 'unknown'}`)

  // Run validation
  const result = await validateStep(
    stepId,
    stepOrder,
    actionType,
    targetEntity,
    validation,
    policy
  )

  console.log(`[WorkflowValidation] Step ${stepId} validation: ${result.ok ? 'OK' : 'FAILED'} (${result.validationAttempts} attempts)`)
  if (result.warnings.length > 0) {
    console.log(`[WorkflowValidation] Warnings: ${result.warnings.join(', ')}`)
  }

  return result
}

/**
 * Validate entire workflow steps
 */
export async function validateWorkflowSteps(
  workflowId: string,
  planId: string,
  steps: Array<{
    stepId: string
    order: number
    actionType: TaskActionType
    targetEntity?: string
    validation?: StepValidation
  }>,
  tenantId: string
): Promise<{
  results: StepValidationResult[]
  summary: WorkflowValidationSummary
  artifacts: WorkflowArtifact[]
  debugInfo: WorkflowValidationDebugInfo
}> {
  const policy = getValidationPolicy(tenantId)
  const results: StepValidationResult[] = []
  const artifacts: WorkflowArtifact[] = []

  for (const step of steps) {
    const result = await validateWorkflowStep(
      step.stepId,
      step.order,
      step.actionType,
      step.targetEntity,
      tenantId,
      step.validation
    )

    results.push(result)

    // Create artifact from validation
    if (result.validationAttempts > 0) {
      artifacts.push(createArtifactFromValidation(result))
    }

    // Check if we should stop on critical failure
    if (!result.ok && policy.strictMode) {
      const stepValidation = step.validation || getValidationForAction(step.actionType, step.targetEntity)
      if (stepValidation.critical) {
        console.log(`[WorkflowValidation] Critical validation failed at step ${step.stepId}, stopping`)
        break
      }
    }
  }

  // Create summary
  const summaryData = summarizeValidations(workflowId, planId, results, policy)
  const summary: WorkflowValidationSummary = {
    workflowId,
    planId,
    ...summaryData
  }

  // Create debug info
  const debugInfo: WorkflowValidationDebugInfo = {
    validationEnabled: true,
    validatedArtifacts: artifacts.filter(a => a.verified),
    failedArtifacts: artifacts.filter(a => !a.verified),
    validationResults: results,
    warnings: summaryData.warnings,
    workflowLearned: false,  // Will be set by caller
    learnRejectedReason: summary.canLearn ? undefined : summary.reason
  }

  return { results, summary, artifacts, debugInfo }
}

/**
 * Check if workflow should be learned based on validation results
 */
export function shouldLearnWorkflow(
  results: StepValidationResult[],
  tenantId: string,
  additionalChecks?: {
    hasTimeout?: boolean
    hasPartial?: boolean
    hasSetupRequired?: boolean
    hasReauthRequired?: boolean
  }
): { shouldLearn: boolean; reason: string } {
  const policy = getValidationPolicy(tenantId)

  // Check additional failure conditions
  if (additionalChecks?.hasTimeout) {
    return { shouldLearn: false, reason: 'Workflow tuvo timeout' }
  }
  if (additionalChecks?.hasPartial) {
    return { shouldLearn: false, reason: 'Workflow tuvo ejecución parcial' }
  }
  if (additionalChecks?.hasSetupRequired) {
    return { shouldLearn: false, reason: 'Workflow requirió setup' }
  }
  if (additionalChecks?.hasReauthRequired) {
    return { shouldLearn: false, reason: 'Workflow requirió reautorización' }
  }

  // Check validation results
  const { canLearn, reason } = canLearnWorkflow(results, policy)

  return { shouldLearn: canLearn, reason }
}

/**
 * Update task memory confidence based on validation
 */
export function getConfidenceAdjustment(
  validationResult: StepValidationResult
): { delta: number; reason: string } {
  if (validationResult.ok) {
    // Increase confidence for validated steps
    return { delta: 0.05, reason: 'Validación exitosa' }
  } else if (validationResult.validationAttempts === 0) {
    // No change if validation wasn't attempted
    return { delta: 0, reason: 'Validación no intentada' }
  } else {
    // Decrease confidence for failed validations
    return { delta: -0.1, reason: 'Validación fallida' }
  }
}

/**
 * Determine step recovery options
 */
export function getRecoveryOptions(
  result: StepValidationResult,
  policy: ValidationPolicy
): {
  canRetry: boolean
  canFallback: boolean
  canSkip: boolean
  canCancel: boolean
  recommended: 'retry' | 'fallback' | 'skip' | 'cancel'
} {
  const canRetry = result.validationAttempts < (policy.maxRetries + 1) * 2
  const canFallback = true  // Always allow fallback to OpenClaw
  const canSkip = !policy.strictMode || policy.allowContinueWithWarnings
  const canCancel = true

  // Determine recommended action
  let recommended: 'retry' | 'fallback' | 'skip' | 'cancel' = 'retry'

  if (!canRetry) {
    recommended = 'fallback'
  }

  if (result.warnings.length > 0 && result.ok) {
    recommended = 'skip'  // Continue with warnings
  }

  return {
    canRetry,
    canFallback,
    canSkip,
    canCancel,
    recommended
  }
}

/**
 * Format validation result for UI display
 */
export function formatValidationForUI(result: StepValidationResult): {
  status: 'success' | 'warning' | 'error'
  icon: string
  message: string
  details: string[]
} {
  if (result.ok && result.warnings.length === 0) {
    return {
      status: 'success',
      icon: '✓',
      message: result.reason || 'Validación exitosa',
      details: result.evidence
    }
  }

  if (result.ok && result.warnings.length > 0) {
    return {
      status: 'warning',
      icon: '⚠',
      message: result.reason || 'Validación con advertencias',
      details: [...result.evidence, ...result.warnings.map(w => `⚠ ${w}`)]
    }
  }

  return {
    status: 'error',
    icon: '✗',
    message: result.reason || 'Validación fallida',
    details: [...result.warnings, ...result.evidence]
  }
}
