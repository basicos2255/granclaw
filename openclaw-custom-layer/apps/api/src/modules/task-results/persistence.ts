/**
 * Task Results Persistence
 * P6.3: Operational UX, Result Visibility & Real Task Outcomes
 *
 * Atomic persistence for task results using file-db.
 */

import { read, write, getById } from '../../storage/file-db'
import type { TaskResult } from './types'

const ENTITY = 'task-results'

/**
 * Get task result by task ID
 */
export function getTaskResult(taskId: string): TaskResult | null {
  const results = read<TaskResult>(ENTITY)
  return results.find(r => r.taskId === taskId) || null
}

/**
 * Save task result (upsert)
 */
export function saveTaskResult(result: TaskResult): TaskResult {
  const results = read<TaskResult>(ENTITY)

  // Find existing
  const existingIndex = results.findIndex(r => r.taskId === result.taskId)

  if (existingIndex >= 0) {
    // Update existing
    results[existingIndex] = result
  } else {
    // Add new
    results.push(result)
  }

  write(ENTITY, results)
  return result
}

/**
 * Get results for multiple tasks
 */
export function getTaskResults(taskIds: string[]): TaskResult[] {
  const results = read<TaskResult>(ENTITY)
  return results.filter(r => taskIds.includes(r.taskId))
}

/**
 * Get recent results
 */
export function getRecentResults(limit: number = 50): TaskResult[] {
  const results = read<TaskResult>(ENTITY)
  return results
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
}

/**
 * Delete task result
 */
export function deleteTaskResult(taskId: string): boolean {
  const results = read<TaskResult>(ENTITY)
  const filtered = results.filter(r => r.taskId !== taskId)

  if (filtered.length === results.length) {
    return false
  }

  write(ENTITY, filtered)
  return true
}

/**
 * Get results by workflow ID
 */
export function getWorkflowResults(workflowId: string): TaskResult[] {
  const results = read<TaskResult>(ENTITY)
  return results.filter(r => r.workflowId === workflowId)
}

/**
 * Clean old results (older than given days)
 */
export function cleanOldResults(days: number): number {
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000)
  const results = read<TaskResult>(ENTITY)
  const filtered = results.filter(r => new Date(r.createdAt).getTime() > cutoff)
  const deleted = results.length - filtered.length

  if (deleted > 0) {
    write(ENTITY, filtered)
  }

  return deleted
}
