/**
 * Task Memory Service
 * FEATURE 130: Advanced Tasks (Persistent, Reusable, Optimized Execution)
 * FIX 130.1: Safe Task Memory Matching & Validation
 *
 * Manages persistent task patterns for SAFE reuse without calling AI.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import os from 'os'
import type {
  TaskPattern,
  TaskMemoryState,
  FindPatternInput,
  FindPatternResult,
  SavePatternInput,
  TaskPatternMetadata,
  NormalizedIntent,
  TaskActionType,
  EnvironmentFingerprint,
  PreconditionCheckResult
} from './types'
import {
  DEFAULT_TASK_MEMORY_STATE,
  CURRENT_TASK_PATTERN_VERSION
} from './types'
import type { TaskStep } from '../task-planner/types'

// Path to persistent state file
const DATA_DIR = join(process.cwd(), 'data')
const MEMORY_FILE = join(DATA_DIR, 'task-memory.json')

// In-memory cache
let cachedState: TaskMemoryState | null = null

// Estimated tokens per AI call (for stats)
const ESTIMATED_TOKENS_PER_CALL = 500

// FIX 130.1: Minimum thresholds for safe matching
const MIN_SUCCESS_RATE = 0.75
const MIN_CONFIDENCE = 0.75
const MAX_FAILURE_COUNT = 3

/**
 * FIX 130.1: Action keywords for intent classification
 */
const ACTION_PATTERNS: Record<TaskActionType, RegExp[]> = {
  open_app: [
    /^(abre|abrir|open|launch|ejecuta|ejecutar|run|inicia|iniciar|start)\s+/i
  ],
  close_app: [
    /^(cierra|cerrar|close|quit|exit|termina|terminar|stop)\s+/i
  ],
  install_app: [
    /^(instala|instalar|install|setup|configura|configurar)\s+/i,
    /(descarga|download).*(instala|install)/i,
    /(instala|install)/i
  ],
  uninstall_app: [
    /^(desinstala|desinstalar|uninstall|remove|elimina|eliminar)\s+/i
  ],
  download_file: [
    /^(descarga|descargar|download|baja|bajar)\s+/i,
    /descarga\s+(?!.*instala)/i
  ],
  upload_file: [
    /^(sube|subir|upload|envia|enviar)\s+/i
  ],
  search_web: [
    /^(busca|buscar|search|google|googlea)\s+/i,
    /busca\s+en\s+(internet|web|google)/i
  ],
  search_file: [
    /^(encuentra|encontrar|find|localiza|localizar)\s+/i,
    /busca\s+(archivo|fichero|file)/i
  ],
  copy_file: [
    /^(copia|copiar|copy)\s+/i
  ],
  move_file: [
    /^(mueve|mover|move|traslada|trasladar)\s+/i
  ],
  delete_file: [
    /^(borra|borrar|delete|elimina|eliminar)\s+/i
  ],
  create_file: [
    /^(crea|crear|create|nuevo|nueva|new)\s+/i
  ],
  edit_file: [
    /^(edita|editar|edit|modifica|modificar|modify)\s+/i
  ],
  run_command: [
    /^(ejecuta|ejecutar|run|corre|correr)\s+(comando|command|script)/i
  ],
  navigate_url: [
    /^(ve\s+a|ir\s+a|go\s+to|navega|navegar|navigate)\s+/i,
    /^(visita|visitar|visit)\s+/i
  ],
  send_message: [
    /^(envia|enviar|send|manda|mandar)\s+(mensaje|message|correo|email)/i
  ],
  configure_setting: [
    /^(configura|configurar|configure|ajusta|ajustar|set)\s+/i
  ],
  general_task: [],
  unknown: []
}

/**
 * FIX 130.1: Known app name normalizations
 */
