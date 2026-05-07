/**
 * DAG Execution Persistence
 * FIX 131.1: Wire DAG Engine into Composite Execution
 *
 * Simple file-based persistence for DAG execution history.
 */

import fs from 'fs'
import path from 'path'
import type { ExecutionGraph, ExecuteGraphResult, ExecutionProgressEvent } from './types'
import type { GraphSummary } from './dag-helper'

/**
 * Graph execution state (persisted)
 */
export interface GraphExecutionState {
  id: string
  graphId: string
  tenantId: string
  userId?: string
  sourceInput: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial' | 'cancelled'
  nodes: Record<string, {
    status: 'pending' | 'queued' | 'running' | 'validated' | 'completed' | 'failed' | 'skipped' | 'cancelled' | 'blocked' | 'validation_failed'
    startedAt?: string
    completedAt?: string
    error?: string
    validation?: {
      ok: boolean
      reason?: string
      warnings: string[]
      evidence: string[]
    }
    retries: number
  }>
  startedAt: string
  completedAt?: string
  summary?: GraphSummary
  events: GraphExecutionEvent[]
}

/**
 * Graph execution event
 */
export interface GraphExecutionEvent {
  type: 'graph-start' | 'node-queued' | 'node-start' | 'node-complete' | 'node-validation-success' | 'node-validation-failed' | 'node-failed' | 'graph-complete'
  timestamp: string
  nodeId?: string
  message?: string
  error?: string
}

/**
 * Persistence state
 */
interface PersistenceState {
  version: number
  executions: GraphExecutionState[]
  lastUpdated: string
}

const DATA_DIR = path.resolve(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'dag-executions.json')
const MAX_EXECUTIONS = 100 // Keep last 100 executions

// In-memory cache
let executionCache: Map<string, GraphExecutionState> = new Map()
let initialized = false

/**
 * Initialize persistence
 */
function initialize(): void {
  if (initialized) return

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }

    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8')
      const state: PersistenceState = JSON.parse(data)
      for (const exec of state.executions) {
        executionCache.set(exec.id, exec)
      }
    }
  } catch (err) {
    console.error('[DAGPersistence] Error loading state:', err)
  }

  initialized = true
}

/**
 * Save state to disk
 */
function saveState(): void {
  try {
    const executions = Array.from(executionCache.values())
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, MAX_EXECUTIONS)

    const state: PersistenceState = {
      version: 1,
      executions,
      lastUpdated: new Date().toISOString()
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2))
  } catch (err) {
    console.error('[DAGPersistence] Error saving state:', err)
  }
}

/**
 * Create execution state from graph
 */
export function createGraphExecutionState(
  graph: ExecutionGraph,
  tenantId: string,
  userId?: string
): GraphExecutionState {
  initialize()

  const nodes: GraphExecutionState['nodes'] = {}
  for (const [nodeId, node] of graph.nodes) {
    nodes[nodeId] = {
      status: node.status,
      startedAt: node.startedAt,
      completedAt: node.completedAt,
      error: node.error,
      validation: node.validationResult ? {
        ok: node.validationResult.ok,
        reason: node.validationResult.reason,
        warnings: node.validationResult.warnings,
        evidence: node.validationResult.evidence
      } : undefined,
      retries: node.attempts
    }
  }

  const state: GraphExecutionState = {
    id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    graphId: graph.id,
    tenantId,
    userId,
    sourceInput: graph.sourceInput,
    status: 'pending',
    nodes,
    startedAt: new Date().toISOString(),
    events: [{
      type: 'graph-start',
      timestamp: new Date().toISOString(),
      message: `Starting graph ${graph.id} with ${graph.nodes.size} nodes`
    }]
  }

  executionCache.set(state.id, state)
  saveState()

  return state
}

/**
 * Update execution state from result
 */
