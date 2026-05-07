/**
 * Scheduler
 * FEATURE 131: DAG Execution Engine & Parallel Tasks
 *
 * Intelligent scheduler for DAG execution with:
 * - Priority-based scheduling
 * - Resource-aware node selection
 * - Critical path optimization
 * - Parallel group coordination
 */

import type {
  ExecutionGraph,
  WorkflowNode,
  SchedulerConfig,
  SchedulerState,
  ResourceSlotType,
  ResourceSlot
} from './types'
import { DEFAULT_SCHEDULER_CONFIG } from './types'
import { ResourceManager } from './resource-manager'
import { ArtifactLockManager, canAcquireLocks } from './artifact-locks'
import { getReadyNodes } from './dependency-resolver'

/**
 * Scheduler event types
 */
export type SchedulerEventType =
  | 'node-scheduled'
  | 'node-queued'
  | 'node-blocked'
  | 'resources-available'
  | 'scheduler-tick'

/**
 * Scheduler event
 */
export interface SchedulerEvent {
  type: SchedulerEventType
  timestamp: string
  nodeId?: string
  message?: string
  detail?: unknown
}

/**
 * Scheduler event handler
 */
export type SchedulerEventHandler = (event: SchedulerEvent) => void

/**
 * DAG Scheduler
 */
export class DAGScheduler {
  private graph: ExecutionGraph
  private config: SchedulerConfig
  private resourceManager: ResourceManager
  private lockManager: ArtifactLockManager

  private completedNodes: Set<string> = new Set()
  private runningNodes: Set<string> = new Set()
  private failedNodes: Set<string> = new Set()
  private blockedNodes: Set<string> = new Set()
  private queuedNodes: string[] = []
  private skippedNodes: Set<string> = new Set()

  private eventHandlers: SchedulerEventHandler[] = []
  private running: boolean = false

