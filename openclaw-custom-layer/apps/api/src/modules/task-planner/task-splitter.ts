/**
 * Task Splitter
 * FIX 126: Timeout Recovery & Multistep Task Execution
 *
 * Analyzes user input and splits complex tasks into executable steps.
 */

import type { TaskStep, SplitTaskResult, SplitTaskInput, MultistepPattern } from './types'
import { v4 as uuidv4 } from 'uuid'

/**
 * Connector words that indicate multistep operations
 */
const CONNECTOR_WORDS = [
  ' y ',
  ' e ',
  ' luego ',
  ' después ',
  ' then ',
  ' and then ',
  ' after that ',
  ' seguido de ',
  ' posteriormente ',
  ', después ',
  ', luego '
]

/**
 * Patterns that suggest multistep operations
 */
const MULTISTEP_PATTERNS: MultistepPattern[] = [
  {
    name: 'download_and_install',
    pattern: /descarga(?:r)?\s+(.+?)\s+(?:y|e)\s+(?:instala(?:r|lo)?|ejecuta(?:r|lo)?)/i,
    connectors: [' y ', ' e '],
    example: 'descarga vlc y instálalo'
  },
  {
    name: 'download_install_open',
    pattern: /descarga(?:r)?\s+(.+?)\s+(?:y|e)\s+(?:instala(?:r|lo)?).+?(?:y|e)\s+(?:abre|ejecuta)/i,
    connectors: [' y ', ' e '],
    example: 'descarga vlc, instálalo y ábrelo'
  },
  {
    name: 'open_and_do',
    pattern: /abre?\s+(.+?)\s+(?:y|e)\s+(.+)/i,
    connectors: [' y ', ' e '],
    example: 'abre chrome y busca algo'
  },
  {
    name: 'create_and_open',
    pattern: /crea(?:r)?\s+(.+?)\s+(?:y|e)\s+(?:abre|ejecuta)/i,
    connectors: [' y ', ' e '],
    example: 'crea un documento y ábrelo'
  },
  {
    name: 'install_and_configure',
    pattern: /instala(?:r)?\s+(.+?)\s+(?:y|e)\s+(?:configura|ajusta)/i,
    connectors: [' y ', ' e '],
    example: 'instala nodejs y configura el path'
  }
]

/**
 * Duration estimates for different operation types
 */
const DURATION_ESTIMATES: Record<string, 'quick' | 'medium' | 'long'> = {
  open: 'quick',
  abre: 'quick',
  abrir: 'quick',
  close: 'quick',
  cierra: 'quick',
  cerrar: 'quick',
  download: 'long',
  descarga: 'long',
  descargar: 'long',
  install: 'long',
  instala: 'long',
  instalar: 'long',
  update: 'long',
  actualiza: 'long',
  actualizar: 'long',
  copy: 'medium',
  copia: 'medium',
  copiar: 'medium',
  move: 'medium',
  mueve: 'medium',
  mover: 'medium',
  create: 'quick',
  crea: 'quick',
  crear: 'quick',
  delete: 'quick',
  elimina: 'quick',
  eliminar: 'quick',
  search: 'medium',
  busca: 'medium',
  buscar: 'medium'
}

/**
 * Check if input contains multistep connectors
 */
function hasMultistepConnectors(input: string): boolean {
  const normalized = input.toLowerCase()
  return CONNECTOR_WORDS.some(connector => normalized.includes(connector))
}

/**
 * Extract verb from a phrase
 */
function extractVerb(phrase: string): string {
  const words = phrase.trim().split(/\s+/)
  return words[0]?.toLowerCase() || ''
}

/**
 * Estimate duration for a step based on its verb
 */
function estimateDuration(input: string): 'quick' | 'medium' | 'long' {
  const verb = extractVerb(input)
  return DURATION_ESTIMATES[verb] || 'medium'
}

/**
 * Split input by connectors into separate steps
 */
function splitByConnectors(input: string): string[] {
  let parts: string[] = [input]

  for (const connector of CONNECTOR_WORDS) {
    const newParts: string[] = []
    for (const part of parts) {
      const subParts = part.toLowerCase().includes(connector.toLowerCase())
        ? part.split(new RegExp(connector, 'i'))
        : [part]
      newParts.push(...subParts)
    }
    parts = newParts
  }

  return parts
    .map(p => p.trim())
    .filter(p => p.length > 0)
}