const APP_NAME_NORMALIZATIONS: Record<string, string> = {
  // Browsers
  'chrome': 'chrome',
  'google chrome': 'chrome',
  'chromium': 'chromium',
  'chromecast': 'chromecast',
  'firefox': 'firefox',
  'mozilla firefox': 'firefox',
  'safari': 'safari',
  'edge': 'edge',
  'microsoft edge': 'edge',
  'brave': 'brave',
  'opera': 'opera',
  // IDEs
  'vscode': 'vscode',
  'visual studio code': 'vscode',
  'code': 'vscode',
  'vs code': 'vscode',
  'sublime': 'sublime',
  'sublime text': 'sublime',
  'atom': 'atom',
  'webstorm': 'webstorm',
  'intellij': 'intellij',
  // Media
  'vlc': 'vlc',
  'spotify': 'spotify',
  'itunes': 'itunes',
  // Utils
  'terminal': 'terminal',
  'cmd': 'cmd',
  'command prompt': 'cmd',
  'powershell': 'powershell',
  'finder': 'finder',
  'explorer': 'explorer',
  'file explorer': 'explorer',
  // Apps
  'slack': 'slack',
  'discord': 'discord',
  'zoom': 'zoom',
  'teams': 'teams',
  'microsoft teams': 'teams',
  'word': 'word',
  'excel': 'excel',
  'powerpoint': 'powerpoint',
  'outlook': 'outlook',
  'notion': 'notion',
  'obsidian': 'obsidian',
  'figma': 'figma',
  'photoshop': 'photoshop',
  'illustrator': 'illustrator',
  // System
  'calculator': 'calculator',
  'calculadora': 'calculator',
  'notepad': 'notepad',
  'bloc de notas': 'notepad',
  'notas': 'notes',
  'notes': 'notes'
}

/**
 * Ensure data directory exists
 */
function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

/**
 * Load state from disk
 */
