/**
 * Artifact Locks
 * FEATURE 131: DAG Execution Engine & Parallel Tasks
 * PHASE H1: Runtime Hardening & Platform Stabilization
 *
 * Manages locks on artifacts to prevent conflicting parallel operations.
 * Ensures safe concurrent execution by serializing access to shared resources.
 *
 * Enhanced with:
 * - Lock expiration with automatic cleanup
 * - Enhanced lock types with priority
 * - Deadlock detection
 * - Lock events for observability
 * - Lock health monitoring
 */

import type { ArtifactLock, WorkflowNode, ExecutionGraph, ConflictAnalysis } from './types'

/**
 * Enhanced artifact lock with expiration
 */
interface EnhancedArtifactLock extends ArtifactLock {
  /** When the lock expires */
  expiresAt?: string
  /** Last heartbeat from holder */
  lastHeartbeat?: string
  /** Priority of the lock (lower = higher priority) */
  priority?: number
  /** Metadata about the lock holder */
  holderMetadata?: Record<string, unknown>
}

/**
 * Lock event for observability
 */
export interface LockEvent {
  type: 'acquired' | 'released' | 'expired' | 'waiting' | 'timeout' | 'deadlock'
  artifactId: string
  nodeId?: string
  lockType?: 'read' | 'write' | 'exclusive'
  timestamp: string
  details?: Record<string, unknown>
}

/**
 * Lock health status
 */
export interface LockHealth {
  totalLocks: number
  totalWaiting: number
  staleLocks: number
  avgHoldTime: number
  longestHoldTime: number
  potentialDeadlocks: Array<{ artifacts: string[]; nodes: string[] }>
  issues: string[]
}

/**
 * Lock configuration
 */
export interface LockConfig {
  /** Default lock timeout in ms */
  defaultTimeoutMs: number
  /** Lock expiration time in ms */
  lockExpirationMs: number
  /** Stale threshold in ms (no heartbeat) */
  staleThresholdMs: number
  /** Enable automatic stale cleanup */
  enableAutoCleanup: boolean
  /** Cleanup interval in ms */
  cleanupIntervalMs: number
}

const DEFAULT_LOCK_CONFIG: LockConfig = {
  defaultTimeoutMs: 60000,
  lockExpirationMs: 300000, // 5 minutes
  staleThresholdMs: 60000, // 1 minute
  enableAutoCleanup: true,
  cleanupIntervalMs: 30000
}

/**
 * Lock manager for artifacts
 */
export class ArtifactLockManager {
  private locks: Map<string, EnhancedArtifactLock> = new Map()
  private waitQueue: Map<string, Array<{
    nodeId: string
    lockType: 'read' | 'write' | 'exclusive'
    priority: number
    queuedAt: string
    resolve: () => void
    reject: (reason: Error) => void
    timeoutId?: ReturnType<typeof setTimeout>
  }>> = new Map()
  private config: LockConfig
  private eventListeners: Array<(event: LockEvent) => void> = []
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor(config: Partial<LockConfig> = {}) {
    this.config = { ...DEFAULT_LOCK_CONFIG, ...config }

    if (this.config.enableAutoCleanup) {
      this.startAutoCleanup()
    }
  }

