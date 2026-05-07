/**
 * DAG Execution Types
 * FEATURE 131: DAG Execution Engine & Parallel Tasks
 *
 * Types for directed acyclic graph execution, parallel task scheduling,
 * dependency management, and resource control.
 */

import type { TaskActionType } from '../task-memory/types'
import type { CompositeTaskStep } from '../composite-tasks/types'

/**
 * Execution provider types
 */
export type ExecutionProvider = 'local' | 'openclaw' | 'task_memory' | 'capability'

/**
 * Node execution status
 */
export type NodeStatus =
  | 'pending'      // Not yet scheduled
  | 'queued'       // Waiting for resources
  | 'running'      // Currently executing
  | 'validated'    // Executed and validated successfully
  | 'completed'    // Completed (no validation required)
  | 'failed'       // Execution failed
  | 'validation_failed'  // Executed but validation failed
  | 'skipped'      // Skipped (dependency failed or optional)
  | 'cancelled'    // Cancelled by user or system
  | 'blocked'      // Blocked by failed dependency

/**
 * Dependency type between nodes
 */
export type DependencyType =
  | 'hard'    // Must complete successfully before dependent can start
  | 'soft'    // Can fail without blocking dependent (warning only)

/**
 * Retry policy for individual nodes
 */
export interface RetryPolicy {
  maxRetries: number
  backoffMs: number
  backoffMultiplier?: number
  maxBackoffMs?: number
  retryOnTimeout: boolean
  retryOnValidationFailure: boolean
  retryOnNetworkError: boolean
}

/**
 * Default retry policy
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 2,
  backoffMs: 1000,
  backoffMultiplier: 2,
  maxBackoffMs: 10000,
  retryOnTimeout: true,
  retryOnValidationFailure: false,
  retryOnNetworkError: true
}

/**
 * Resource requirements for a node
 */
export interface ResourceRequirements {
  cpuIntensive?: boolean
  memoryIntensive?: boolean
  networkIntensive?: boolean
  diskIntensive?: boolean
  requiresExclusiveArtifact?: string[]  // Artifacts that need exclusive access
}

/**
 * A single node in the execution graph
 */
export interface WorkflowNode {
  id: string
  stepId?: string                         // Reference to original CompositeTaskStep
  actionType: TaskActionType
  targetEntity?: string
  description: string
  provider: ExecutionProvider
  // Dependencies
  dependencies: string[]                  // Node IDs this depends on
  dependencyType: DependencyType
  // Execution hints
  parallelizable: boolean                 // Can run in parallel with siblings
  priority: number                        // Higher = execute sooner (0-100)
  estimatedDurationMs: number
  estimatedTokenCost: number
  // Validation
  validationRequired: boolean
  validationType?: string
  validationTarget?: string
  validationCritical?: boolean
  // Retry
  retryPolicy: RetryPolicy
  // Resources
  resourceRequirements: ResourceRequirements
  // References
  taskPatternId?: string
  capabilityKey?: string
  // Runtime state
  status: NodeStatus
  startedAt?: string
  completedAt?: string
  result?: unknown
  error?: string
  attempts: number
  validationResult?: {
    ok: boolean
    reason?: string
    warnings: string[]
    evidence: string[]
    attempts: number
  }
}

/**
 * An edge connecting two nodes
 */
export interface WorkflowEdge {
  id: string
  from: string
  to: string
  type: DependencyType
  label?: string
}

/**
 * Parallel execution group
 */
export interface ParallelGroup {
  id: string
  nodeIds: string[]
  estimatedDurationMs: number
  resourceRequirements: ResourceRequirements
}

/**
 * Graph metadata for optimization
 */
export interface GraphMetadata {
  totalNodes: number
  totalEdges: number
  maxDepth: number
  estimatedDurationMs: number
  estimatedDurationParallelMs: number
  estimatedTokenCost: number
  parallelizableGroups: ParallelGroup[]
  criticalPath: string[]
  hasOptionalBranches: boolean
}

/**
 * The complete execution graph
 */
export interface ExecutionGraph {
  id: string
  tenantId: string
  userId?: string
  sourceInput: string
  compositeTaskId?: string
  // Graph structure
  nodes: Map<string, WorkflowNode>
  edges: WorkflowEdge[]
  // Computed references
  rootNodes: string[]                     // Nodes with no dependencies
  leafNodes: string[]                     // Nodes with no dependents
  // Metadata
  metadata: GraphMetadata
  // State
  status: GraphStatus
  createdAt: string
  startedAt?: string
  completedAt?: string
}

/**
 * Graph execution status
 */
export type GraphStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'cancelled'

/**
 * Resource limits configuration
 */
