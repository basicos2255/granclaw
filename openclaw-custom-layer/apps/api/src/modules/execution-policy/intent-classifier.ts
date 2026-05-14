/**
 * Intent Classifier
 * FIX 121: Authoritative Hybrid Router & Intent Classification
 * P6.9: Task Execution Mode Classification
 *
 * Classifies user intent BEFORE capability detection.
 * This prevents false positives like "descarga e instala" being classified as editor.
 */

import type { TaskExecutionMode, ExecutionModeResult } from './types'

export type IntentKind =
  | 'simple_question'
  | 'deterministic_action'
  | 'os_action'
  | 'file_action'
  | 'web_action'
  | 'install_download_action'
  | 'complex_agent_task'
  | 'analysis_task'
  | 'unknown'

export interface IntentClassification {
  kind: IntentKind
  confidence: 'low' | 'medium' | 'high'
  needsAi: boolean
  needsAgent: boolean
  isMultiStep: boolean
  isDeterministic: boolean
  reason: string
  signals: string[]
}

// Install/download patterns - HIGH PRIORITY, checked first
const INSTALL_DOWNLOAD_PATTERNS = [
  /\b(descarga|descargar|baja|bajar)\b/i,
  /\b(instala|instalar|instalador|installer)\b/i,
  /\b(setup|install|download)\b/i,
  /\b(actualiza|actualizar|update|upgrade)\b/i,
  /\b(npm\s+install|yarn\s+add|pip\s+install|brew\s+install|apt\s+install|choco\s+install)\b/i,
  /\b(package|paquete)\s+(manager|gestor)?\b/i,
  /\bejecutar?\s+(instalador|setup)\b/i
]

// Multi-step action patterns
const MULTISTEP_PATTERNS = [
  /\b(y\s+luego|e\s+instala|y\s+configura|y\s+ejecuta)\b/i,
  /\b(descarga\s+.+\s+e\s+instala)\b/i,
  /\b(busca\s+y\s+haz|busca\s+y\s+ejecuta)\b/i,
  /\b(crea\s+.+\s+y\s+.+)\b/i,
  /\b(configura\s+todo|prepara\s+todo|soluciona\s+esto)\b/i,
  /\b(revisa\s+y\s+corrige|investiga\s+y\s+ejecuta)\b/i,
  /\b(automatiza|automatizar)\b/i
]

// Complex agent task patterns
const COMPLEX_AGENT_PATTERNS = [
  /\b(crea\s+una?\s+web|crea\s+un?\s+proyecto|crea\s+una?\s+app)\b/i,
  /\b(desarrolla|implementa|programa)\b/i,
  /\b(configura\s+el\s+servidor|configura\s+el\s+sistema)\b/i,
  /\b(resuelve|soluciona|arregla)\s+.{10,}/i,
  /\b(optimiza|mejora|refactoriza)\b/i
]

// Analysis/reasoning patterns
const ANALYSIS_PATTERNS = [
  /\b(analiza|analizar|análisis)\b/i,
  /\b(compara|comparar|comparación)\b/i,
  /\b(decide|decidir|recomienda|recomendar)\b/i,
  /\b(investiga|investigar|audita|auditar)\b/i,
  /\b(diagnostica|diagnosticar|diagnóstico)\b/i,
  /\b(estrategia|informe|reporte)\b/i,
  /\b(evalúa|evaluar|evaluación)\b/i,
  /\b(explica\s+por\s+qué|explica\s+cómo)\b/i
]

// Simple deterministic OS actions - ONLY if no install/complex patterns
const DETERMINISTIC_OS_PATTERNS = [
  /^abre\s+(la\s+)?calculadora$/i,
  /^abre\s+(el\s+)?navegador$/i,
  /^abre\s+(el\s+)?editor(\s+de\s+texto)?$/i,
  /^abre\s+(el\s+)?explorador(\s+de\s+archivos)?$/i,
  /^abre\s+(la\s+)?terminal$/i,
  /^abre\s+notas?$/i,
  /^abre\s+(el\s+)?bloc\s+de\s+notas$/i
]

// Simple question patterns
const SIMPLE_QUESTION_PATTERNS = [
  /^(qué|cuál|cómo|cuánto|cuándo|dónde|quién)\s+/i,
  /^(dime|explica|resume|resumen)\s+/i,
  /\?$/
]