/**
 * Clean up a step description
 */
function cleanStepDescription(step: string, index: number): string {
  // Remove leading connectors
  let cleaned = step.replace(/^(y|e|luego|después|then|and then)\s+/i, '')

  // Capitalize first letter
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)

  return cleaned
}

/**
 * Create a TaskStep from a description
 */
function createStep(
  description: string,
  order: number,
  dependsOnPrevious: boolean
): TaskStep {
  const input = description.charAt(0).toLowerCase() + description.slice(1)

  return {
    id: uuidv4(),
    order,
    description,
    input,
    status: 'pending',
    dependsOnPrevious,
    estimatedDuration: estimateDuration(input)
  }
}

/**
 * Split a complex task into individual steps
 */
export function splitIntoSteps(params: SplitTaskInput): SplitTaskResult {
  const { input } = params

  // Check if input has multistep patterns
  if (!hasMultistepConnectors(input)) {
    return {
      isSplittable: false,
      originalInput: input,
      steps: [],
      totalDuration: estimateDuration(input),
      reason: 'Input does not contain multistep connectors'
    }
  }

  // Split by connectors
  const rawSteps = splitByConnectors(input)

  // Need at least 2 steps to be multistep
  if (rawSteps.length < 2) {
    return {
      isSplittable: false,
      originalInput: input,
      steps: [],
      totalDuration: estimateDuration(input),
      reason: 'Only one step detected after splitting'
    }
  }

  // Create TaskStep objects
  const steps: TaskStep[] = rawSteps.map((raw, index) => {
    const description = cleanStepDescription(raw, index)
    // First step doesn't depend on previous, others might
    const dependsOnPrevious = index > 0
    return createStep(description, index + 1, dependsOnPrevious)
  })

  // Calculate total duration
  const hasSlow = steps.some(s => s.estimatedDuration === 'long')
  const hasMedium = steps.some(s => s.estimatedDuration === 'medium')
  const totalDuration: 'quick' | 'medium' | 'long' = hasSlow
    ? 'long'
    : hasMedium
      ? 'medium'
      : 'quick'

  return {
    isSplittable: true,
    originalInput: input,
    steps,
    totalDuration,
    reason: `Split into ${steps.length} steps`
  }
}

/**
 * Check if input matches known multistep patterns
 */
export function matchMultistepPattern(input: string): MultistepPattern | null {
  for (const pattern of MULTISTEP_PATTERNS) {
    if (pattern.pattern.test(input)) {
      return pattern
    }
  }
  return null
}

/**
 * Analyze input and suggest recovery steps after timeout
 */
export function suggestRecoverySteps(
  originalInput: string,
  error?: string
): TaskStep[] {
  // Try to split the original input
  const splitResult = splitIntoSteps({ input: originalInput, tenantId: '' })

  if (splitResult.isSplittable) {
    return splitResult.steps
  }

  // If not splittable, create a single retry step
  return [
    createStep(
      originalInput.charAt(0).toUpperCase() + originalInput.slice(1),
      1,
      false
    )
  ]
}

/**
 * Get human-readable step summary
 */
export function getStepsSummary(steps: TaskStep[]): string {
  if (steps.length === 0) return 'Sin pasos'
  if (steps.length === 1) return steps[0].description

  const descriptions = steps.map((s, i) => `${i + 1}. ${s.description}`)
  return descriptions.join('\n')
}

/**
 * Check if all steps are completed
 */
export function allStepsCompleted(steps: TaskStep[]): boolean {
  return steps.every(s => s.status === 'completed' || s.status === 'skipped')
}

/**
 * Get next pending step
 */
export function getNextPendingStep(steps: TaskStep[]): TaskStep | null {
  return steps.find(s => s.status === 'pending') || null
}

/**
 * Update step status
 */
export function updateStepStatus(
  steps: TaskStep[],
  stepId: string,
  status: TaskStep['status'],
  result?: unknown,
  error?: string
): TaskStep[] {
  return steps.map(s =>
    s.id === stepId
      ? { ...s, status, result, error }
      : s
  )
}