  /**
   * Start automatic cleanup of stale/expired locks
   */
  private startAutoCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleLocks()
    }, this.config.cleanupIntervalMs)
  }

  /**
   * Stop automatic cleanup
   */
  stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * Cleanup stale and expired locks
   */
  cleanupStaleLocks(): string[] {
    const now = Date.now()
    const cleanedArtifacts: string[] = []

    for (const [artifactId, lock] of this.locks) {
      let shouldClean = false
      let reason = ''

      // Check expiration
      if (lock.expiresAt && new Date(lock.expiresAt).getTime() < now) {
        shouldClean = true
        reason = 'expired'
      }

      // Check stale (no heartbeat)
      if (!shouldClean && lock.lastHeartbeat) {
        const lastHeartbeatTime = new Date(lock.lastHeartbeat).getTime()
        if (now - lastHeartbeatTime > this.config.staleThresholdMs) {
          shouldClean = true
          reason = 'stale'
        }
      }

      if (shouldClean) {
        this.emitEvent({
          type: 'expired',
          artifactId,
          nodeId: lock.nodeId,
          lockType: lock.lockType,
          timestamp: new Date().toISOString(),
          details: { reason, acquiredAt: lock.acquiredAt }
        })

        this.locks.delete(artifactId)
        cleanedArtifacts.push(artifactId)

        // Process wait queue for this artifact
        this.processWaitQueue(artifactId)
      }
    }

    return cleanedArtifacts
  }

  /**
   * Send heartbeat for locks held by a node
   */
  heartbeat(nodeId: string): void {
    const now = new Date().toISOString()
    for (const [, lock] of this.locks) {
      if (lock.nodeId === nodeId) {
        lock.lastHeartbeat = now
        // Extend expiration
        if (lock.expiresAt) {
          lock.expiresAt = new Date(Date.now() + this.config.lockExpirationMs).toISOString()
        }
      }
    }
  }

  /**
   * Subscribe to lock events
   */
  onEvent(listener: (event: LockEvent) => void): () => void {
    this.eventListeners.push(listener)
    return () => {
      const idx = this.eventListeners.indexOf(listener)
      if (idx !== -1) this.eventListeners.splice(idx, 1)
    }
  }

  /**
   * Emit a lock event
   */
  private emitEvent(event: LockEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event)
      } catch (err) {
        console.error('[ArtifactLocks] Event listener error:', err)
      }
    }
  }

  /**
   * Process wait queue for an artifact after lock release
   */
  private processWaitQueue(artifactId: string): void {
    const queue = this.waitQueue.get(artifactId)
    if (!queue || queue.length === 0) return

    // Sort by priority (lower = higher priority)
    queue.sort((a, b) => a.priority - b.priority)

    const next = queue.shift()
    if (next) {
      if (next.timeoutId) {
        clearTimeout(next.timeoutId)
      }
      next.resolve()
    }
  }

  /**
   * Get lock health status
   */
  getHealth(): LockHealth {
    const now = Date.now()
    let staleLocks = 0
    let totalHoldTime = 0
    let longestHoldTime = 0
    let holdCount = 0
    const issues: string[] = []

    // Analyze locks
    for (const [, lock] of this.locks) {
      if (lock.acquiredAt) {
        const holdTime = now - new Date(lock.acquiredAt).getTime()
        totalHoldTime += holdTime
        holdCount++
        if (holdTime > longestHoldTime) {
          longestHoldTime = holdTime
        }
      }

      if (lock.lastHeartbeat) {
        const lastHeartbeatTime = new Date(lock.lastHeartbeat).getTime()
        if (now - lastHeartbeatTime > this.config.staleThresholdMs) {
          staleLocks++
        }
      }
    }

    // Detect potential deadlocks
    const potentialDeadlocks = this.detectDeadlocks()

    // Count waiting
    let totalWaiting = 0
    for (const [artifactId, queue] of this.waitQueue) {
      totalWaiting += queue.length

      // Check for long waits
      for (const waiter of queue) {
        const waitTime = now - new Date(waiter.queuedAt).getTime()
        if (waitTime > this.config.defaultTimeoutMs / 2) {
          issues.push(`Long wait for ${artifactId}: ${waiter.nodeId} waiting ${Math.round(waitTime / 1000)}s`)
        }
      }
    }

    if (staleLocks > 0) {
      issues.push(`${staleLocks} stale locks detected`)
    }

    if (potentialDeadlocks.length > 0) {
      issues.push(`${potentialDeadlocks.length} potential deadlocks detected`)
    }

    return {
      totalLocks: this.locks.size,
      totalWaiting,
      staleLocks,
      avgHoldTime: holdCount > 0 ? totalHoldTime / holdCount : 0,
      longestHoldTime,
      potentialDeadlocks,
      issues
    }
  }

  /**
   * Detect potential deadlocks (cycles in wait graph)
   */
  detectDeadlocks(): Array<{ artifacts: string[]; nodes: string[] }> {
    const deadlocks: Array<{ artifacts: string[]; nodes: string[] }> = []

    // Build wait-for graph: nodeA waits for nodeB
    const waitFor: Map<string, Set<string>> = new Map()

    for (const [artifactId, queue] of this.waitQueue) {
      const holder = this.getLockHolder(artifactId)
      if (!holder) continue

      for (const waiter of queue) {
        if (!waitFor.has(waiter.nodeId)) {
          waitFor.set(waiter.nodeId, new Set())
        }
        waitFor.get(waiter.nodeId)!.add(holder)
      }
    }

    // Find cycles using DFS
    const visited = new Set<string>()
    const inStack = new Set<string>()
    const path: string[] = []

    const dfs = (node: string): boolean => {
      if (inStack.has(node)) {
        // Found cycle
        const cycleStart = path.indexOf(node)
        const cycleNodes = path.slice(cycleStart)
        cycleNodes.push(node)

        // Find artifacts involved
        const artifacts: string[] = []
        for (const [artifactId, lock] of this.locks) {
          if (cycleNodes.includes(lock.nodeId)) {
            artifacts.push(artifactId)
          }
        }

        deadlocks.push({ artifacts, nodes: cycleNodes })
        return true
      }

      if (visited.has(node)) return false

      visited.add(node)
      inStack.add(node)
      path.push(node)

      const dependencies = waitFor.get(node)
      if (dependencies) {
        for (const dep of dependencies) {
          if (dfs(dep)) {
            inStack.delete(node)
            path.pop()
            return true
          }
        }
      }

      inStack.delete(node)
      path.pop()
      return false
    }

    for (const node of waitFor.keys()) {
      dfs(node)
    }

    return deadlocks
  }

  /**
   * Set configuration
   */
  setConfig(config: Partial<LockConfig>): void {
    const wasAutoCleanup = this.config.enableAutoCleanup
    this.config = { ...this.config, ...config }

    if (this.config.enableAutoCleanup && !wasAutoCleanup) {
      this.startAutoCleanup()
    } else if (!this.config.enableAutoCleanup && wasAutoCleanup) {
      this.stopAutoCleanup()
    }
  }

  /**
   * Get configuration
   */
  getConfig(): LockConfig {
    return { ...this.config }
  }

  /**
   * Try to acquire a lock
   */
  tryAcquire(
    artifactId: string,
    nodeId: string,
    lockType: 'read' | 'write' | 'exclusive',
    priority: number = 5
  ): boolean {
    const existing = this.locks.get(artifactId)
    const now = new Date()

    if (!existing) {
      // No lock exists, acquire it
      this.locks.set(artifactId, {
        artifactId,
        nodeId,
        lockType,
        acquiredAt: now.toISOString(),
        lastHeartbeat: now.toISOString(),
        expiresAt: new Date(now.getTime() + this.config.lockExpirationMs).toISOString(),
        priority
      })

      this.emitEvent({
        type: 'acquired',
        artifactId,
        nodeId,
        lockType,
        timestamp: now.toISOString()
      })

      return true
    }

    // Check compatibility
    if (existing.nodeId === nodeId) {
      // Same node, allow upgrade
      if (lockType === 'exclusive' || lockType === 'write') {
        existing.lockType = lockType
      }
      // Refresh heartbeat
      existing.lastHeartbeat = now.toISOString()
      return true
    }

    // Read locks can coexist
    if (existing.lockType === 'read' && lockType === 'read') {
      return true
    }

    // All other combinations require waiting
    return false
  }

  /**
   * Acquire a lock, waiting if necessary
   */
  async acquire(
    artifactId: string,
    nodeId: string,
    lockType: 'read' | 'write' | 'exclusive',
    priority: number = 5
  ): Promise<void> {
    if (this.tryAcquire(artifactId, nodeId, lockType, priority)) {
      return
    }

    const queuedAt = new Date().toISOString()

    this.emitEvent({
      type: 'waiting',
      artifactId,
      nodeId,
      lockType,
      timestamp: queuedAt,
      details: { holder: this.getLockHolder(artifactId) }
    })

    // Add to wait queue
    return new Promise((resolve, reject) => {
      if (!this.waitQueue.has(artifactId)) {
        this.waitQueue.set(artifactId, [])
      }

      const queue = this.waitQueue.get(artifactId)!

      const timeoutId = setTimeout(() => {
        // Remove from queue
        const idx = queue.findIndex(w => w.nodeId === nodeId)
        if (idx >= 0) {
          queue.splice(idx, 1)
        }

        this.emitEvent({
          type: 'timeout',
          artifactId,
          nodeId,
          lockType,
          timestamp: new Date().toISOString(),
          details: { waitTime: Date.now() - new Date(queuedAt).getTime() }
        })

        reject(new Error(`Lock acquisition timeout for artifact: ${artifactId}`))
      }, this.config.defaultTimeoutMs)

      queue.push({
        nodeId,
        lockType,
        priority,
        queuedAt,
        timeoutId,
        resolve: () => {
          clearTimeout(timeoutId)
          const now = new Date()
          this.locks.set(artifactId, {
            artifactId,
            nodeId,
            lockType,
            acquiredAt: now.toISOString(),
            lastHeartbeat: now.toISOString(),
            expiresAt: new Date(now.getTime() + this.config.lockExpirationMs).toISOString(),
            priority
          })

          this.emitEvent({
            type: 'acquired',
            artifactId,
            nodeId,
            lockType,
            timestamp: now.toISOString(),
            details: { waitTime: now.getTime() - new Date(queuedAt).getTime() }
          })

          resolve()
        },
        reject: (reason: Error) => {
          clearTimeout(timeoutId)
          reject(reason)
        }
      })
    })
  }

  /**
   * Release a lock
   */
  release(artifactId: string, nodeId: string): void {
    const lock = this.locks.get(artifactId)

    if (!lock || lock.nodeId !== nodeId) {
      console.warn(`[ArtifactLocks] Attempted to release lock not held: ${artifactId} by ${nodeId}`)
      return
    }

    this.emitEvent({
      type: 'released',
      artifactId,
      nodeId,
      lockType: lock.lockType,
      timestamp: new Date().toISOString(),
      details: {
        acquiredAt: lock.acquiredAt,
        holdTime: lock.acquiredAt ? Date.now() - new Date(lock.acquiredAt).getTime() : 0
      }
    })

    this.locks.delete(artifactId)

    // Process wait queue
    this.processWaitQueue(artifactId)
  }

  /**
   * Release all locks held by a node
   */
  releaseAll(nodeId: string): void {
    for (const [artifactId, lock] of this.locks) {
      if (lock.nodeId === nodeId) {
        this.release(artifactId, nodeId)
      }
    }
  }

  /**
   * Check if a node holds a lock
   */
  holdsLock(artifactId: string, nodeId: string): boolean {
    const lock = this.locks.get(artifactId)
    return lock?.nodeId === nodeId
  }

  /**
   * Get all current locks
   */
  getAllLocks(): ArtifactLock[] {
    return Array.from(this.locks.values())
  }

  /**
   * Get locks held by a node
   */
  getLocksForNode(nodeId: string): ArtifactLock[] {
    return Array.from(this.locks.values()).filter(l => l.nodeId === nodeId)
  }

  /**
   * Check if artifact is locked
   */
  isLocked(artifactId: string): boolean {
    return this.locks.has(artifactId)
  }

  /**
   * Get lock holder for artifact
   */
  getLockHolder(artifactId: string): string | undefined {
    return this.locks.get(artifactId)?.nodeId
  }

  /**
   * Clear all locks (for cleanup/reset)
   */
  clear(): void {
    // Reject all waiting
    for (const [, queue] of this.waitQueue) {
      for (const waiter of queue) {
        waiter.reject(new Error('Lock manager cleared'))
      }
    }

    this.locks.clear()
    this.waitQueue.clear()
  }
}

