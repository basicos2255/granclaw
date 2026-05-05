/**
 * Status Resolver
 * FIX 124: Final Execution Status Resolution
 *
 * Resolves the final execution status based on hub decision,
 * execution outcome, and various error conditions.
 *
 * Priority order:
 * 1. Hub blocked -> blocked
 * 2. Pending confirmation -> pending_confirmation
 * 3. Requires setup -> setup_required
 * 4. Requires reauth -> reauthorization_required
 * 5. Execution failed -> failed
 * 6. Execution confirmed -> executed
 * 7. Hub allowed (no execution needed) -> allowed
 * 8. Partial -> partial
 */

import type {
  HubDecisionStatus,
  ExecutionStatus,
  FinalUiStatus,
  StatusSeverity,
  ResolvedExecutionStatus,
  StatusResolverInput
} from './types'

/**
 * UI labels for each status
 */
const STATUS_LABELS: Record<FinalUiStatus, { title: string; defaultMessage: string }> = {
  blocked: {
    title: 'BLOQUEADO',
    defaultMessage: 'La acción fue bloqueada por la política de seguridad.'
  },
  pending_confirmation: {
    title: 'CONFIRMACIÓN REQUERIDA',
    defaultMessage: 'Se requiere confirmación del usuario para completar esta acción.'
  },
  setup_required: {
    title: 'CONFIGURACIÓN REQUERIDA',
    defaultMessage: 'OpenClaw necesita permisos adicionales antes de completar esta acción.'
  },
  reauthorization_required: {
    title: 'REAUTORIZACIÓN REQUERIDA',
    defaultMessage: 'OpenClaw necesita permisos adicionales antes de completar esta acción.'
  },
  failed: {
    title: 'ERROR DE EJECUCIÓN',
    defaultMessage: 'La ejecución falló con un error.'
  },
  partial: {
    title: 'EJECUCIÓN PARCIAL',
    defaultMessage: 'La acción se completó parcialmente.'
  },
  executed: {
    title: 'EJECUTADO',
    defaultMessage: 'La acción se ejecutó correctamente.'
  },
  allowed: {
    title: 'PERMITIDO',
    defaultMessage: 'La acción fue permitida por la política.'
  }
}

/**
 * Severity mapping for each status
 */
const STATUS_SEVERITY: Record<FinalUiStatus, StatusSeverity> = {
  blocked: 'error',
  pending_confirmation: 'warning',
  setup_required: 'warning',
  reauthorization_required: 'warning',
  failed: 'error',
  partial: 'warning',
  executed: 'success',
  allowed: 'success'
}

/**
 * Check if result indicates setup_required
 */
function checkSetupRequired(input: StatusResolverInput): boolean {
  if (input.meta?.requiresSetup) return true
  if (input.executionStatus === 'setup_required') return true
  if (input.source === 'setup-required') return true

  // Check result for setup_required markers
  const result = input.result as Record<string, unknown> | undefined
  if (result?.executionStatus === 'setup_required') return true

  return false
}

/**
 * Check if result indicates reauth_required
 */
function checkReauthRequired(input: StatusResolverInput): boolean {
  if (input.meta?.requiresReauth) return true
  if (input.executionStatus === 'reauthorization_required') return true

  // Check error text for reauth patterns
  const errorText = input.error?.toLowerCase() || ''
  if (errorText.includes('pairing required') ||
      errorText.includes('authorization required') ||
      errorText.includes('more scopes') ||
      errorText.includes('permission denied')) {
    return true
  }

  // Check result for reauth markers
  const result = input.result as Record<string, unknown> | undefined
  if (result?.requiresReauth) return true

  return false
}

/**
 * Check if pending confirmation
 */
function checkPendingConfirmation(input: StatusResolverInput): boolean {
  if (input.meta?.pendingConfirmation) return true
  if (input.executionStatus === 'pending_confirmation') return true

  const result = input.result as Record<string, unknown> | undefined
  if (result?.pendingConfirmation) return true
  if (result?.confirmationRequired) return true

  return false
}

/**
 * Check if execution was confirmed
 */
function checkExecutionConfirmed(input: StatusResolverInput): boolean {
  // Explicit confirmation in meta
  if (input.meta?.executionConfirmed === true) return true
  if (input.debugSnapshot?.executionConfirmed === true) return true

  // Check result
  const result = input.result as Record<string, unknown> | undefined
  if (result?.executionConfirmed === true) return true

  // Success without explicit confirmation might still be executed
  // but we're strict - only confirm if explicitly marked
  return false
}

/**
 * Check if execution failed
 */
function checkFailed(input: StatusResolverInput): boolean {
  if (input.error && !checkSetupRequired(input) && !checkReauthRequired(input)) {
    return true
  }
  if (input.debugSnapshot?.error && !checkSetupRequired(input) && !checkReauthRequired(input)) {
    return true
  }

  const result = input.result as Record<string, unknown> | undefined
  if (result?.success === false && result?.error && !checkSetupRequired(input) && !checkReauthRequired(input)) {
    return true
  }

  return false
}

/**
 * Resolve the final execution status
 */