// Editor/note patterns - LOW PRIORITY, only if nothing else matches
const EDITOR_NOTE_PATTERNS = [
  /\b(crea\s+una?\s+nota|escribe\s+una?\s+nota)\b/i,
  /\b(abre\s+.*(editor|notas|bloc))\b/i,
  /\b(escribe\s+en\s+(un\s+)?archivo)\b/i
]

// Web action patterns
const WEB_ACTION_PATTERNS = [
  /\b(abre\s+.*(web|página|sitio|url|http))\b/i,
  /\b(navega\s+a|ve\s+a\s+la\s+web)\b/i,
  /\b(busca\s+en\s+(google|internet|web))\b/i
]

function matchesPatterns(message: string, patterns: RegExp[]): string[] {
  const matches: string[] = []
  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match) {
      matches.push(match[0])
    }
  }
  return matches
}

function hasInstallDownloadSignals(message: string): boolean {
  return INSTALL_DOWNLOAD_PATTERNS.some(p => p.test(message))
}

function hasMultiStepSignals(message: string): boolean {
  return MULTISTEP_PATTERNS.some(p => p.test(message))
}

function hasComplexAgentSignals(message: string): boolean {
  return COMPLEX_AGENT_PATTERNS.some(p => p.test(message))
}

function hasAnalysisSignals(message: string): boolean {
  return ANALYSIS_PATTERNS.some(p => p.test(message))
}

function isDeterministicOsAction(message: string): boolean {
  return DETERMINISTIC_OS_PATTERNS.some(p => p.test(message.trim()))
}

function isSimpleQuestion(message: string): boolean {
  return SIMPLE_QUESTION_PATTERNS.some(p => p.test(message.trim()))
}

/**
 * Classify user intent from message.
 * Priority order prevents false positives:
 * 1. install_download_action (highest - prevents editor false positives)
 * 2. complex_agent_task
 * 3. analysis_task
 * 4. deterministic_action (only exact matches)
 * 5. os_action / file_action / web_action
 * 6. simple_question
 * 7. unknown
 */
export function classifyIntent(message: string): IntentClassification {
  const signals: string[] = []
  const normalizedMessage = message.toLowerCase().trim()

  // 1. HIGHEST PRIORITY: Install/download actions
  // These MUST be detected first to prevent "descarga e instala" → editor
  const installSignals = matchesPatterns(normalizedMessage, INSTALL_DOWNLOAD_PATTERNS)
  const multiStepSignals = matchesPatterns(normalizedMessage, MULTISTEP_PATTERNS)

  if (installSignals.length > 0 || (hasInstallDownloadSignals(normalizedMessage) && hasMultiStepSignals(normalizedMessage))) {
    signals.push(...installSignals, ...multiStepSignals)
    return {
      kind: 'install_download_action',
      confidence: installSignals.length > 1 || multiStepSignals.length > 0 ? 'high' : 'medium',
      needsAi: true,
      needsAgent: true,
      isMultiStep: true,
      isDeterministic: false,
      reason: 'Install/download action requires agent orchestration',
      signals
    }
  }

  // 2. Complex agent tasks (multi-step without install)
  const complexSignals = matchesPatterns(normalizedMessage, COMPLEX_AGENT_PATTERNS)
  if (complexSignals.length > 0 || hasMultiStepSignals(normalizedMessage)) {
    signals.push(...complexSignals, ...multiStepSignals)
    return {
      kind: 'complex_agent_task',
      confidence: complexSignals.length > 0 ? 'high' : 'medium',
      needsAi: true,
      needsAgent: true,
      isMultiStep: true,
      isDeterministic: false,
      reason: 'Complex task requires agent reasoning',
      signals
    }
  }

  // 3. Analysis tasks
  const analysisSignals = matchesPatterns(normalizedMessage, ANALYSIS_PATTERNS)
  if (analysisSignals.length > 0) {
    signals.push(...analysisSignals)
    return {
      kind: 'analysis_task',
      confidence: 'high',
      needsAi: true,
      needsAgent: analysisSignals.length > 1,
      isMultiStep: false,
      isDeterministic: false,
      reason: 'Analysis requires AI reasoning',
      signals
    }
  }

  // 4. Deterministic OS actions (exact matches only)
  if (isDeterministicOsAction(normalizedMessage)) {
    return {
      kind: 'deterministic_action',
      confidence: 'high',
      needsAi: false,
      needsAgent: false,
      isMultiStep: false,
      isDeterministic: true,
      reason: 'Simple deterministic OS action',
      signals: [normalizedMessage]
    }
  }

  // 5. Web actions
  const webSignals = matchesPatterns(normalizedMessage, WEB_ACTION_PATTERNS)
  if (webSignals.length > 0) {
    signals.push(...webSignals)
    return {
      kind: 'web_action',
      confidence: 'medium',
      needsAi: false,
      needsAgent: false,
      isMultiStep: false,
      isDeterministic: true,
      reason: 'Web navigation action',
      signals
    }
  }

  // 6. Editor/note actions (only if no install/complex signals)
  const editorSignals = matchesPatterns(normalizedMessage, EDITOR_NOTE_PATTERNS)
  if (editorSignals.length > 0 && !hasInstallDownloadSignals(normalizedMessage)) {
    signals.push(...editorSignals)
    return {
      kind: 'file_action',
      confidence: 'medium',
      needsAi: false,
      needsAgent: false,
      isMultiStep: false,
      isDeterministic: true,
      reason: 'File/editor action',
      signals
    }
  }

  // 7. Simple questions
  if (isSimpleQuestion(normalizedMessage)) {
    return {
      kind: 'simple_question',
      confidence: 'medium',
      needsAi: true,
      needsAgent: false,
      isMultiStep: false,
      isDeterministic: false,
      reason: 'Question requires AI response',
      signals: ['question_pattern']
    }
  }

  // 8. OS action (generic "abre X")
  if (/^abre\s+/i.test(normalizedMessage)) {
    return {
      kind: 'os_action',
      confidence: 'low',
      needsAi: false,
      needsAgent: false,
      isMultiStep: false,
      isDeterministic: false, // Not deterministic if not in whitelist
      reason: 'Generic OS action - may need capability approval',
      signals: ['abre_pattern']
    }
  }

  // Default: unknown
  return {
    kind: 'unknown',
    confidence: 'low',
    needsAi: true,
    needsAgent: false,
    isMultiStep: false,
    isDeterministic: false,
    reason: 'Intent unclear - delegate to AI',
    signals: []
  }
}

