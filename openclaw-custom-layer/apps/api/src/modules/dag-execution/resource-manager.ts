/**
 * Resource Manager
 * FEATURE 131: DAG Execution Engine & Parallel Tasks
 * PHASE H1: Runtime Hardening & Platform Stabilization
 *
 * Controls concurrent resource usage to prevent system overload.
 * Manages slots for different resource types (local, openclaw, downloads, etc.)
 *
 * Enhanced with:
 * - Slot timeout/expiration
 * - Adaptive scaling based on load
 * - Stale resource detection
 * - Resource health monitoring
 */

import type {
  ResourceLimits,
  ResourceSlot,
  ResourceSlotType,
  WorkflowNode,
  ExecutionProvider
} from './types'
import { DEFAULT_RESOURCE_LIMITS } from './types'

/**
 * Resource slot with enhanced tracking
 */
interface EnhancedResourceSlot extends ResourceSlot {
  /** When the slot was acquired */
  acquiredAt?: string
  /** When the slot should expire */
  expiresAt?: string
  /** Last heartbeat from holder */
  lastHeartbeat?: string
  /** Holder metadata */
  holderMetadata?: Record<string, unknown>
}

/**
 * Resource health status
 */
export interface ResourceHealth {
  type: ResourceSlotType
  healthy: boolean
  totalSlots: number
  activeSlots: number
  staleSlots: number
  avgHoldTime: number
  lastActivity?: string
  issues: string[]
}

/**
 * Adaptive scaling configuration
 */
export interface AdaptiveScalingConfig {
  /** Enable adaptive scaling */
  enabled: boolean
  /** Minimum slots per type */
  minSlots: number
  /** Maximum slots per type */
  maxSlots: number
  /** Scale up when utilization exceeds this threshold */
  scaleUpThreshold: number
  /** Scale down when utilization falls below this threshold */
  scaleDownThreshold: number
  /** Cooldown between scaling operations (ms) */
  scaleCooldownMs: number
  /** Default slot timeout (ms) */
  defaultSlotTimeoutMs: number
  /** Stale threshold (ms without heartbeat) */
  staleThresholdMs: number
}

const DEFAULT_ADAPTIVE_CONFIG: AdaptiveScalingConfig = {
  enabled: false,
  minSlots: 1,
  maxSlots: 10,
  scaleUpThreshold: 0.8,
  scaleDownThreshold: 0.3,
  scaleCooldownMs: 30000,
  defaultSlotTimeoutMs: 300000, // 5 minutes
  staleThresholdMs: 60000 // 1 minute
}

/**
 * Resource event for monitoring
 */
export interface ResourceEvent {
  type: 'acquired' | 'released' | 'expired' | 'stale' | 'scaled' | 'contention'
  slotType: ResourceSlotType
  nodeId?: string
  timestamp: string
  details?: Record<string, unknown>
}

/**
 * Resource slot manager
 */
export class ResourceManager {
  private limits: ResourceLimits
  private slots: Map<ResourceSlotType, EnhancedResourceSlot[]>
  private waitQueues: Map<ResourceSlotType, Array<{
    nodeId: string
    resolve: (slot: ResourceSlot) => void
    reject: (reason: Error) => void
    queuedAt: string
    timeoutId?: ReturnType<typeof setTimeout>
  }>>
  private adaptiveConfig: AdaptiveScalingConfig
  private lastScaleTime: Map<ResourceSlotType, number>
  private staleCheckInterval: ReturnType<typeof setInterval> | null = null
  private eventListeners: Array<(event: ResourceEvent) => void> = []

  constructor(
    limits: ResourceLimits = DEFAULT_RESOURCE_LIMITS,
    adaptiveConfig: Partial<AdaptiveScalingConfig> = {}
  ) {
    this.limits = limits
    this.adaptiveConfig = { ...DEFAULT_ADAPTIVE_CONFIG, ...adaptiveConfig }
    this.slots = new Map()
    this.waitQueues = new Map()
    this.lastScaleTime = new Map()

    // Initialize slot pools
    this.initializeSlots()

    // Start stale check if adaptive is enabled
    if (this.adaptiveConfig.enabled) {
      this.startStaleCheck()
    }
  }