/**
 * Generate artifact IDs for a node
 */
export function getArtifactIds(node: WorkflowNode): string[] {
  const artifacts: string[] = []

  // From resource requirements
  if (node.resourceRequirements.requiresExclusiveArtifact) {
    artifacts.push(...node.resourceRequirements.requiresExclusiveArtifact)
  }

  // Infer from action type and target
  if (node.targetEntity) {
    const target = node.targetEntity.toLowerCase()

    switch (node.actionType) {
      case 'install_app':
      case 'uninstall_app':
        artifacts.push(`app:${target}`)
        artifacts.push(`install:${target}`)
        break
      case 'download_file':
        artifacts.push(`download:${target}`)
        break
      case 'open_app':
      case 'close_app':
        artifacts.push(`process:${target}`)
        break
      case 'create_file':
      case 'edit_file':
      case 'delete_file':
      case 'copy_file':
      case 'move_file':
        artifacts.push(`file:${target}`)
        break
    }
  }

  return [...new Set(artifacts)]  // Dedupe
}

/**
 * Determine lock type needed for action
 */
export function getLockType(node: WorkflowNode): 'read' | 'write' | 'exclusive' {
  switch (node.actionType) {
    case 'install_app':
    case 'uninstall_app':
    case 'delete_file':
    case 'move_file':
      return 'exclusive'

    case 'create_file':
    case 'edit_file':
    case 'download_file':
    case 'copy_file':
      return 'write'

    case 'open_app':
    case 'search_file':
      return 'read'

    default:
      return 'read'
  }
}