export function resolveFinalExecutionStatus(input: StatusResolverInput): ResolvedExecutionStatus {
  // Determine hub decision
  const hubDecision: HubDecisionStatus = input.hubBlocked ? 'blocked' : 'allowed'

  // Start with defaults
  let executionStatus: ExecutionStatus = 'not_started'
  let finalUiStatus: FinalUiStatus = 'allowed'
  let executionConfirmed = false
  let isSuccess = false
  let reason = 'No execution performed'

  // Priority 1: Hub blocked
  if (input.hubBlocked) {
    return {
      hubDecision: 'blocked',
      executionStatus: 'skipped',
      finalUiStatus: 'blocked',
      executionConfirmed: false,
      isSuccess: false,
      severity: 'error',
      title: STATUS_LABELS.blocked.title,
      message: input.hubReason || STATUS_LABELS.blocked.defaultMessage,
      reason: input.hubReason || 'Blocked by security policy'
    }
  }

  // Priority 2: Pending confirmation
  if (checkPendingConfirmation(input)) {
    return {
      hubDecision,
      executionStatus: 'pending_confirmation',
      finalUiStatus: 'pending_confirmation',
      executionConfirmed: false,
      isSuccess: false,
      severity: 'warning',
      title: STATUS_LABELS.pending_confirmation.title,
      message: STATUS_LABELS.pending_confirmation.defaultMessage,
      reason: 'Awaiting user confirmation'
    }
  }

  // Priority 3: Setup required
  if (checkSetupRequired(input)) {
    return {
      hubDecision,
      executionStatus: 'setup_required',
      finalUiStatus: 'setup_required',
      executionConfirmed: false,
      isSuccess: false,
      severity: 'warning',
      title: STATUS_LABELS.setup_required.title,
      message: STATUS_LABELS.setup_required.defaultMessage,
      reason: 'OpenClaw setup/pairing required'
    }
  }

  // Priority 4: Reauth required
  if (checkReauthRequired(input)) {
    return {
      hubDecision,
      executionStatus: 'reauthorization_required',
      finalUiStatus: 'reauthorization_required',
      executionConfirmed: false,
      isSuccess: false,
      severity: 'warning',
      title: STATUS_LABELS.reauthorization_required.title,
      message: input.error || STATUS_LABELS.reauthorization_required.defaultMessage,
      reason: 'OpenClaw reauthorization required'
    }
  }

  // Priority 5: Failed
  if (checkFailed(input)) {
    const errorMsg = input.error || input.debugSnapshot?.error || 'Execution failed'
    return {
      hubDecision,
      executionStatus: 'failed',
      finalUiStatus: 'failed',
      executionConfirmed: false,
      isSuccess: false,
      severity: 'error',
      title: STATUS_LABELS.failed.title,
      message: errorMsg,
      reason: errorMsg
    }
  }

  // Priority 6: Execution confirmed
  if (checkExecutionConfirmed(input)) {
    const result = input.result as Record<string, unknown> | undefined
    return {
      hubDecision,
      executionStatus: 'executed',
      finalUiStatus: 'executed',
      executionConfirmed: true,
      isSuccess: true,
      severity: 'success',
      title: STATUS_LABELS.executed.title,
      message: (result?.message as string) || STATUS_LABELS.executed.defaultMessage,
      reason: 'Execution completed successfully'
    }
  }

  // Priority 7: Hub allowed (no execution needed or simple response)
  // This is for cases like simple questions that don't need OS execution
  const result = input.result as Record<string, unknown> | undefined
  if (input.hubAllowed && result?.success !== false) {
    // Check if there was actually a result
    const hasResult = result?.result !== undefined || result?.message !== undefined
    if (hasResult) {
      return {
        hubDecision,
        executionStatus: 'executed',
        finalUiStatus: 'executed',
        executionConfirmed: true,
        isSuccess: true,
        severity: 'success',
        title: STATUS_LABELS.executed.title,
        message: STATUS_LABELS.executed.defaultMessage,
        reason: 'Action completed'
      }
    }

    return {
      hubDecision,
      executionStatus: 'not_started',
      finalUiStatus: 'allowed',
      executionConfirmed: false,
      isSuccess: true,
      severity: 'success',
      title: STATUS_LABELS.allowed.title,
      message: STATUS_LABELS.allowed.defaultMessage,
      reason: 'Action allowed by policy'
    }
  }

  // Default: not started
  return {
    hubDecision,
    executionStatus,
    finalUiStatus,
    executionConfirmed,
    isSuccess,
    severity: 'info',
    title: STATUS_LABELS.allowed.title,
    message: STATUS_LABELS.allowed.defaultMessage,
    reason
  }
}

/**
 * Get severity for a final UI status
 */
export function getSeverityForStatus(status: FinalUiStatus): StatusSeverity {
  return STATUS_SEVERITY[status] || 'info'
}

/**
 * Get label for a final UI status
 */
export function getLabelForStatus(status: FinalUiStatus): { title: string; defaultMessage: string } {
  return STATUS_LABELS[status] || STATUS_LABELS.allowed
}