  private initializeSlots(): void {
    this.slots.set('local', this.createSlots('local', this.limits.maxParallelLocal))
    this.slots.set('openclaw', this.createSlots('openclaw', this.limits.maxParallelOpenClaw))
    this.slots.set('download', this.createSlots('download', this.limits.maxConcurrentDownloads))
    this.slots.set('install', this.createSlots('install', this.limits.maxConcurrentInstalls))
    this.slots.set('process', this.createSlots('process', this.limits.maxConcurrentProcesses))
  }

  private createSlots(type: ResourceSlotType, count: number): EnhancedResourceSlot[] {
    const slots: EnhancedResourceSlot[] = []
    for (let i = 0; i < count; i++) {
      slots.push({ type })
    }
    return slots
  }

  /**
   * Start periodic stale check
   */
  private startStaleCheck(): void {
    const checkIntervalMs = Math.min(this.adaptiveConfig.staleThresholdMs / 2, 30000)
    this.staleCheckInterval = setInterval(() => {
      this.checkAndCleanupStaleSlots()
      if (this.adaptiveConfig.enabled) {
        this.evaluateScaling()
      }
    }, checkIntervalMs)
  }

  /**
   * Stop stale check
   */
  stopStaleCheck(): void {
    if (this.staleCheckInterval) {
      clearInterval(this.staleCheckInterval)
      this.staleCheckInterval = null
    }
  }

  /**
   * Check for stale slots and clean them up
   */
  checkAndCleanupStaleSlots(): string[] {
    const now = Date.now()
    const staleNodeIds: string[] = []

    for (const [type, slots] of this.slots) {
      for (const slot of slots) {
        if (!slot.nodeId) continue

        // Check for expired slots
        if (slot.expiresAt && new Date(slot.expiresAt).getTime() < now) {
          this.emitEvent({
            type: 'expired',
            slotType: type,
            nodeId: slot.nodeId,
            timestamp: new Date().toISOString(),
            details: { acquiredAt: slot.acquiredAt, expiresAt: slot.expiresAt }
          })
          staleNodeIds.push(slot.nodeId)
          this.forceReleaseSlot(type, slot)
          continue
        }

        // Check for stale slots (no heartbeat)
        if (this.adaptiveConfig.enabled && slot.lastHeartbeat) {
          const lastHeartbeatTime = new Date(slot.lastHeartbeat).getTime()
          if (now - lastHeartbeatTime > this.adaptiveConfig.staleThresholdMs) {
            this.emitEvent({
              type: 'stale',
              slotType: type,
              nodeId: slot.nodeId,
              timestamp: new Date().toISOString(),
              details: { lastHeartbeat: slot.lastHeartbeat }
            })
            staleNodeIds.push(slot.nodeId)
            this.forceReleaseSlot(type, slot)
          }
        }
      }
    }

    if (staleNodeIds.length > 0) {
      this.processWaitQueues()
    }

    return staleNodeIds
  }

  /**
   * Force release a slot (for stale/expired cleanup)
   */
  private forceReleaseSlot(type: ResourceSlotType, slot: EnhancedResourceSlot): void {
    slot.nodeId = undefined
    slot.acquiredAt = undefined
    slot.expiresAt = undefined
    slot.lastHeartbeat = undefined
    slot.estimatedReleaseAt = undefined
    slot.holderMetadata = undefined
  }

  /**
   * Send heartbeat for a held slot
   */
  heartbeat(nodeId: string): void {
    const now = new Date().toISOString()
    for (const [, slots] of this.slots) {
      for (const slot of slots) {
        if (slot.nodeId === nodeId) {
          slot.lastHeartbeat = now
        }
      }
    }
  }

