/**
 * Artifact Checks
 * FEATURE 130.3: Validated Workflows & Artifact Verification
 *
 * Unified interface for running artifact validations based on action type.
 */

import type {
  ValidationResult,
  ValidationType,
  StepValidation,
  StepValidationResult,
  WorkflowArtifact,
  ValidationPolicy
} from './types'
import {
  ACTION_VALIDATION_MAP,
  DEFAULT_VALIDATION_POLICY
} from './types'
import {
  validateDownloadedFile,
  validateInstalledApplication,
  validateOpenedApplication,
  validateUrlReachable,
  validateFileExists,
  validateDirectoryExists
} from './validators'
import type { TaskActionType } from '../task-memory/types'

/**
 * Determine validation requirements for an action type
 */
export function getValidationForAction(
  actionType: TaskActionType,
  targetEntity?: string
): StepValidation {
  const validationType = ACTION_VALIDATION_MAP[actionType]

  // Default: no validation required for unknown actions
  if (!validationType) {
    return {
      required: false,
      type: 'custom',
      critical: false
    }
  }

  // Determine if validation is critical
  const criticalActions: TaskActionType[] = [
    'download_file',
    'install_app',
    'uninstall_app'
  ]

  return {
    required: true,
    type: validationType,
    target: targetEntity,
    critical: criticalActions.includes(actionType),
    timeout: 10000,
    retryCount: 2,
    retryDelayMs: 1000
  }
}

/**
 * Run validation for a specific type
 */
export async function runValidation(
  validationType: ValidationType,
  target: string,
  options?: {
    timeout?: number
    platform?: string
    expectNegative?: boolean  // For uninstall/close - expect NOT to find
  }
): Promise<ValidationResult> {
  switch (validationType) {
    case 'file_downloaded':
      return await validateDownloadedFile(target, {
        downloadPath: options?.platform
      })

    case 'app_installed': {
      const result = await validateInstalledApplication(target, {
        platform: options?.platform
      })
      // For uninstall, invert the result
      if (options?.expectNegative) {
        return {
          ...result,
          ok: !result.ok,
          reason: result.ok
            ? `Aplicación aún instalada: ${target}`
            : `Aplicación desinstalada correctamente: ${target}`
        }
      }
      return result
    }

    case 'app_opened':
    case 'process_running': {
      const result = await validateOpenedApplication(target, {
        platform: options?.platform,
        timeout: options?.timeout
      })
      // For close, invert the result
      if (options?.expectNegative) {
        return {
          ...result,
          ok: !result.ok,
          reason: result.ok
            ? `Proceso aún activo: ${target}`
            : `Proceso cerrado correctamente: ${target}`
        }
      }
      return result
    }

    case 'url_reachable':
      return await validateUrlReachable(target, {
        timeout: options?.timeout
      })

    case 'file_exists':
      return validateFileExists(target)

    case 'directory_exists':
      return validateDirectoryExists(target)

    case 'custom':
    default:
      return {
        ok: true,
        validationType: 'custom',
        reason: 'Validación no implementada',
        warnings: ['Tipo de validación no soportado'],
        evidence: [],
        checkedAt: new Date().toISOString()
      }
  }
}

/**
 * Run validation with retries
 */
export async function runValidationWithRetry(
  validationType: ValidationType,
  target: string,
  options?: {
    maxRetries?: number
    retryDelayMs?: number
    timeout?: number
    platform?: string
    expectNegative?: boolean
  }
): Promise<ValidationResult & { attempts: number }> {
  const maxRetries = options?.maxRetries || DEFAULT_VALIDATION_POLICY.maxRetries
  const retryDelayMs = options?.retryDelayMs || DEFAULT_VALIDATION_POLICY.retryDelayMs

  let lastResult: ValidationResult | null = null
  let attempts = 0

  for (let i = 0; i <= maxRetries; i++) {
    attempts = i + 1

    lastResult = await runValidation(validationType, target, options)

    if (lastResult.ok) {
      return { ...lastResult, attempts }
    }

    // Wait before retry (except on last attempt)
    if (i < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, retryDelayMs))
    }
  }

  return { ...lastResult!, attempts }
}