/**
 * Analyze conflicts between nodes in a graph
 */
export function analyzeConflicts(graph: ExecutionGraph): ConflictAnalysis {
  const conflicts: ConflictAnalysis['conflicts'] = []
  const nodeIds = Array.from(graph.nodes.keys())

  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = i + 1; j < nodeIds.length; j++) {
      const nodeA = graph.nodes.get(nodeIds[i])!
      const nodeB = graph.nodes.get(nodeIds[j])!

      // Skip if one depends on the other
      if (nodeA.dependencies.includes(nodeIds[j]) ||
          nodeB.dependencies.includes(nodeIds[i])) {
        continue
      }

      // Check artifact conflicts
      const artifactsA = getArtifactIds(nodeA)
      const artifactsB = getArtifactIds(nodeB)

      for (const artifactA of artifactsA) {
        if (artifactsB.includes(artifactA)) {
          const lockTypeA = getLockType(nodeA)
          const lockTypeB = getLockType(nodeB)

          // Read-read is OK
          if (lockTypeA === 'read' && lockTypeB === 'read') {
            continue
          }

          // Conflict found
          conflicts.push({
            nodeA: nodeIds[i],
            nodeB: nodeIds[j],
            conflictType: 'artifact',
            artifactId: artifactA,
            resolution: lockTypeA === 'exclusive' || lockTypeB === 'exclusive' ? 'serialize' : 'queue'
          })
        }
      }

      // Check provider conflicts (OpenClaw saturation)
      if (nodeA.provider === 'openclaw' && nodeB.provider === 'openclaw') {
        // Not a hard conflict, but may need queueing
        conflicts.push({
          nodeA: nodeIds[i],
          nodeB: nodeIds[j],
          conflictType: 'provider',
          resolution: 'queue'
        })
      }

      // Check resource conflicts
      if (nodeA.resourceRequirements.cpuIntensive && nodeB.resourceRequirements.cpuIntensive) {
        conflicts.push({
          nodeA: nodeIds[i],
          nodeB: nodeIds[j],
          conflictType: 'resource',
          resolution: 'queue'
        })
      }
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts
  }
}