function loadState(): TaskMemoryState {
  if (cachedState) {
    return cachedState
  }

  ensureDataDir()

  if (!existsSync(MEMORY_FILE)) {
    cachedState = { ...DEFAULT_TASK_MEMORY_STATE }
    saveState(cachedState)
    return cachedState
  }

  try {
    const raw = readFileSync(MEMORY_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<TaskMemoryState>

    // FIX 130.1: Migrate old patterns
    const patterns = (parsed.patterns || []).map(p => migratePattern(p))

    cachedState = {
      ...DEFAULT_TASK_MEMORY_STATE,
      ...parsed,
      patterns,
      version: CURRENT_TASK_PATTERN_VERSION
    }

    return cachedState
  } catch (err) {
    console.error('[TaskMemory] Error loading state:', err)
    cachedState = { ...DEFAULT_TASK_MEMORY_STATE }
    return cachedState
  }
}

/**
 * FIX 130.1: Migrate old pattern to new schema
 */
function migratePattern(p: Partial<TaskPattern>): TaskPattern {
  const now = new Date().toISOString()
  return {
    id: p.id ?? randomUUID(),
    tenantId: p.tenantId ?? 'default',
    userId: p.userId,
    inputSignature: p.inputSignature ?? '',
    normalizedIntent: p.normalizedIntent ?? p.inputSignature ?? '',
    actionType: p.actionType ?? 'unknown',
    targetEntity: p.targetEntity,
    environmentFingerprint: p.environmentFingerprint ?? {},
    originalInputs: p.originalInputs ?? [],
    steps: p.steps ?? [],
    successRate: p.successRate ?? 0,
    confidence: p.confidence ?? 0.5,
    useCount: p.useCount ?? (p as { executionCount?: number }).executionCount ?? 0,
    failureCount: p.failureCount ?? 0,
    version: p.version ?? CURRENT_TASK_PATTERN_VERSION,
    invalidated: p.invalidated ?? false,
    invalidationReason: p.invalidationReason,
    lastUsedAt: p.lastUsedAt ?? now,
    createdAt: p.createdAt ?? now,
    updatedAt: p.updatedAt ?? now,
    avgDuration: p.avgDuration ?? 0,
    lastError: p.lastError,
    metadata: p.metadata
  }
}

/**
 * Save state to disk
 */
function saveState(state: TaskMemoryState): void {
  ensureDataDir()

  try {
    state.lastUpdated = new Date().toISOString()
    state.stats.totalPatterns = state.patterns.filter(p => !p.invalidated).length
    state.stats.invalidatedPatterns = state.patterns.filter(p => p.invalidated).length
    state.stats.totalExecutions = state.patterns.reduce((sum, p) => sum + p.useCount, 0)
    state.stats.totalFailures = state.patterns.reduce((sum, p) => sum + p.failureCount, 0)
    state.stats.avgSuccessRate = state.patterns.length > 0
      ? state.patterns.filter(p => !p.invalidated).reduce((sum, p) => sum + p.successRate, 0) /
        Math.max(1, state.patterns.filter(p => !p.invalidated).length)
      : 0

    writeFileSync(MEMORY_FILE, JSON.stringify(state, null, 2), 'utf-8')
    cachedState = state
    console.log('[TaskMemory] State saved to disk')
  } catch (err) {
    console.error('[TaskMemory] Error saving state:', err)
  }
}

/**
 * FIX 130.1: Get current environment fingerprint
 */
export function getCurrentEnvironment(): EnvironmentFingerprint {
  return {
    platform: os.platform() as EnvironmentFingerprint['platform'],
    os: os.type(),
    hostname: os.hostname(),
    provider: 'openclaw'
  }
}

/**
 * FIX 130.1: Detect language from input
 */
export function detectLanguage(input: string): 'es' | 'en' {
  const spanishWords = ['abre', 'abrir', 'cierra', 'instala', 'descarga', 'busca', 'copia', 'y', 'el', 'la', 'los', 'las', 'en', 'de', 'para', 'por', 'favor']
  const lower = input.toLowerCase()
  const spanishCount = spanishWords.filter(w => lower.includes(w)).length
  return spanishCount >= 2 ? 'es' : 'en'
}

/**
 * FIX 130.1: Extract target entity from input
 */
function extractTargetEntity(input: string, actionType: TaskActionType): string | undefined {
  const lower = input.toLowerCase().trim()

  // Remove action words to get the target
  let target = lower

  // Spanish action words
  target = target.replace(/^(abre|abrir|cierra|cerrar|instala|instalar|desinstala|desinstalar|descarga|descargar|busca|buscar|copia|copiar|mueve|mover|borra|borrar|crea|crear|edita|editar|ejecuta|ejecutar|ve\s+a|ir\s+a|visita|visitar|envia|enviar|configura|configurar)\s+/i, '')

  // English action words
  target = target.replace(/^(open|close|launch|run|start|install|uninstall|download|upload|search|find|copy|move|delete|create|edit|go\s+to|navigate|visit|send|configure|set)\s+/i, '')

  // Remove articles
  target = target.replace(/^(el|la|los|las|un|una|the|a|an)\s+/i, '')

  // Remove common suffixes
  target = target.replace(/,?\s*(por favor|please|ahora|now)\.?$/i, '')

  // Clean up
  target = target.trim()

  if (!target || target.length < 2) {
    return undefined
  }

  // Normalize known app names
  const normalized = APP_NAME_NORMALIZATIONS[target]
  if (normalized) {
    return normalized
  }

  // Return first word as entity for simple cases
  const firstWord = target.split(/\s+/)[0]
  return APP_NAME_NORMALIZATIONS[firstWord] || firstWord
}

/**
 * FIX 130.1: Classify action type from input
 */
function classifyActionType(input: string): { actionType: TaskActionType; confidence: number } {
  const lower = input.toLowerCase().trim()

  for (const [actionType, patterns] of Object.entries(ACTION_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(lower)) {
        return {
          actionType: actionType as TaskActionType,
          confidence: 0.9
        }
      }
    }
  }

  return { actionType: 'unknown', confidence: 0.3 }
}

/**
 * FIX 130.1: Intent-aware normalization
 */
export function normalizeTaskInput(input: string): NormalizedIntent {
  const language = detectLanguage(input)
  const { actionType, confidence: actionConfidence } = classifyActionType(input)
  const targetEntity = extractTargetEntity(input, actionType)

  // Build signature: actionType:targetEntity
  const signature = targetEntity
    ? `${actionType}:${targetEntity}`
    : actionType

  // Build normalized intent
  const normalizedIntent = targetEntity
    ? `${actionType} ${targetEntity}`
    : actionType

  // Confidence is lower if no target entity
  const confidence = targetEntity
    ? actionConfidence
    : actionConfidence * 0.7

  return {
    signature,
    actionType,
    targetEntity,
    normalizedIntent,
    confidence,
    language
  }
}