/**
 * Validate a workflow step
 */
export async function validateStep(
  stepId: string,
  stepOrder: number,
  actionType: TaskActionType,
  targetEntity: string | undefined,
  validation: StepValidation,
  policy: ValidationPolicy = DEFAULT_VALIDATION_POLICY
): Promise<StepValidationResult> {
  const target = validation.target || targetEntity || ''

  // Determine if this is a negative check (uninstall/close)
  const expectNegative = actionType === 'uninstall_app' || actionType === 'close_app'

  // Run validation with retries
  const result = await runValidationWithRetry(
    validation.type,
    target,
    {
      maxRetries: validation.retryCount || policy.maxRetries,
      retryDelayMs: validation.retryDelayMs || policy.retryDelayMs,
      timeout: validation.timeout || policy.validationTimeout,
      expectNegative
    }
  )

  return {
    ...result,
    stepId,
    stepOrder,
    actionType,
    targetEntity,
    validationAttempts: result.attempts
  }
}

/**
 * Create artifact from validation result
 */
export function createArtifactFromValidation(
  result: StepValidationResult
): WorkflowArtifact {
  return {
    type: result.artifactType || 'file',
    target: result.target || result.targetEntity || '',
    exists: result.ok,
    verified: result.ok,
    verifiedAt: result.checkedAt,
    metadata: {
      validationType: result.validationType,
      evidence: result.evidence,
      warnings: result.warnings,
      attempts: result.validationAttempts
    }
  }
}

/**
 * Check if workflow can be learned based on validations
 */
export function canLearnWorkflow(
  validationResults: StepValidationResult[],
  policy: ValidationPolicy = DEFAULT_VALIDATION_POLICY
): { canLearn: boolean; reason: string } {
  if (!policy.learnOnlyFullyValidated) {
    return { canLearn: true, reason: 'Política permite aprender sin validación completa' }
  }

  const failedCritical = validationResults.filter(r =>
    !r.ok && r.validationAttempts > 0  // Only count actual validation attempts
  )

  if (failedCritical.length > 0) {
    return {
      canLearn: false,
      reason: `Validaciones fallidas: ${failedCritical.map(r => `${r.actionType}:${r.targetEntity}`).join(', ')}`
    }
  }

  const hasWarnings = validationResults.some(r => r.warnings.length > 0)
  if (hasWarnings && policy.strictMode) {
    return {
      canLearn: false,
      reason: 'Warnings encontrados en modo estricto'
    }
  }

  return { canLearn: true, reason: 'Todas las validaciones pasaron' }
}

/**
 * Summarize validation results for a workflow
 */
export function summarizeValidations(
  workflowId: string,
  planId: string,
  results: StepValidationResult[],
  policy: ValidationPolicy = DEFAULT_VALIDATION_POLICY
): {
  totalSteps: number
  validatedSteps: number
  failedValidations: number
  skippedValidations: number
  warnings: string[]
  criticalFailures: StepValidationResult[]
  allValid: boolean
  canLearn: boolean
  reason: string
} {
  const validatedSteps = results.filter(r => r.ok).length
  const failedValidations = results.filter(r => !r.ok && r.validationAttempts > 0).length
  const skippedValidations = results.filter(r => r.validationAttempts === 0).length

  const allWarnings: string[] = []
  results.forEach(r => allWarnings.push(...r.warnings))

  const criticalFailures = results.filter(r => !r.ok)

  const allValid = failedValidations === 0
  const { canLearn, reason } = canLearnWorkflow(results, policy)

  return {
    totalSteps: results.length,
    validatedSteps,
    failedValidations,
    skippedValidations,
    warnings: allWarnings,
    criticalFailures,
    allValid,
    canLearn,
    reason
  }
}