  /**
   * Evaluate and apply adaptive scaling
   */
  private evaluateScaling(): void {
    if (!this.adaptiveConfig.enabled) return

    const now = Date.now()

    for (const [type, slots] of this.slots) {
      const lastScale = this.lastScaleTime.get(type) || 0
      if (now - lastScale < this.adaptiveConfig.scaleCooldownMs) continue

      const used = slots.filter(s => s.nodeId).length
      const total = slots.length
      const utilization = total > 0 ? used / total : 0
      const queueSize = (this.waitQueues.get(type) || []).length

      // Scale up
      if (utilization >= this.adaptiveConfig.scaleUpThreshold || queueSize > 0) {
        if (total < this.adaptiveConfig.maxSlots) {
          const newSlots = Math.min(
            Math.ceil(total * 1.5),
            this.adaptiveConfig.maxSlots
          )
          this.scaleSlots(type, newSlots)
          this.lastScaleTime.set(type, now)
          this.emitEvent({
            type: 'scaled',
            slotType: type,
            timestamp: new Date().toISOString(),
            details: { from: total, to: newSlots, reason: 'scale-up', utilization }
          })
        }
      }
      // Scale down
      else if (utilization <= this.adaptiveConfig.scaleDownThreshold && queueSize === 0) {
        if (total > this.adaptiveConfig.minSlots) {
          const unusedSlots = slots.filter(s => !s.nodeId).length
          const targetSlots = Math.max(
            total - Math.floor(unusedSlots / 2),
            this.adaptiveConfig.minSlots
          )
          if (targetSlots < total) {
            this.scaleSlots(type, targetSlots)
            this.lastScaleTime.set(type, now)
            this.emitEvent({
              type: 'scaled',
              slotType: type,
              timestamp: new Date().toISOString(),
              details: { from: total, to: targetSlots, reason: 'scale-down', utilization }
            })
          }
        }
      }
    }
  }

  /**
   * Scale slots for a type
   */
  private scaleSlots(type: ResourceSlotType, targetCount: number): void {
    const slots = this.slots.get(type) || []

    if (targetCount > slots.length) {
      // Add slots
      while (slots.length < targetCount) {
        slots.push({ type })
      }
    } else if (targetCount < slots.length) {
      // Remove only unused slots
      const unused = slots.filter(s => !s.nodeId)
      const toRemove = slots.length - targetCount
      for (let i = 0; i < toRemove && unused.length > 0; i++) {
        const slotToRemove = unused.pop()
        if (slotToRemove) {
          const idx = slots.indexOf(slotToRemove)
          if (idx !== -1) slots.splice(idx, 1)
        }
      }
    }

    this.slots.set(type, slots)
  }

  /**
   * Subscribe to resource events
   */
  onEvent(listener: (event: ResourceEvent) => void): () => void {
    this.eventListeners.push(listener)
    return () => {
      const idx = this.eventListeners.indexOf(listener)
      if (idx !== -1) this.eventListeners.splice(idx, 1)
    }
  }