/**
 * FIX 130.1: Generate signature from normalized intent
 */
export function generateInputSignature(normalizedIntent: NormalizedIntent): string {
  return normalizedIntent.signature
}

/**
 * FIX 130.1: Check if environments are compatible
 */
function areEnvironmentsCompatible(
  patternEnv: EnvironmentFingerprint,
  currentEnv: EnvironmentFingerprint
): boolean {
  // Platform must match if specified
  if (patternEnv.platform && currentEnv.platform) {
    if (patternEnv.platform !== currentEnv.platform) {
      return false
    }
  }
  return true
}

/**
 * FIX 130.1: Run precondition checks for a pattern
 */
export function runPreconditionChecks(
  pattern: TaskPattern,
  _environment: EnvironmentFingerprint
): PreconditionCheckResult {
  const warnings: string[] = []

  // For now, basic checks. Can be extended with actual system checks.
  switch (pattern.actionType) {
    case 'open_app':
      // Could check if app is installed, but that requires system access
      // For now, warn if low success rate
      if (pattern.successRate < 0.8) {
        warnings.push(`App pattern has ${(pattern.successRate * 100).toFixed(0)}% success rate`)
      }
      break

    case 'install_app':
      // Could check if already installed
      if (pattern.failureCount > 0) {
        warnings.push(`Install pattern had ${pattern.failureCount} previous failures`)
      }
      break

    case 'download_file':
      // Could check if file already exists
      break
  }

  return {
    ok: warnings.length === 0 || pattern.successRate >= 0.9,
    warnings,
    reason: warnings.length > 0 ? warnings.join('; ') : undefined
  }
}

/**
 * FIX 130.1: Find best matching pattern with SAFE criteria
 */
export function findPatternByInput(params: FindPatternInput): FindPatternResult {
  const state = loadState()
  const { input, tenantId, environment } = params
  const currentEnv = environment || getCurrentEnvironment()

  // Step 1: Normalize input
  const normalizedIntent = normalizeTaskInput(input)

  console.log(`[TaskMemory] Finding pattern for: ${normalizedIntent.signature} (tenant: ${tenantId})`)

  // Step 2: Filter candidates
  const candidates = state.patterns.filter(p => {
    // Must not be invalidated
    if (p.invalidated) return false

    // Must be current version
    if (p.version !== CURRENT_TASK_PATTERN_VERSION) return false

    // Must match tenant
    if (p.tenantId !== tenantId) return false

    // Must have good success rate
    if (p.successRate < MIN_SUCCESS_RATE) return false

    // Must have good confidence
    if (p.confidence < MIN_CONFIDENCE) return false

    // Must not have too many failures
    if (p.failureCount >= MAX_FAILURE_COUNT) return false

    // Must match action type
    if (p.actionType !== normalizedIntent.actionType) return false

    // Must match target entity if both have one
    if (normalizedIntent.targetEntity && p.targetEntity) {
      if (normalizedIntent.targetEntity !== p.targetEntity) return false
    }

    // Environment must be compatible
    if (!areEnvironmentsCompatible(p.environmentFingerprint, currentEnv)) return false

    return true
  })

  if (candidates.length === 0) {
    return {
      found: false,
      confidence: 0,
      matchType: 'none',
      reason: normalizedIntent.actionType === 'unknown'
        ? 'Could not classify action type'
        : `No safe match for ${normalizedIntent.signature}`
    }
  }

  // Step 3: Find best match
  // Prioritize: exact signature > same target > same action
  let bestMatch: TaskPattern | undefined
  let matchType: FindPatternResult['matchType'] = 'none'

  // Try exact signature match
  bestMatch = candidates.find(p => p.inputSignature === normalizedIntent.signature)
  if (bestMatch) {
    matchType = 'exact'
  }

  // Try normalized intent match
  if (!bestMatch) {
    bestMatch = candidates.find(p => p.normalizedIntent === normalizedIntent.normalizedIntent)
    if (bestMatch) {
      matchType = 'normalized'
    }
  }

  // Take highest success rate if multiple
  if (!bestMatch && candidates.length > 0) {
    bestMatch = candidates.sort((a, b) => b.successRate - a.successRate)[0]
    matchType = 'similar'
  }

  if (!bestMatch) {
    return {
      found: false,
      confidence: 0,
      matchType: 'none',
      reason: 'No safe memory match'
    }
  }

  // Step 4: Run precondition checks
  const preconditions = runPreconditionChecks(bestMatch, currentEnv)

  console.log(`[TaskMemory] Safe match found: ${bestMatch.id} (${matchType}, ${(bestMatch.successRate * 100).toFixed(0)}% success)`)

  return {
    found: true,
    pattern: bestMatch,
    confidence: bestMatch.confidence,
    matchType,
    reason: `Pattern reutilizable (${bestMatch.useCount} usos, ${(bestMatch.successRate * 100).toFixed(0)}% éxito)`,
    preconditions
  }
}

