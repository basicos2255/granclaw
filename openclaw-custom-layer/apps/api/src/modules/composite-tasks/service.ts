/**
 * Composite Tasks Service
 * FEATURE 130.2: Composite Tasks & Intelligent Task Chaining
 *
 * Persistence and core operations for composite tasks.
 */

import fs from 'fs'
import path from 'path'
import {
  type CompositeTask,
  type CompositeTaskState,
  type CompositeTaskStats,
  type CompositeTaskStep,
  DEFAULT_COMPOSITE_TASK_STATE,
  CURRENT_COMPOSITE_TASK_VERSION
} from './types'
import { normalizeTaskInput, type NormalizedIntent } from '../task-memory'
// H1.1: Atomic persistence
import { atomicWriteJson } from '../../shared/atomic-persistence'

/**
 * Data file path
 */
const DATA_DIR = path.resolve(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'composite-tasks.json')

/**
 * In-memory state
 */
let state: CompositeTaskState = { ...DEFAULT_COMPOSITE_TASK_STATE }

/**
 * Ensure data directory exists
 */
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

/**
 * Load state from disk
 */
export function loadCompositeTaskState(): void {
  ensureDataDir()
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8')
      const loaded = JSON.parse(raw) as CompositeTaskState
      state = {
        ...DEFAULT_COMPOSITE_TASK_STATE,
        ...loaded
      }
      console.log(`[CompositeTasks] Loaded ${state.tasks.length} composite tasks`)
    } else {
      state = { ...DEFAULT_COMPOSITE_TASK_STATE }
      saveState()
      console.log('[CompositeTasks] Created new composite tasks file')
    }
  } catch (err) {
    console.error('[CompositeTasks] Error loading state:', err)
    state = { ...DEFAULT_COMPOSITE_TASK_STATE }
  }
}

/**
 * Save state to disk
 * H1.1: Uses atomic write for crash safety
 */
function saveState(): void {
  state.lastUpdated = new Date().toISOString()
  state.stats = calculateStats()

  const result = atomicWriteJson(DATA_FILE, state, {
    createBackup: true,
    ensureDir: true
  })

  if (!result.success) {
    console.error('[CompositeTasks] Error saving state:', result.error)
  }
}

/**
 * Calculate statistics
 */
