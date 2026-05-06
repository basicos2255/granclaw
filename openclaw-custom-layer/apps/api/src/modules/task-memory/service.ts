/**
 * Task Memory Service
 * FEATURE 130: Advanced Tasks (Persistent, Reusable, Optimized Execution)
 *
 * Manages persistent task patterns for reuse without calling AI again.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type {
  TaskPattern,
  TaskMemoryState,
  FindPatternInput,
  FindPatternResult,
  SavePatternInput,
  TaskPatternMetadata
} from './types'
import { DEFAULT_TASK_MEMORY_STATE } from './types'
import type { TaskStep } from '../task-planner/types'

// Path to persistent state file
const DATA_DIR = join(process.cwd(), 'data')
const MEMORY_FILE = join(DATA_DIR, 'task-memory.json')

// In-memory cache
let cachedState: TaskMemoryState | null = null

// Estimated tokens per AI call (for stats)
const ESTIMATED_TOKENS_PER_CALL = 500

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

    cachedState = {
      ...DEFAULT_TASK_MEMORY_STATE,
      ...parsed,
      patterns: parsed.patterns || []
    }

    return cachedState
  } catch (err) {
    console.error('[TaskMemory] Error loading state:', err)
    cachedState = { ...DEFAULT_TASK_MEMORY_STATE }
    return cachedState
  }
}

/**
 * Save state to disk
 */
function saveState(state: TaskMemoryState): void {
  ensureDataDir()

  try {
    state.lastUpdated = new Date().toISOString()
    state.stats.totalPatterns = state.patterns.length
    state.stats.totalExecutions = state.patterns.reduce((sum, p) => sum + p.executionCount, 0)
    state.stats.avgSuccessRate = state.patterns.length > 0
      ? state.patterns.reduce((sum, p) => sum + p.successRate, 0) / state.patterns.length
      : 0

    writeFileSync(MEMORY_FILE, JSON.stringify(state, null, 2), 'utf-8')
    cachedState = state
    console.log('[TaskMemory] State saved to disk')
  } catch (err) {
    console.error('[TaskMemory] Error saving state:', err)
  }
}

/**
 * Normalize input text for matching
 * - Lowercase
 * - Remove extra whitespace
 * - Remove punctuation
 * - Sort words (for order-independent matching)
 */
export function normalizeTaskInput(input: string): string {
  if (!input || typeof input !== 'string') return ''

  return input
    .toLowerCase()
    .trim()
    .replace(/[.,!?¿¡;:'"()[\]{}]/g, '')  // Remove punctuation
    .replace(/\s+/g, ' ')                  // Normalize whitespace
    .split(' ')
    .filter(word => word.length > 0)
    .sort()                                // Sort for order-independence
    .join(' ')
}

/**
 * Generate a signature hash for an input
 */
export function generateInputSignature(input: string): string {
  const normalized = normalizeTaskInput(input)

  // Simple hash (could use crypto.createHash for better distribution)
  let hash = 0
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }

  return `sig-${Math.abs(hash).toString(36)}`
}

/**
 * Calculate similarity between two normalized inputs (0-1)
 */
function calculateSimilarity(a: string, b: string): number {
  const wordsA = a.split(' ')
  const wordsB = b.split(' ')
  const setA = new Set(wordsA)
  const setB = new Set(wordsB)

  const intersection = [...setA].filter(x => setB.has(x)).length
  const union = new Set([...wordsA, ...wordsB]).size

  return union > 0 ? intersection / union : 0
}

/**
 * Find a matching pattern for the given input
 */
export function findPatternByInput(params: FindPatternInput): FindPatternResult {
  const state = loadState()
  const normalizedInput = normalizeTaskInput(params.input)
  const signature = generateInputSignature(params.input)

  // 1. Try exact signature match
  const exactMatch = state.patterns.find(p => p.inputSignature === signature)
  if (exactMatch && exactMatch.successRate >= 0.7) {
    console.log(`[TaskMemory] Exact match found: ${exactMatch.id}`)
    return {
      found: true,
      pattern: exactMatch,
      confidence: 1.0,
      matchType: 'exact'
    }
  }

  // 2. Try normalized match
  const normalizedMatch = state.patterns.find(p => p.normalizedInput === normalizedInput)
  if (normalizedMatch && normalizedMatch.successRate >= 0.7) {
    console.log(`[TaskMemory] Normalized match found: ${normalizedMatch.id}`)
    return {
      found: true,
      pattern: normalizedMatch,
      confidence: 0.95,
      matchType: 'normalized'
    }
  }

  // 3. Try similarity match (threshold: 0.8)
  let bestMatch: TaskPattern | undefined
  let bestSimilarity = 0

  for (const pattern of state.patterns) {
    if (pattern.successRate < 0.7) continue

    const similarity = calculateSimilarity(normalizedInput, pattern.normalizedInput)
    if (similarity > bestSimilarity && similarity >= 0.8) {
      bestSimilarity = similarity
      bestMatch = pattern
    }
  }

  if (bestMatch) {
    console.log(`[TaskMemory] Similar match found: ${bestMatch.id} (similarity: ${bestSimilarity.toFixed(2)})`)
    return {
      found: true,
      pattern: bestMatch,
      confidence: bestSimilarity,
      matchType: 'similar'
    }
  }

  // No match
  return {
    found: false,
    confidence: 0,
    matchType: 'none'
  }
}

/**
 * Save or update a pattern after execution
 */
export function savePattern(params: SavePatternInput): TaskPattern {
  const state = loadState()

  // Check if pattern exists
  const existingIndex = state.patterns.findIndex(
    p => p.inputSignature === params.inputSignature
  )

  if (existingIndex >= 0) {
    // Update existing pattern
    const existing = state.patterns[existingIndex]
    const newExecutionCount = existing.executionCount + 1
    const newSuccessRate = params.success
      ? (existing.successRate * existing.executionCount + 1) / newExecutionCount
      : (existing.successRate * existing.executionCount) / newExecutionCount

    // Add original input if not already present
    if (!existing.originalInputs.includes(params.originalInput)) {
      existing.originalInputs.push(params.originalInput)
      // Keep only last 10 original inputs
      if (existing.originalInputs.length > 10) {
        existing.originalInputs = existing.originalInputs.slice(-10)
      }
    }

    existing.steps = params.steps
    existing.successRate = newSuccessRate
    existing.lastUsedAt = new Date().toISOString()
    existing.executionCount = newExecutionCount
    existing.avgDuration = (existing.avgDuration * (newExecutionCount - 1) + params.duration) / newExecutionCount
    existing.lastError = params.error
    if (params.metadata) {
      existing.metadata = { ...existing.metadata, ...params.metadata }
    }

    saveState(state)
    console.log(`[TaskMemory] Updated pattern: ${existing.id} (executions: ${newExecutionCount})`)
    return existing
  }

  // Create new pattern
  const pattern: TaskPattern = {
    id: randomUUID(),
    inputSignature: params.inputSignature,
    normalizedInput: params.normalizedInput,
    originalInputs: [params.originalInput],
    steps: params.steps,
    successRate: params.success ? 1 : 0,
    lastUsedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    executionCount: 1,
    avgDuration: params.duration,
    lastError: params.error,
    metadata: params.metadata
  }

  state.patterns.push(pattern)
  saveState(state)

  console.log(`[TaskMemory] Created new pattern: ${pattern.id}`)
  return pattern
}

/**
 * Get recent patterns (sorted by lastUsedAt)
 */
export function getRecentPatterns(limit: number = 20): TaskPattern[] {
  const state = loadState()
  return state.patterns
    .sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime())
    .slice(0, limit)
}