/**
 * Check if intent should block capability detection from creating proposals.
 * Install/download/complex intents should NOT create local tool proposals.
 */
export function shouldBlockLocalProposal(intent: IntentClassification): boolean {
  return (
    intent.kind === 'install_download_action' ||
    intent.kind === 'complex_agent_task' ||
    intent.kind === 'analysis_task' ||
    (intent.isMultiStep && intent.needsAgent)
  )
}

/**
 * Check if intent forces OpenClaw delegation.
 */
export function requiresOpenClaw(intent: IntentClassification): boolean {
  return (
    intent.kind === 'install_download_action' ||
    intent.kind === 'complex_agent_task' ||
    intent.kind === 'analysis_task' ||
    intent.needsAgent
  )
}

/**
 * Intent kinds that MUST use queued workflow (queue/workers)
 * P6.9: These cannot be executed synchronously via runSimpleAgentTask
 */
const QUEUED_WORKFLOW_INTENTS: IntentKind[] = [
  'install_download_action',
  'complex_agent_task'
]

/**
 * Intent kinds that use agent workflow (streaming but not queued)
 */
const AGENT_WORKFLOW_INTENTS: IntentKind[] = [
  'analysis_task'
]

/**
 * Intent kinds that are simple completions (quick AI response)
 */
const SIMPLE_COMPLETION_INTENTS: IntentKind[] = [
  'simple_question'
]

/**
 * Classify execution mode from intent classification.
 * P6.9: Determines HOW the task should be executed.
 *
 * Priority:
 * 1. queued_workflow - for install/download/deploy, complex multi-step
 * 2. agent_workflow - for analysis tasks requiring reasoning but not queue
 * 3. requires_approval - for risky OS actions
 * 4. simple_completion - for questions and quick responses
 * 5. simple_completion - for deterministic actions (local execution)
 */
