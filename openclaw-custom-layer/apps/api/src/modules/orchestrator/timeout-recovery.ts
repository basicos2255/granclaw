/**
 * Timeout Recovery
 * FIX 126: Timeout Recovery & Multistep Task Execution
 *
 * Handles timeout detection and recovery strategy generation.
 */

import type { TimeoutRecoveryResult, TaskStepInfo, RecoveryType } from './types'
import { splitIntoSteps, suggestRecoverySteps } from '../task-planner'

/**
 * Timeout error patterns to detect
 */
const TIMEOUT_PATTERNS = [
  'timeout',
  'request timeout',
  'timed out',
  'etimedout',
  'connection timeout',
  'socket timeout',
  'operation timed out',
  'deadline exceeded'
]

/**
 * Check if an error message indicates a timeout
 */
export function isTimeoutError(error?: string): boolean {
  if (!error) return false

  const errorLower = error.toLowerCase()
  return TIMEOUT_PATTERNS.some(pattern => errorLower.includes(pattern))
}

/**
 * Generate recovery strategy for a timed out task
 */
export function generateTimeoutRecovery(
  originalInput: string,
  error?: string,
  tenantId?: string
): TimeoutRecoveryResult {
  // Try to split the task into steps
  const splitResult = splitIntoSteps({
    input: originalInput,
    tenantId: tenantId || ''
  })

  if (splitResult.isSplittable) {
    // Task can be split - offer step-by-step execution
    const steps: TaskStepInfo[] = splitResult.steps.map(s => ({
      id: s.id,
      order: s.order,
      description: s.description,
      input: s.input,
      status: s.status,
      dependsOnPrevious: s.dependsOnPrevious,
      estimatedDuration: s.estimatedDuration
    }))

    return {
      recoveryType: 'timeout_recovery',
      originalInput,
      isSplittable: true,
      steps,
      reason: `La tarea se puede dividir en ${steps.length} pasos para ejecución más confiable.`,
      originalError: error,
      timeoutAt: new Date().toISOString()
    }
  }

  // Not splittable - offer simple retry
  const suggestedSteps = suggestRecoverySteps(originalInput, error)
  const steps: TaskStepInfo[] = suggestedSteps.map(s => ({
    id: s.id,
    order: s.order,
    description: s.description,
    input: s.input,
    status: s.status,
    dependsOnPrevious: s.dependsOnPrevious,
    estimatedDuration: s.estimatedDuration
  }))

  return {
    recoveryType: 'retry',
    originalInput,
    isSplittable: false,
    steps,
    reason: 'La tarea no es divisible. Se puede reintentar directamente.',
    originalError: error,
    timeoutAt: new Date().toISOString()
  }
}

/**
 * Format recovery steps for display
 */
export function formatRecoverySteps(steps: TaskStepInfo[]): string {
  if (steps.length === 0) return 'Sin pasos sugeridos'
  if (steps.length === 1) return `1. ${steps[0].description}`

  return steps.map(s => `${s.order}. ${s.description}`).join('\n')
}

/**
 * Get recovery action label
 */
export function getRecoveryActionLabel(recoveryType: RecoveryType): string {
  switch (recoveryType) {
    case 'timeout_recovery':
      return 'Ejecutar paso a paso'
    case 'retry':
      return 'Reintentar'
    case 'skip':
      return 'Omitir'
    case 'none':
    default:
      return 'Sin acción'
  }
}

/**
 * Get recovery description
 */
export function getRecoveryDescription(recoveryType: RecoveryType): string {
  switch (recoveryType) {
    case 'timeout_recovery':
      return 'La tarea excedió el tiempo límite. Se ha dividido en pasos más pequeños para una ejecución más confiable.'
    case 'retry':
      return 'La tarea excedió el tiempo límite. Puede reintentar la operación.'
    case 'skip':
      return 'La tarea se puede omitir si no es crítica.'
    case 'none':
    default:
      return 'No hay acciones de recuperación disponibles.'
  }
}