  constructor(
    graph: ExecutionGraph,
    resourceManager: ResourceManager,
    lockManager: ArtifactLockManager,
    config: Partial<SchedulerConfig> = {}
  ) {
    this.graph = graph
    this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config }
    this.resourceManager = resourceManager
    this.lockManager = lockManager
  }

  /**
   * Add event handler
   */
  onEvent(handler: SchedulerEventHandler): void {
    this.eventHandlers.push(handler)
  }

  private emit(event: SchedulerEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event)
      } catch (e) {
        console.error('[Scheduler] Event handler error:', e)
      }
    }
  }

  /**
   * Start the scheduler
   */
  start(): void {
    this.running = true
    this.scheduleNext()
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    this.running = false
  }

  /**
   * Get next nodes to execute
   */
  getNextNodes(maxCount: number = 5): string[] {
    // Get all ready nodes (dependencies satisfied)
    const ready = getReadyNodes(
      this.graph,
      this.completedNodes,
      this.runningNodes,
      this.failedNodes
    )

    // Filter out skipped and blocked
    const available = ready.filter(id =>
      !this.skippedNodes.has(id) &&
      !this.blockedNodes.has(id) &&
      !this.queuedNodes.includes(id)
    )

    if (available.length === 0) {
      return []
    }

    // Score and sort nodes
    const scored = available.map(id => ({
      id,
      score: this.calculateScore(id)
    })).sort((a, b) => b.score - a.score)

    // Select top N that have resources
    const selected: string[] = []

    for (const { id } of scored) {
      if (selected.length >= maxCount) break

      const node = this.graph.nodes.get(id)
      if (!node) continue

      // Check resources
      if (!this.resourceManager.hasAvailableSlots(node)) {
        // Queue instead of skip
        if (!this.queuedNodes.includes(id)) {
          this.queuedNodes.push(id)
          node.status = 'queued'
          this.emit({
            type: 'node-queued',
            timestamp: new Date().toISOString(),
            nodeId: id,
            message: 'Waiting for resources'
          })
        }
        continue
      }

      // Check artifact locks
      const lockCheck = canAcquireLocks(node, this.lockManager)
      if (!lockCheck.canAcquire) {
        if (!this.queuedNodes.includes(id)) {
          this.queuedNodes.push(id)
          node.status = 'queued'
          this.emit({
            type: 'node-queued',
            timestamp: new Date().toISOString(),
            nodeId: id,
            message: `Waiting for locks held by: ${lockCheck.blockedBy?.join(', ')}`
          })
        }
        continue
      }

      selected.push(id)
    }

    return selected
  }

  /**
   * Calculate priority score for a node
   */
  private calculateScore(nodeId: string): number {
    const node = this.graph.nodes.get(nodeId)
    if (!node) return 0

    let score = node.priority

    // Boost for critical path
    if (this.graph.metadata.criticalPath.includes(nodeId)) {
      score += this.config.priorityBoostForCriticalPath
    }

    // Boost for more dependents (unblocks more work)
    let dependentCount = 0
    for (const [, n] of this.graph.nodes) {
      if (n.dependencies.includes(nodeId)) {
        dependentCount++
      }
    }
    score += dependentCount * 5

    // Penalty for resource-intensive (prefer light tasks when contended)
    const utilization = this.resourceManager.getUtilization()
    if (utilization.overall.percentage > 70) {
      if (node.resourceRequirements.cpuIntensive) score -= 10
      if (node.resourceRequirements.memoryIntensive) score -= 10
      if (node.resourceRequirements.networkIntensive) score -= 5
    }

    // Prefer task_memory and capability (faster, no tokens)
    if (node.provider === 'task_memory') score += 15
    if (node.provider === 'capability') score += 10

    // Penalty for estimated long duration (when queue is building)
    if (this.queuedNodes.length > 3) {
      score -= Math.min(20, node.estimatedDurationMs / 5000)
    }

    return score
  }

  /**
   * Mark node as started
   */
  markRunning(nodeId: string): void {
    const node = this.graph.nodes.get(nodeId)
    if (node) {
      node.status = 'running'
      node.startedAt = new Date().toISOString()
    }

    this.runningNodes.add(nodeId)

    // Remove from queued
    const idx = this.queuedNodes.indexOf(nodeId)
    if (idx >= 0) {
      this.queuedNodes.splice(idx, 1)
    }

    this.emit({
      type: 'node-scheduled',
      timestamp: new Date().toISOString(),
      nodeId,
      message: 'Node started'
    })
  }

  /**
   * Mark node as completed
   */
  markCompleted(nodeId: string, validated: boolean = false): void {
    const node = this.graph.nodes.get(nodeId)
    if (node) {
      node.status = validated ? 'validated' : 'completed'
      node.completedAt = new Date().toISOString()
    }

    this.runningNodes.delete(nodeId)
    this.completedNodes.add(nodeId)

    // Release resources
    if (node) {
      this.resourceManager.release(node)
    }

    // Check if any queued nodes can now run
    this.processQueue()
  }

  /**
   * Mark node as failed
   */
  markFailed(nodeId: string, error: string): void {
    const node = this.graph.nodes.get(nodeId)
    if (node) {
      node.status = 'failed'
      node.error = error
      node.completedAt = new Date().toISOString()
    }

    this.runningNodes.delete(nodeId)
    this.failedNodes.add(nodeId)

    // Release resources
    if (node) {
      this.resourceManager.release(node)
    }

    // Block dependent nodes with hard dependencies
    this.blockDependents(nodeId)

    // Check if any queued nodes can now run
    this.processQueue()
  }

  /**
   * Mark node as validation failed
   */
  markValidationFailed(nodeId: string, reason: string): void {
    const node = this.graph.nodes.get(nodeId)
    if (node) {
      node.status = 'validation_failed'
      node.error = reason
      node.completedAt = new Date().toISOString()

      // If validation is critical, block dependents
      if (node.validationCritical) {
        this.blockDependents(nodeId)
      }
    }

    this.runningNodes.delete(nodeId)
    this.failedNodes.add(nodeId)

    // Release resources
    if (node) {
      this.resourceManager.release(node)
    }

    this.processQueue()
  }

  /**
   * Mark node as skipped
   */
  markSkipped(nodeId: string, reason: string): void {
    const node = this.graph.nodes.get(nodeId)
    if (node) {
      node.status = 'skipped'
      node.error = reason
    }

    this.skippedNodes.add(nodeId)

    // Don't block dependents - treat as success for dependency purposes
    this.completedNodes.add(nodeId)

    this.processQueue()
  }

  /**
   * Block nodes that depend on a failed node
   */
  private blockDependents(failedNodeId: string): void {
    for (const [id, node] of this.graph.nodes) {
      if (node.dependencies.includes(failedNodeId) && node.dependencyType === 'hard') {
        if (!this.completedNodes.has(id) &&
            !this.failedNodes.has(id) &&
            !this.blockedNodes.has(id)) {
          node.status = 'blocked'
          this.blockedNodes.add(id)

          this.emit({
            type: 'node-blocked',
            timestamp: new Date().toISOString(),
            nodeId: id,
            message: `Blocked due to failed dependency: ${failedNodeId}`
          })

          // Recursively block
          this.blockDependents(id)
        }
      }
    }
  }

  /**
   * Process queued nodes
   */
  private processQueue(): void {
    const toRemove: string[] = []

    for (const nodeId of this.queuedNodes) {
      const node = this.graph.nodes.get(nodeId)
      if (!node) {
        toRemove.push(nodeId)
        continue
      }

      // Check if dependencies still satisfied
      let blocked = false
      for (const depId of node.dependencies) {
        if (this.failedNodes.has(depId) && node.dependencyType === 'hard') {
          blocked = true
          break
        }
      }

      if (blocked) {
        node.status = 'blocked'
        this.blockedNodes.add(nodeId)
        toRemove.push(nodeId)
        continue
      }

      // Check resources
      if (this.resourceManager.hasAvailableSlots(node)) {
        const lockCheck = canAcquireLocks(node, this.lockManager)
        if (lockCheck.canAcquire) {
          toRemove.push(nodeId)
          this.emit({
            type: 'resources-available',
            timestamp: new Date().toISOString(),
            nodeId,
            message: 'Node can now be scheduled'
          })
        }
      }
    }

    // Remove processed from queue
    this.queuedNodes = this.queuedNodes.filter(id => !toRemove.includes(id))
  }

  /**
   * Schedule next batch of nodes
   */
  private scheduleNext(): void {
    if (!this.running) return

    this.emit({
      type: 'scheduler-tick',
      timestamp: new Date().toISOString()
    })

    // Get next nodes (will be handled by executor)
    // This is mainly for monitoring

    // Schedule next tick
    if (this.hasMoreWork()) {
      setTimeout(() => this.scheduleNext(), this.config.checkIntervalMs)
    }
  }

  /**
   * Check if there's more work to do
   */
  hasMoreWork(): boolean {
    const total = this.graph.nodes.size
    const done = this.completedNodes.size + this.failedNodes.size + this.blockedNodes.size + this.skippedNodes.size

    return done < total
  }

  /**
   * Check if execution is complete
   */
  isComplete(): boolean {
    return !this.hasMoreWork() && this.runningNodes.size === 0 && this.queuedNodes.length === 0
  }

  /**
   * Get current state
   */
  getState(): SchedulerState {
    const resourceSlots = new Map<ResourceSlotType, ResourceSlot[]>()
    const state = this.resourceManager.getState()
    for (const [type, slots] of state) {
      resourceSlots.set(type, [...slots])
    }

    return {
      pendingNodes: Array.from(this.graph.nodes.keys()).filter(id =>
        !this.completedNodes.has(id) &&
        !this.runningNodes.has(id) &&
        !this.failedNodes.has(id) &&
        !this.blockedNodes.has(id) &&
        !this.skippedNodes.has(id) &&
        !this.queuedNodes.includes(id)
      ),
      queuedNodes: [...this.queuedNodes],
      runningNodes: Array.from(this.runningNodes),
      completedNodes: Array.from(this.completedNodes),
      failedNodes: Array.from(this.failedNodes),
      blockedNodes: Array.from(this.blockedNodes),
      resourceSlots,
      artifactLocks: this.lockManager.getAllLocks()
    }
  }

  /**
   * Get stats
   */
  getStats(): {
    total: number
    completed: number
    failed: number
    blocked: number
    skipped: number
    running: number
    queued: number
    pending: number
    progress: number
  } {
    const total = this.graph.nodes.size
    const completed = this.completedNodes.size
    const failed = this.failedNodes.size
    const blocked = this.blockedNodes.size
    const skipped = this.skippedNodes.size
    const running = this.runningNodes.size
    const queued = this.queuedNodes.length
    const pending = total - completed - failed - blocked - skipped - running - queued

    return {
      total,
      completed,
      failed,
      blocked,
      skipped,
      running,
      queued,
      pending,
      progress: total > 0 ? ((completed + skipped) / total) * 100 : 0
    }
  }

  /**
   * Reset for retry
   */
  reset(): void {
    this.completedNodes.clear()
    this.runningNodes.clear()
    this.failedNodes.clear()
    this.blockedNodes.clear()
    this.queuedNodes = []
    this.skippedNodes.clear()

    for (const [, node] of this.graph.nodes) {
      node.status = 'pending'
      node.error = undefined
      node.result = undefined
      node.startedAt = undefined
      node.completedAt = undefined
      node.attempts = 0
    }
  }
}

/**
 * Create scheduler for a graph
 */
export function createScheduler(
  graph: ExecutionGraph,
  config?: Partial<SchedulerConfig>
): {
  scheduler: DAGScheduler
  resourceManager: ResourceManager
  lockManager: ArtifactLockManager
} {
  const finalConfig = { ...DEFAULT_SCHEDULER_CONFIG, ...config }
  const resourceManager = new ResourceManager(finalConfig.resourceLimits)
  const lockManager = new ArtifactLockManager({ defaultTimeoutMs: finalConfig.maxQueueWaitMs })
  const scheduler = new DAGScheduler(graph, resourceManager, lockManager, finalConfig)

  return { scheduler, resourceManager, lockManager }
}