export interface ResourceLimits {
  maxParallelLocal: number
  maxParallelOpenClaw: number
  maxConcurrentDownloads: number
  maxConcurrentInstalls: number
  maxConcurrentProcesses: number
  globalConcurrencyLimit: number
}

/**
 * Default resource limits
 */
export const DEFAULT_RESOURCE_LIMITS: ResourceLimits = {
  maxParallelLocal: 3,
  maxParallelOpenClaw: 2,
  maxConcurrentDownloads: 2,
  maxConcurrentInstalls: 1,
  maxConcurrentProcesses: 5,
  globalConcurrencyLimit: 6
}

/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
  resourceLimits: ResourceLimits
  priorityBoostForCriticalPath: number
  enablePreemption: boolean
  maxQueueWaitMs: number
  checkIntervalMs: number
}

/**
 * Default scheduler config
 */
export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  resourceLimits: DEFAULT_RESOURCE_LIMITS,
  priorityBoostForCriticalPath: 20,
  enablePreemption: false,
  maxQueueWaitMs: 60000,
  checkIntervalMs: 100
}

/**
 * Resource slot type
 */
export type ResourceSlotType =
  | 'local'
  | 'openclaw'
  | 'download'
  | 'install'
  | 'process'

/**
 * Resource slot status
 */
export interface ResourceSlot {
  type: ResourceSlotType
  nodeId?: string
  acquiredAt?: string
  estimatedReleaseAt?: string
}

/**
 * Artifact lock
 */
export interface ArtifactLock {
  artifactId: string
  nodeId: string
  lockType: 'read' | 'write' | 'exclusive'
  acquiredAt: string
}

/**
 * Scheduler state snapshot
 */
export interface SchedulerState {
  pendingNodes: string[]
  queuedNodes: string[]
  runningNodes: string[]
  completedNodes: string[]
  failedNodes: string[]
  blockedNodes: string[]
  resourceSlots: Map<ResourceSlotType, ResourceSlot[]>
  artifactLocks: ArtifactLock[]
}

/**
 * Input for building execution graph
 */
export interface BuildGraphInput {
  compositeTaskId?: string
  steps: CompositeTaskStep[]
  sourceInput: string
  tenantId: string
  userId?: string
  optimizeParallelism?: boolean
  respectDependencies?: boolean
}

/**
 * Result of building execution graph
 */
export interface BuildGraphResult {
  success: boolean
  graph?: ExecutionGraph
  error?: string
  warnings: string[]
  optimizationApplied: string[]
}

/**
 * Input for executing graph
 */
export interface ExecuteGraphInput {
  graph: ExecutionGraph
  tenantId: string
  userId?: string
  sessionId?: string
  config?: Partial<SchedulerConfig>
  stopOnFirstFailure?: boolean
  allowPartialCompletion?: boolean
}

/**
 * Execution progress event
 */
export interface ExecutionProgressEvent {
  type: 'node-queued' | 'node-start' | 'node-progress' | 'node-complete' | 'node-failed' | 'node-skipped' | 'graph-complete'
  graphId: string
  nodeId?: string
  timestamp: string
  progress?: number
  message?: string
  result?: unknown
  error?: string
}

/**
 * Graph execution result
 */
export interface ExecuteGraphResult {
  graphId: string
  success: boolean
  status: GraphStatus
  // Node results
  completedNodes: string[]
  failedNodes: string[]
  skippedNodes: string[]
  blockedNodes: string[]
  validatedNodes: string[]
  validationFailedNodes: string[]
  // Metrics
  totalDurationMs: number
  parallelDurationMs: number
  sequentialDurationMs: number
  timeSavedMs: number
  tokensSaved: number
  // Learning
  learnedAsComposite: boolean
  learnedCompositeId?: string
  learnRejectedReason?: string
}

/**
 * Dependency analysis result
 */
export interface DependencyAnalysis {
  nodeId: string
  directDependencies: string[]
  transitiveDependencies: string[]
  dependents: string[]
  transitiveDependents: string[]
  isRoot: boolean
  isLeaf: boolean
  depth: number
  criticalPathMember: boolean
}

/**
 * Conflict detection result
 */
export interface ConflictAnalysis {
  hasConflicts: boolean
  conflicts: Array<{
    nodeA: string
    nodeB: string
    conflictType: 'artifact' | 'resource' | 'provider'
    artifactId?: string
    resolution: 'serialize' | 'queue' | 'fail'
  }>
}

/**
 * DAG debug info
 */
export interface DAGDebugInfo {
  graphBuilt: boolean
  graphId?: string
  totalNodes: number
  parallelGroups: number
  criticalPathLength: number
  estimatedSpeedup: number
  resourcesUsed: ResourceSlotType[]
  conflicts: number
  optimizations: string[]
}