/**
 * FIX 130.1: Save or update a pattern ONLY if execution was confirmed
 */
export function savePattern(params: SavePatternInput): TaskPattern | null {
  // FIX 130.1: Only learn from confirmed successes
  if (!params.success || !params.executionConfirmed) {
    console.log(`[TaskMemory] Skipping learn: success=${params.success}, confirmed=${params.executionConfirmed}`)
    return null
  }

  const state = loadState()
  const { tenantId, normalizedIntent, environment } = params
  const currentEnv = environment || getCurrentEnvironment()

  // Check if pattern exists
  const existingIndex = state.patterns.findIndex(
    p => p.tenantId === tenantId &&
         p.inputSignature === normalizedIntent.signature &&
         !p.invalidated
  )

  if (existingIndex >= 0) {
    // Update existing pattern
    const existing = state.patterns[existingIndex]
    const newUseCount = existing.useCount + 1
    const newSuccessRate = (existing.successRate * existing.useCount + 1) / newUseCount

    // Add original input if not already present
    if (!existing.originalInputs.includes(params.originalInput)) {
      existing.originalInputs.push(params.originalInput)
      if (existing.originalInputs.length > 10) {
        existing.originalInputs = existing.originalInputs.slice(-10)
      }
    }

    existing.steps = params.steps
    existing.successRate = newSuccessRate
    existing.confidence = Math.min(1, (existing.confidence + normalizedIntent.confidence) / 2)
    existing.lastUsedAt = new Date().toISOString()
    existing.updatedAt = new Date().toISOString()
    existing.useCount = newUseCount
    existing.avgDuration = (existing.avgDuration * (newUseCount - 1) + params.duration) / newUseCount

    if (params.metadata) {
      existing.metadata = { ...existing.metadata, ...params.metadata }
    }

    saveState(state)
    console.log(`[TaskMemory] Updated pattern: ${existing.id} (uses: ${newUseCount})`)
    return existing
  }

  // Create new pattern
  const pattern: TaskPattern = {
    id: randomUUID(),
    tenantId,
    userId: params.userId,
    inputSignature: normalizedIntent.signature,
    normalizedIntent: normalizedIntent.normalizedIntent,
    actionType: normalizedIntent.actionType,
    targetEntity: normalizedIntent.targetEntity,
    environmentFingerprint: currentEnv,
    originalInputs: [params.originalInput],
    steps: params.steps,
    successRate: 1,
    confidence: normalizedIntent.confidence,
    useCount: 1,
    failureCount: 0,
    version: CURRENT_TASK_PATTERN_VERSION,
    invalidated: false,
    lastUsedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    avgDuration: params.duration,
    lastError: params.error,
    metadata: params.metadata
  }

  state.patterns.push(pattern)
  saveState(state)

  console.log(`[TaskMemory] Created new pattern: ${pattern.id} (${normalizedIntent.signature})`)
  return pattern
}

/**
 * FIX 130.1: Record pattern reuse (success or failure)
 */