export function updateGraphExecutionState(
  executionId: string,
  result: ExecuteGraphResult,
  summary?: GraphSummary
): GraphExecutionState | undefined {
  initialize()

  const state = executionCache.get(executionId)
  if (!state) return undefined

  state.status = result.status
  state.completedAt = new Date().toISOString()
  state.summary = summary

  // Update node states
  for (const nodeId of result.completedNodes) {
    if (state.nodes[nodeId]) {
      state.nodes[nodeId].status = 'completed'
    }
  }
  for (const nodeId of result.failedNodes) {
    if (state.nodes[nodeId]) {
      state.nodes[nodeId].status = 'failed'
    }
  }
  for (const nodeId of result.skippedNodes) {
    if (state.nodes[nodeId]) {
      state.nodes[nodeId].status = 'skipped'
    }
  }
  for (const nodeId of result.blockedNodes) {
    if (state.nodes[nodeId]) {
      state.nodes[nodeId].status = 'blocked'
    }
  }
  for (const nodeId of result.validatedNodes) {
    if (state.nodes[nodeId]) {
      state.nodes[nodeId].status = 'validated'
    }
  }
  for (const nodeId of result.validationFailedNodes) {
    if (state.nodes[nodeId]) {
      state.nodes[nodeId].status = 'validation_failed'
    }
  }

  state.events.push({
    type: 'graph-complete',
    timestamp: new Date().toISOString(),
    message: `Graph ${result.status}: ${result.completedNodes.length} completed, ${result.failedNodes.length} failed`
  })

  saveState()
  return state
}

/**
 * Add event to execution
 */
export function addExecutionEvent(
  executionId: string,
  event: GraphExecutionEvent
): void {
  initialize()

  const state = executionCache.get(executionId)
  if (!state) return

  state.events.push(event)

  // Update node status if applicable
  if (event.nodeId && state.nodes[event.nodeId]) {
    switch (event.type) {
      case 'node-queued':
        state.nodes[event.nodeId].status = 'queued'
        break
      case 'node-start':
        state.nodes[event.nodeId].status = 'running'
        state.nodes[event.nodeId].startedAt = event.timestamp
        break
      case 'node-complete':
        state.nodes[event.nodeId].status = 'completed'
        state.nodes[event.nodeId].completedAt = event.timestamp
        break
      case 'node-validation-success':
        state.nodes[event.nodeId].status = 'validated'
        break
      case 'node-validation-failed':
        state.nodes[event.nodeId].status = 'validation_failed'
        break
      case 'node-failed':
        state.nodes[event.nodeId].status = 'failed'
        state.nodes[event.nodeId].error = event.error
        break
    }
  }

  // Only save periodically to avoid too many writes
  if (event.type === 'graph-complete' || state.events.length % 10 === 0) {
    saveState()
  }
}

/**
 * Get execution by ID
 */
export function getGraphExecution(executionId: string): GraphExecutionState | undefined {
  initialize()
  return executionCache.get(executionId)
}

/**
 * Get execution by graph ID
 */
export function getGraphExecutionByGraphId(graphId: string): GraphExecutionState | undefined {
  initialize()
  for (const [, state] of executionCache) {
    if (state.graphId === graphId) {
      return state
    }
  }
  return undefined
}

/**
 * List executions
 */
export function listGraphExecutions(
  tenantId?: string,
  limit: number = 20
): GraphExecutionState[] {
  initialize()

  let executions = Array.from(executionCache.values())

  if (tenantId) {
    executions = executions.filter(e => e.tenantId === tenantId)
  }

  return executions
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, limit)
}

/**
 * Save graph execution (convenience wrapper)
 */
export function saveGraphExecution(
  graph: ExecutionGraph,
  result: ExecuteGraphResult,
  summary: GraphSummary,
  tenantId: string,
  userId?: string
): GraphExecutionState {
  const state = createGraphExecutionState(graph, tenantId, userId)
  updateGraphExecutionState(state.id, result, summary)
  return state
}

/**
 * Delete execution
 */
export function deleteGraphExecution(executionId: string): boolean {
  initialize()

  if (executionCache.has(executionId)) {
    executionCache.delete(executionId)
    saveState()
    return true
  }

  return false
}

/**
 * Clear all executions for tenant
 */
export function clearGraphExecutions(tenantId: string): number {
  initialize()

  let count = 0
  for (const [id, state] of executionCache) {
    if (state.tenantId === tenantId) {
      executionCache.delete(id)
      count++
    }
  }

  if (count > 0) {
    saveState()
  }

  return count
}