export function classifyExecutionMode(intent: IntentClassification): ExecutionModeResult {
  // 1. QUEUED WORKFLOW: Install/download/deploy, complex multi-step tasks
  // These MUST go through queue system for progress tracking and evidence
  if (QUEUED_WORKFLOW_INTENTS.includes(intent.kind) || (intent.isMultiStep && intent.needsAgent)) {
    return {
      mode: 'queued_workflow',
      reason: `Intent '${intent.kind}' requires queue execution with progress tracking`,
      useQueue: true,
      streamProgress: true,
      requiresEvidence: true
    }
  }

  // 2. AGENT WORKFLOW: Analysis tasks that need reasoning but not queue
  // These stream responses but don't require queue workers
  if (AGENT_WORKFLOW_INTENTS.includes(intent.kind) || (intent.needsAi && intent.needsAgent && !intent.isMultiStep)) {
    return {
      mode: 'agent_workflow',
      reason: `Intent '${intent.kind}' requires agent reasoning with streaming`,
      useQueue: false,
      streamProgress: true,
      requiresEvidence: false
    }
  }

  // 3. REQUIRES APPROVAL: OS actions that need confirmation
  // Non-deterministic OS/file actions in strict mode
  if ((intent.kind === 'os_action' || intent.kind === 'file_action') && !intent.isDeterministic) {
    return {
      mode: 'requires_approval',
      reason: `Intent '${intent.kind}' requires user approval before execution`,
      useQueue: false,
      streamProgress: false,
      requiresEvidence: false
    }
  }

  // 4. SIMPLE COMPLETION: Questions, explanations, quick AI responses
  // Also deterministic actions that don't need queue
  if (
    SIMPLE_COMPLETION_INTENTS.includes(intent.kind) ||
    intent.kind === 'deterministic_action' ||
    intent.kind === 'web_action' ||
    (intent.kind === 'file_action' && intent.isDeterministic) ||
    intent.kind === 'unknown'
  ) {
    return {
      mode: 'simple_completion',
      reason: `Intent '${intent.kind}' can be handled with simple completion`,
      useQueue: false,
      streamProgress: false,
      requiresEvidence: false
    }
  }

  // 5. DEFAULT: Unknown falls to simple completion with AI
  return {
    mode: 'simple_completion',
    reason: 'Default to simple completion for unclassified intent',
    useQueue: false,
    streamProgress: false,
    requiresEvidence: false
  }
}

/**
 * Check if execution mode requires queue system.
 * P6.9: Used by orchestrator to decide routing.
 */
export function requiresQueueExecution(intent: IntentClassification): boolean {
  const modeResult = classifyExecutionMode(intent)
  return modeResult.useQueue
}

/**
 * Check if execution mode requires evidence for completion.
 * P6.9: Used to enforce "no success without evidence" rule.
 */
export function requiresExecutionEvidence(intent: IntentClassification): boolean {
  const modeResult = classifyExecutionMode(intent)
  return modeResult.requiresEvidence
}

/**
 * P6.11R: Centralized guard to check if task MUST use queue execution.
 * This is the AUTHORITATIVE check used across all routes (normal, streaming, retry, tasks).
 *
 * When this returns true:
 * - NO runSimpleAgentTask
 * - NO postChatCompletion directo
 * - NO streaming simple fallback
 * - MUST use queue/workflow execution
 *
 * @param intent - The classified intent
 * @param executionMode - The execution mode result
 * @returns true if task MUST use queue, false otherwise
 */
export function mustUseQueue(
  intent: IntentClassification,
  executionMode: ExecutionModeResult
): boolean {
  // P6.11R: Three conditions that require queue execution:
  // 1. executionMode explicitly requires queue
  if (executionMode.useQueue) {
    return true
  }

  // 2. Intent is classified as multi-step
  if (intent.isMultiStep) {
    return true
  }

  // 3. Execution mode is queued_workflow
  if (executionMode.mode === 'queued_workflow') {
    return true
  }

  return false
}

/**
 * P6.11R: Check if a step type is safe for simple execution.
 * Only reasoning and simple_completion steps can use runSimpleAgentTask.
 *
 * @param stepDescription - The step description to analyze
 * @returns true if step can safely use runSimpleAgentTask
 */