  /**
   * Emit a resource event
   */
  private emitEvent(event: ResourceEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event)
      } catch (err) {
        console.error('[ResourceManager] Event listener error:', err)
      }
    }
  }

  /**
   * Get health status for all resource types
   */
  getHealth(): ResourceHealth[] {
    const health: ResourceHealth[] = []
    const now = Date.now()

    for (const [type, slots] of this.slots) {
      const activeSlots = slots.filter(s => s.nodeId)
      const staleSlots = activeSlots.filter(s => {
        if (!s.lastHeartbeat) return false
        return now - new Date(s.lastHeartbeat).getTime() > this.adaptiveConfig.staleThresholdMs
      })

      let totalHoldTime = 0
      let holdCount = 0
      let lastActivity: string | undefined

      for (const slot of activeSlots) {
        if (slot.acquiredAt) {
          totalHoldTime += now - new Date(slot.acquiredAt).getTime()
          holdCount++
          if (!lastActivity || slot.acquiredAt > lastActivity) {
            lastActivity = slot.acquiredAt
          }
        }
      }

      const issues: string[] = []
      if (staleSlots.length > 0) {
        issues.push(`${staleSlots.length} stale slots detected`)
      }
      if (activeSlots.length === slots.length) {
        issues.push('All slots in use')
      }
      const queueSize = (this.waitQueues.get(type) || []).length
      if (queueSize > 0) {
        issues.push(`${queueSize} nodes waiting`)
      }

      health.push({
        type,
        healthy: issues.length === 0,
        totalSlots: slots.length,
        activeSlots: activeSlots.length,
        staleSlots: staleSlots.length,
        avgHoldTime: holdCount > 0 ? totalHoldTime / holdCount : 0,
        lastActivity,
        issues
      })
    }

    return health
  }

  /**
   * Set adaptive configuration
   */
  setAdaptiveConfig(config: Partial<AdaptiveScalingConfig>): void {
    const wasEnabled = this.adaptiveConfig.enabled
    this.adaptiveConfig = { ...this.adaptiveConfig, ...config }

    if (this.adaptiveConfig.enabled && !wasEnabled) {
      this.startStaleCheck()
    } else if (!this.adaptiveConfig.enabled && wasEnabled) {
      this.stopStaleCheck()
    }
  }

  /**
   * Get adaptive configuration
   */
  getAdaptiveConfig(): AdaptiveScalingConfig {
    return { ...this.adaptiveConfig }
  }

  /**
   * Get resource slot type for a node
   */
  getSlotType(node: WorkflowNode): ResourceSlotType {
    // Primary slot type based on provider
    switch (node.provider) {
      case 'openclaw':
        return 'openclaw'
      case 'local':
      case 'capability':
      case 'task_memory':
        return 'local'
      default:
        return 'local'
    }
  }

  /**
   * Get additional slot types needed by action
   */
  getAdditionalSlotTypes(node: WorkflowNode): ResourceSlotType[] {
    const additional: ResourceSlotType[] = []

    switch (node.actionType) {
      case 'download_file':
        additional.push('download')
        break
      case 'install_app':
      case 'uninstall_app':
        additional.push('install')
        break
      case 'open_app':
        additional.push('process')
        break
    }

    return additional
  }

  /**
   * Check if slots are available for a node
   */
  hasAvailableSlots(node: WorkflowNode): boolean {
    const primaryType = this.getSlotType(node)
    const additionalTypes = this.getAdditionalSlotTypes(node)
    const allTypes = [primaryType, ...additionalTypes]

    // Check global limit
    const totalRunning = this.getTotalRunning()
    if (totalRunning >= this.limits.globalConcurrencyLimit) {
      return false
    }

    // Check each slot type
    for (const type of allTypes) {
      if (!this.hasAvailableSlot(type)) {
        return false
      }
    }

    return true
  }

  private hasAvailableSlot(type: ResourceSlotType): boolean {
    const slots = this.slots.get(type) || []
    return slots.some(s => !s.nodeId)
  }

  /**
   * Try to acquire slots for a node
   */
  tryAcquire(node: WorkflowNode): boolean {
    if (!this.hasAvailableSlots(node)) {
      return false
    }

    const primaryType = this.getSlotType(node)
    const additionalTypes = this.getAdditionalSlotTypes(node)
    const allTypes = [primaryType, ...additionalTypes]

    // Acquire all needed slots
    const acquired: Array<{ type: ResourceSlotType; slot: ResourceSlot }> = []

    for (const type of allTypes) {
      const slot = this.acquireSlot(type, node.id)
      if (!slot) {
        // Rollback
        for (const { type: t, slot: s } of acquired) {
          this.releaseSlot(t, s, node.id)
        }
        return false
      }
      acquired.push({ type, slot })
    }

    return true
  }

  private acquireSlot(type: ResourceSlotType, nodeId: string): EnhancedResourceSlot | null {
    const slots = this.slots.get(type)
    if (!slots) return null

    const available = slots.find(s => !s.nodeId)
    if (!available) return null

    const now = new Date()
    available.nodeId = nodeId
    available.acquiredAt = now.toISOString()
    available.lastHeartbeat = now.toISOString()

    // Set expiration if configured
    if (this.adaptiveConfig.defaultSlotTimeoutMs > 0) {
      available.expiresAt = new Date(now.getTime() + this.adaptiveConfig.defaultSlotTimeoutMs).toISOString()
    }

    this.emitEvent({
      type: 'acquired',
      slotType: type,
      nodeId,
      timestamp: now.toISOString()
    })

    return available
  }

  /**
   * Acquire slots with waiting
   */
  async acquire(node: WorkflowNode): Promise<void> {
    if (this.tryAcquire(node)) {
      return
    }

    // Wait for slots
    const primaryType = this.getSlotType(node)

    return new Promise((resolve, reject) => {
      if (!this.waitQueues.has(primaryType)) {
        this.waitQueues.set(primaryType, [])
      }

      const queue = this.waitQueues.get(primaryType)!

      queue.push({
        nodeId: node.id,
        queuedAt: new Date().toISOString(),
        resolve: () => {
          // Try to acquire again
          if (this.tryAcquire(node)) {
            resolve()
          } else {
            // Re-queue
            this.acquire(node).then(resolve).catch(reject)
          }
        },
        reject
      })
    })
  }

  /**
   * Release all slots held by a node
   */
  release(node: WorkflowNode): void {
    const primaryType = this.getSlotType(node)
    const additionalTypes = this.getAdditionalSlotTypes(node)
    const allTypes = [primaryType, ...additionalTypes]

    for (const type of allTypes) {
      const slots = this.slots.get(type) || []
      const slot = slots.find(s => s.nodeId === node.id)
      if (slot) {
        this.releaseSlot(type, slot, node.id)
      }
    }

    // Process wait queues
    this.processWaitQueues()
  }

  private releaseSlot(type: ResourceSlotType, slot: EnhancedResourceSlot, nodeId: string): void {
    if (slot.nodeId === nodeId) {
      this.emitEvent({
        type: 'released',
        slotType: type,
        nodeId,
        timestamp: new Date().toISOString(),
        details: { acquiredAt: slot.acquiredAt }
      })

      slot.nodeId = undefined
      slot.acquiredAt = undefined
      slot.expiresAt = undefined
      slot.lastHeartbeat = undefined
      slot.estimatedReleaseAt = undefined
      slot.holderMetadata = undefined
    }
  }

  private processWaitQueues(): void {
    for (const [type, queue] of this.waitQueues) {
      if (queue.length > 0 && this.hasAvailableSlot(type)) {
        const next = queue.shift()
        if (next) {
          next.resolve({} as ResourceSlot)  // Resolve triggers re-acquire
        }
      }
    }
  }

  /**
   * Get total number of running nodes
   */
  getTotalRunning(): number {
    let total = 0
    for (const [, slots] of this.slots) {
      total += slots.filter(s => s.nodeId).length
    }
    // Avoid double counting
    const uniqueNodes = new Set<string>()
    for (const [, slots] of this.slots) {
      for (const slot of slots) {
        if (slot.nodeId) {
          uniqueNodes.add(slot.nodeId)
        }
      }
    }
    return uniqueNodes.size
  }

  /**
   * Get running count by slot type
   */
  getRunningByType(type: ResourceSlotType): number {
    const slots = this.slots.get(type) || []
    return slots.filter(s => s.nodeId).length
  }

  /**
   * Get available count by slot type
   */
  getAvailableByType(type: ResourceSlotType): number {
    const slots = this.slots.get(type) || []
    return slots.filter(s => !s.nodeId).length
  }

  /**
   * Get current state snapshot
   */
  getState(): Map<ResourceSlotType, ResourceSlot[]> {
    return new Map(this.slots)
  }

  /**
   * Get queue sizes
   */
  getQueueSizes(): Map<ResourceSlotType, number> {
    const sizes = new Map<ResourceSlotType, number>()
    for (const [type, queue] of this.waitQueues) {
      sizes.set(type, queue.length)
    }
    return sizes
  }

  /**
   * Update limits at runtime
   */
  updateLimits(newLimits: Partial<ResourceLimits>): void {
    this.limits = { ...this.limits, ...newLimits }

    // Resize slot pools (only expand, don't shrink active)
    const typeToLimit: Record<ResourceSlotType, keyof ResourceLimits> = {
      'local': 'maxParallelLocal',
      'openclaw': 'maxParallelOpenClaw',
      'download': 'maxConcurrentDownloads',
      'install': 'maxConcurrentInstalls',
      'process': 'maxConcurrentProcesses'
    }

    for (const [type, limitKey] of Object.entries(typeToLimit)) {
      const newLimit = this.limits[limitKey as keyof ResourceLimits] as number
      const slots = this.slots.get(type as ResourceSlotType) || []

      while (slots.length < newLimit) {
        slots.push({ type: type as ResourceSlotType })
      }
    }
  }

  /**
   * Get current limits
   */
  getLimits(): ResourceLimits {
    return { ...this.limits }
  }

  /**
   * Clear all (for reset)
   */
  clear(): void {
    // Reject all waiting
    for (const [, queue] of this.waitQueues) {
      for (const waiter of queue) {
        waiter.reject(new Error('Resource manager cleared'))
      }
    }

    this.waitQueues.clear()
    this.initializeSlots()
  }

  /**
   * Get utilization stats
   */
  getUtilization(): {
    byType: Map<ResourceSlotType, { used: number; total: number; percentage: number }>
    overall: { used: number; total: number; percentage: number }
  } {
    const byType = new Map<ResourceSlotType, { used: number; total: number; percentage: number }>()
    let totalUsed = 0
    let totalSlots = 0

    for (const [type, slots] of this.slots) {
      const used = slots.filter(s => s.nodeId).length
      const total = slots.length
      const percentage = total > 0 ? (used / total) * 100 : 0

      byType.set(type, { used, total, percentage })
      totalUsed += used
      totalSlots += total
    }

    return {
      byType,
      overall: {
        used: totalUsed,
        total: totalSlots,
        percentage: totalSlots > 0 ? (totalUsed / totalSlots) * 100 : 0
      }
    }
  }
}