/**
 * Get patterns by success rate
 */
export function getTopPatterns(limit: number = 20): TaskPattern[] {
  const state = loadState()
  return state.patterns
    .filter(p => p.executionCount >= 2)  // At least 2 executions
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, limit)
}

/**
 * Update pattern stats after reuse
 */
export function recordPatternReuse(patternId: string, success: boolean, duration: number): void {
  const state = loadState()
  const pattern = state.patterns.find(p => p.id === patternId)

  if (!pattern) {
    console.error(`[TaskMemory] Pattern not found: ${patternId}`)
    return
  }

  const newExecutionCount = pattern.executionCount + 1
  pattern.successRate = success
    ? (pattern.successRate * pattern.executionCount + 1) / newExecutionCount
    : (pattern.successRate * pattern.executionCount) / newExecutionCount
  pattern.executionCount = newExecutionCount
  pattern.avgDuration = (pattern.avgDuration * (newExecutionCount - 1) + duration) / newExecutionCount
  pattern.lastUsedAt = new Date().toISOString()

  // Update tokens saved stats
  state.stats.tokensEstimatedSaved += ESTIMATED_TOKENS_PER_CALL

  saveState(state)
  console.log(`[TaskMemory] Recorded reuse for pattern ${patternId} (total: ${newExecutionCount})`)
}

/**
 * Get task memory stats
 */
export function getTaskMemoryStats(): TaskMemoryState['stats'] {
  const state = loadState()
  return state.stats
}

/**
 * Get all patterns
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
 * Clear all patterns (for testing)
 */
export function clearAllPatterns(): void {
  const state = loadState()
  state.patterns = []
  state.stats = {
    totalPatterns: 0,
    totalExecutions: 0,
    tokensEstimatedSaved: 0,
    avgSuccessRate: 0
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
 * Detect task category from input
 */
export function detectTaskCategory(input: string): string {
  const lower = input.toLowerCase()

  if (/instala|install|setup/i.test(lower)) return 'install'
  if (/descarga|download/i.test(lower)) return 'download'
  if (/abre|abrir|open|launch/i.test(lower)) return 'open'
  if (/busca|search|find/i.test(lower)) return 'search'
  if (/copia|copy|paste/i.test(lower)) return 'copy'
  if (/cierra|close|quit|exit/i.test(lower)) return 'close'
  if (/configura|configure|settings/i.test(lower)) return 'configure'

  return 'general'
}

/**
 * Detect language from input
 */
export function detectLanguage(input: string): 'es' | 'en' {
  const spanishWords = ['abre', 'abrir', 'cierra', 'instala', 'descarga', 'busca', 'copia', 'y', 'el', 'la', 'los', 'las', 'en', 'de', 'para']
  const lower = input.toLowerCase()

  const spanishCount = spanishWords.filter(w => lower.includes(w)).length
  return spanishCount >= 2 ? 'es' : 'en'
}