/**
 * Acquire all locks needed for a node
 */
export async function acquireNodeLocks(
  node: WorkflowNode,
  lockManager: ArtifactLockManager
): Promise<void> {
  const artifacts = getArtifactIds(node)
  const lockType = getLockType(node)

  for (const artifactId of artifacts) {
    await lockManager.acquire(artifactId, node.id, lockType)
  }
}

/**
 * Release all locks held by a node
 */
export function releaseNodeLocks(
  node: WorkflowNode,
  lockManager: ArtifactLockManager
): void {
  lockManager.releaseAll(node.id)
}

/**
 * Check if a node can acquire its locks immediately
 */
export function canAcquireLocks(
  node: WorkflowNode,
  lockManager: ArtifactLockManager
): { canAcquire: boolean; blockedBy?: string[] } {
  const artifacts = getArtifactIds(node)
  const lockType = getLockType(node)
  const blockedBy: string[] = []

  for (const artifactId of artifacts) {
    if (!lockManager.tryAcquire(artifactId, node.id, lockType)) {
      const holder = lockManager.getLockHolder(artifactId)
      if (holder && holder !== node.id) {
        blockedBy.push(holder)
      }
    }
  }

  return {
    canAcquire: blockedBy.length === 0,
    blockedBy: blockedBy.length > 0 ? blockedBy : undefined
  }
}