export function recordPatternReuse(patternId: string, success: boolean, duration: number): void {
  const state = loadState()
  const pattern = state.patterns.find(p => p.id === patternId)

  if (!pattern) {
    console.error(`[TaskMemory] Pattern not found: ${patternId}`)
    return
  }

  if (success) {
    pattern.useCount++
    pattern.successRate = (pattern.successRate * (pattern.useCount - 1) + 1) / pattern.useCount
    state.stats.tokensEstimatedSaved += ESTIMATED_TOKENS_PER_CALL
  } else {
    // FIX 130.1: Failure feedback
    pattern.failureCount++
    pattern.useCount++
    pattern.successRate = (pattern.successRate * (pattern.useCount - 1)) / pattern.useCount

    // Check for invalidation
    if (pattern.failureCount >= MAX_FAILURE_COUNT || pattern.successRate < 0.5) {
      pattern.invalidated = true
      pattern.invalidationReason = `Repeated failures (${pattern.failureCount} failures, ${(pattern.successRate * 100).toFixed(0)}% success)`
      console.log(`[TaskMemory] Pattern invalidated: ${patternId} - ${pattern.invalidationReason}`)
    }
  }

  pattern.avgDuration = (pattern.avgDuration * (pattern.useCount - 1) + duration) / pattern.useCount
  pattern.lastUsedAt = new Date().toISOString()
  pattern.updatedAt = new Date().toISOString()

  saveState(state)
  console.log(`[TaskMemory] Recorded ${success ? 'success' : 'failure'} for pattern ${patternId}`)
}

/**
 * FIX 130.1: Manually invalidate a pattern
 */
export function invalidatePattern(patternId: string, reason: string): boolean {
  const state = loadState()
  const pattern = state.patterns.find(p => p.id === patternId)

  if (!pattern) {
    return false
  }

  pattern.invalidated = true
  pattern.invalidationReason = reason
  pattern.updatedAt = new Date().toISOString()

  saveState(state)
  console.log(`[TaskMemory] Pattern manually invalidated: ${patternId}`)
  return true
}

/**
 * FIX 130.1: Revalidate a pattern
 */
export function validatePattern(patternId: string): boolean {
  const state = loadState()
  const pattern = state.patterns.find(p => p.id === patternId)

  if (!pattern) {
    return false
  }

  pattern.invalidated = false
  pattern.invalidationReason = undefined
  pattern.failureCount = 0
  pattern.updatedAt = new Date().toISOString()

  saveState(state)
  console.log(`[TaskMemory] Pattern revalidated: ${patternId}`)
  return true
}

/**
 * Get recent patterns (sorted by lastUsedAt)
 */
export function getRecentPatterns(limit: number = 20): TaskPattern[] {
  const state = loadState()
  return state.patterns
    .filter(p => !p.invalidated)
    .sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime())
    .slice(0, limit)
}

/**
 * Get patterns by success rate
 */
export function getTopPatterns(limit: number = 20): TaskPattern[] {
  const state = loadState()
  return state.patterns
    .filter(p => !p.invalidated && p.useCount >= 2)
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, limit)
}

/**
 * Get task memory stats
 */
export function getTaskMemoryStats(): TaskMemoryState['stats'] {
  const state = loadState()
  return state.stats
}

/**
 * Get all patterns (including invalidated)
 */
export function getAllPatterns(): TaskPattern[] {
  const state = loadState()
  return state.patterns
}

/**
 * Delete a pattern by ID
 */
export function deletePattern(patternId: string): boolean {
  const state = loadState()
  const initialLength = state.patterns.length
  state.patterns = state.patterns.filter(p => p.id !== patternId)

  if (state.patterns.length < initialLength) {
    saveState(state)
    console.log(`[TaskMemory] Deleted pattern: ${patternId}`)
    return true
  }

  return false
}

/**
 * Clear all patterns
 */
export function clearAllPatterns(): void {
  const state = loadState()
  state.patterns = []
  state.stats = {
    totalPatterns: 0,
    totalExecutions: 0,
    tokensEstimatedSaved: 0,
    avgSuccessRate: 0,
    invalidatedPatterns: 0,
    totalFailures: 0
  }
  saveState(state)
  console.log('[TaskMemory] All patterns cleared')
}

/**
 * Force reload from disk
 */
export function reloadTaskMemory(): TaskMemoryState {
  cachedState = null
  return loadState()
}

/**
 * Detect task category (legacy compatibility)
 */
export function detectTaskCategory(input: string): string {
  const { actionType } = normalizeTaskInput(input)
  return actionType
}