export function isStepSafeForSimpleExecution(stepDescription: string): boolean {
  const lowerDesc = stepDescription.toLowerCase()

  // DANGEROUS step types - must NOT use runSimpleAgentTask
  const dangerousPatterns = [
    /\b(descarga|download|baja)\b/i,
    /\b(instala|install|setup)\b/i,
    /\b(ejecuta|run|execute)\b/i,
    /\b(deploy|desplega)\b/i,
    /\b(browser|navegador|chrome|firefox)\b/i,
    /\b(abre|open)\s+(url|sitio|web|página)/i,
    /\b(archivo|file)\s+(crea|create|escribe|write|guarda|save)/i,
    /\bnpm\s+(install|run)/i,
    /\bpip\s+install/i,
    /\bgit\s+(clone|push|pull)/i
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(lowerDesc)) {
      return false
    }
  }

  // Safe step types
  const safePatterns = [
    /\b(analiza|analyze|analysis)\b/i,
    /\b(explica|explain)\b/i,
    /\b(busca|search|encuentra|find)\b/i,
    /\b(lista|list|enumera)\b/i,
    /\b(compara|compare)\b/i,
    /\b(describe|describe)\b/i,
    /\b(resume|summarize|resumen)\b/i
  ]

  // If matches a safe pattern, it's safe
  for (const pattern of safePatterns) {
    if (pattern.test(lowerDesc)) {
      return true
    }
  }

  // Default: conservative - assume unsafe for unrecognized patterns
  return false
}

/**
 * P6.14: Detect suspicious or risky download requests
 * Returns warning info if the download request is potentially dangerous
 */
export interface SuspiciousDownloadResult {
  isSuspicious: boolean
  riskLevel: 'none' | 'low' | 'medium' | 'high'
  warnings: string[]
  reason?: string
  recommendedAction?: string
}

export function detectSuspiciousDownload(input: string): SuspiciousDownloadResult {
  const lowerInput = input.toLowerCase()

  // Check if this is a download request
  const isDownloadRequest = /\b(descarga|descargar|baja|bajar|download)\b/i.test(lowerInput)

  if (!isDownloadRequest) {
    return { isSuspicious: false, riskLevel: 'none', warnings: [] }
  }

  const warnings: string[] = []
  let riskLevel: 'none' | 'low' | 'medium' | 'high' = 'none'

  // HIGH RISK: Random/arbitrary software
  const randomSoftwarePatterns = [
    /\b(random|aleatorio|cualquier)\b/i,
    /\b(freeware|shareware|cracked|pirated|pirateado)\b/i,
    /\b(programa\s+random|software\s+random|aplicación\s+random)\b/i,
    /\b(any\s+program|cualquier\s+programa|un\s+programa)\b/i,
    /\b(hack|keygen|crack|serial)\b/i,
    /\b(torrent|warez)\b/i
  ]

  for (const pattern of randomSoftwarePatterns) {
    if (pattern.test(lowerInput)) {
      warnings.push('Solicitud de descarga de software aleatorio o no especificado detectada')
      riskLevel = 'high'
      break
    }
  }

  // MEDIUM RISK: Unknown sources
  const unknownSourcePatterns = [
    /\b(internet|web|sitio|site)\b.*\b(descarga|download)\b/i,
    /\b(descarga|download)\b.*\b(internet|web|sitio|site)\b/i,
    /\bde\s+internet\b/i,
    /\bfrom\s+(the\s+)?web\b/i,
    /\b(algún|algun|some)\s+(programa|software|aplicación|app)\b/i
  ]

  if (riskLevel !== 'high') {
    for (const pattern of unknownSourcePatterns) {
      if (pattern.test(lowerInput)) {
        warnings.push('Descarga de fuente no especificada')
        riskLevel = 'medium'
        break
      }
    }
  }

  // LOW RISK: Downloads without explicit source
  if (riskLevel === 'none' && !/\b(oficial|official|github|sourceforge|microsoft|google|adobe)\b/i.test(lowerInput)) {
    if (!/https?:\/\//i.test(lowerInput)) {
      warnings.push('No se especificó una fuente conocida para la descarga')
      riskLevel = 'low'
    }
  }

  // Determine recommended action
  let recommendedAction: string | undefined
  let reason: string | undefined

  switch (riskLevel) {
    case 'high':
      reason = 'Solicitud de descarga de alto riesgo detectada'
      recommendedAction = 'Especifica el software exacto que necesitas y la fuente oficial de descarga'
      break
    case 'medium':
      reason = 'Descarga de fuente no verificada'
      recommendedAction = 'Proporciona la URL oficial o el nombre exacto del software'
      break
    case 'low':
      reason = 'Descarga sin fuente especificada'
      recommendedAction = 'Considera especificar la fuente oficial para mayor seguridad'
      break
  }

  return {
    isSuspicious: riskLevel !== 'none',
    riskLevel,
    warnings,
    reason,
    recommendedAction
  }
}
