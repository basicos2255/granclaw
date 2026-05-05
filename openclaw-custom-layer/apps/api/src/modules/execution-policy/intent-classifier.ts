/**
 * Intent Classifier
 * FIX 121: Authoritative Hybrid Router & Intent Classification
 *
 * Classifies user intent BEFORE capability detection.
 * This prevents false positives like "descarga e instala" being classified as editor.
 */

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