/**
 * Check if node would cause resource contention
 */
export function wouldCauseContention(
  node: WorkflowNode,
  resourceManager: ResourceManager,
  threshold: number = 0.8
): boolean {
  const utilization = resourceManager.getUtilization()
  return utilization.overall.percentage > threshold * 100
}

/**
 * Estimate wait time for a node
 */
export function estimateWaitTime(
  node: WorkflowNode,
  resourceManager: ResourceManager
): number {
  const queueSizes = resourceManager.getQueueSizes()
  const slotType = resourceManager.getSlotType(node)
  const queueSize = queueSizes.get(slotType) || 0

  // Rough estimate: average node takes 30 seconds
  const avgNodeDuration = 30000
  const running = resourceManager.getRunningByType(slotType)
  const limit = resourceManager.getLimits()[
    slotType === 'openclaw' ? 'maxParallelOpenClaw' :
    slotType === 'download' ? 'maxConcurrentDownloads' :
    slotType === 'install' ? 'maxConcurrentInstalls' :
    'maxParallelLocal'
  ]

  if (running < limit) {
    return 0  // Can start immediately
  }

  // Estimate based on queue position and throughput
  const throughput = limit / avgNodeDuration  // Nodes per ms
  const waitMs = queueSize / throughput

  return Math.round(waitMs)
}