function calculateStats(): CompositeTaskStats {
  const validTasks = state.tasks.filter(t => !t.invalidated)
  const totalExecutions = state.tasks.reduce((sum, t) => sum + t.executionCount, 0)
  const avgSuccessRate = validTasks.length > 0
    ? validTasks.reduce((sum, t) => sum + t.successRate, 0) / validTasks.length
    : 0
  const tokensEstimatedSaved = state.tasks.reduce((sum, t) => sum + t.tokensEstimatedSaved, 0)
  const invalidatedTasks = state.tasks.filter(t => t.invalidated).length

  return {
    totalTasks: validTasks.length,
    totalExecutions,
    avgSuccessRate,
    tokensEstimatedSaved,
    invalidatedTasks
  }
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `ct-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
}

/**
 * Generate composite signature from steps
 */
export function generateCompositeSignature(steps: CompositeTaskStep[]): string {
  return steps
    .map(s => s.targetEntity ? `${s.actionType}:${s.targetEntity}` : s.actionType)
    .join('|')
}

/**
 * Find composite task by signature
 */
export function findCompositeBySignature(
  tenantId: string,
  signature: string
): CompositeTask | undefined {
  return state.tasks.find(t =>
    t.tenantId === tenantId &&
    t.signature === signature &&
    !t.invalidated &&
    t.version === CURRENT_COMPOSITE_TASK_VERSION
  )
}

/**
 * Find composite task by input (fuzzy match on trigger patterns)
 */
export function findCompositeByInput(
  tenantId: string,
  input: string
): CompositeTask | undefined {
  const normalized = normalizeTaskInput(input)
  const inputLower = input.toLowerCase().trim()

  // First try exact signature match
  const exactMatch = state.tasks.find(t =>
    t.tenantId === tenantId &&
    t.signature === normalized.signature &&
    !t.invalidated &&
    t.version === CURRENT_COMPOSITE_TASK_VERSION &&
    t.successRate >= 0.75
  )

  if (exactMatch) {
    return exactMatch
  }

  // Try trigger patterns
  return state.tasks.find(t =>
    t.tenantId === tenantId &&
    !t.invalidated &&
    t.version === CURRENT_COMPOSITE_TASK_VERSION &&
    t.successRate >= 0.75 &&
    t.triggerPatterns.some(pattern =>
      inputLower.includes(pattern.toLowerCase()) ||
      pattern.toLowerCase().includes(inputLower)
    )
  )
}

/**
 * Get composite task by ID
 */
export function getCompositeById(id: string): CompositeTask | undefined {
  return state.tasks.find(t => t.id === id)
}

/**
 * Get all composite tasks for tenant
 */
export function getCompositeTasks(tenantId: string): CompositeTask[] {
  return state.tasks.filter(t => t.tenantId === tenantId && !t.invalidated)
}

/**
 * Get all composite tasks (admin)
 */
export function getAllCompositeTasks(): CompositeTask[] {
  return [...state.tasks]
}

/**
 * Save a new composite task
 */
export interface SaveCompositeInput {
  tenantId: string
  userId?: string
  name: string
  normalizedIntent: string
  triggerPatterns: string[]
  steps: CompositeTaskStep[]
}

export function saveCompositeTask(input: SaveCompositeInput): CompositeTask {
  const signature = generateCompositeSignature(input.steps)

  // Check if exists
  const existing = findCompositeBySignature(input.tenantId, signature)
  if (existing) {
    // Update existing
    existing.executionCount++
    existing.updatedAt = new Date().toISOString()
    existing.lastUsedAt = new Date().toISOString()
    saveState()
    return existing
  }

  // Create new
  const task: CompositeTask = {
    id: generateId(),
    tenantId: input.tenantId,
    userId: input.userId,
    name: input.name,
    normalizedIntent: input.normalizedIntent,
    signature,
    triggerPatterns: input.triggerPatterns,
    steps: input.steps.map(s => ({
      ...s,
      status: undefined,
      error: undefined,
      result: undefined,
      startedAt: undefined,
      completedAt: undefined
    })),
    successRate: 1.0,
    executionCount: 1,
    failureCount: 0,
    avgDurationMs: 0,
    tokensEstimatedSaved: estimateTokenSaving(input.steps),
    version: CURRENT_COMPOSITE_TASK_VERSION,
    invalidated: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString()
  }

  state.tasks.push(task)
  saveState()

  console.log(`[CompositeTasks] Saved new composite task: ${task.id} (${signature})`)
  return task
}

/**
 * Estimate token saving for steps
 */
function estimateTokenSaving(steps: CompositeTaskStep[]): number {
  // ~500 tokens per AI call avoided
  const aiStepsAvoided = steps.filter(s => s.type === 'task_memory' || s.type === 'capability').length
  return aiStepsAvoided * 500
}

/**
 * Record composite execution result
 */
export function recordCompositeExecution(
  compositeId: string,
  success: boolean,
  durationMs: number,
  completedSteps: number,
  totalSteps: number
): void {
  const task = getCompositeById(compositeId)
  if (!task) return

  task.executionCount++
  task.lastUsedAt = new Date().toISOString()
  task.updatedAt = new Date().toISOString()

  // Update average duration
  const totalDuration = task.avgDurationMs * (task.executionCount - 1) + durationMs
  task.avgDurationMs = totalDuration / task.executionCount

  if (success) {
    // Recalculate success rate
    const successCount = Math.round(task.successRate * (task.executionCount - 1)) + 1
    task.successRate = successCount / task.executionCount
    task.failureCount = 0
    task.tokensEstimatedSaved += estimateTokenSaving(task.steps)
  } else {
    task.failureCount++
    const successCount = Math.round(task.successRate * (task.executionCount - 1))
    task.successRate = successCount / task.executionCount

    // Auto-invalidate after 3 failures or <50% success
    if (task.failureCount >= 3 || task.successRate < 0.5) {
      invalidateCompositeTask(compositeId, 'Auto-invalidated: too many failures')
    }
  }

  saveState()
  console.log(`[CompositeTasks] Recorded execution: ${compositeId} success=${success} rate=${(task.successRate * 100).toFixed(0)}%`)
}

/**
 * Invalidate a composite task
 */
export function invalidateCompositeTask(id: string, reason: string): boolean {
  const task = getCompositeById(id)
  if (!task) return false

  task.invalidated = true
  task.invalidationReason = reason
  task.updatedAt = new Date().toISOString()
  saveState()

  console.log(`[CompositeTasks] Invalidated: ${id} - ${reason}`)
  return true
}

/**
 * Revalidate a composite task
 */
export function validateCompositeTask(id: string): boolean {
  const task = getCompositeById(id)
  if (!task) return false

  task.invalidated = false
  task.invalidationReason = undefined
  task.failureCount = 0
  task.updatedAt = new Date().toISOString()
  saveState()

  console.log(`[CompositeTasks] Revalidated: ${id}`)
  return true
}

/**
 * Delete a composite task
 */
export function deleteCompositeTask(id: string): boolean {
  const index = state.tasks.findIndex(t => t.id === id)
  if (index === -1) return false

  state.tasks.splice(index, 1)
  saveState()

  console.log(`[CompositeTasks] Deleted: ${id}`)
  return true
}

/**
 * Clear all composite tasks for tenant
 */
export function clearCompositeTasks(tenantId: string): void {
  state.tasks = state.tasks.filter(t => t.tenantId !== tenantId)
  saveState()
  console.log(`[CompositeTasks] Cleared all for tenant: ${tenantId}`)
}

/**
 * Get statistics
 */
export function getCompositeTaskStats(): CompositeTaskStats {
  return calculateStats()
}

// Initialize on module load
loadCompositeTaskState()
