/**
 * DAG Execution Module
 * FEATURE 131: DAG Execution Engine & Parallel Tasks
 *
 * Exports for DAG-based workflow execution with parallel task scheduling.
 */

// Types
export type {
  ExecutionProvider,
  NodeStatus,
  DependencyType,
  RetryPolicy,
  ResourceRequirements,
  WorkflowNode,
  WorkflowEdge,
  ParallelGroup,
  GraphMetadata,
  ExecutionGraph,
  GraphStatus,
  ResourceLimits,
  SchedulerConfig,
  ResourceSlotType,
  ResourceSlot,
  ArtifactLock,
  SchedulerState,
  BuildGraphInput,
  BuildGraphResult,
  ExecuteGraphInput,
  ExecutionProgressEvent,
  ExecuteGraphResult,
  DependencyAnalysis,
  ConflictAnalysis,
  DAGDebugInfo
} from './types'

export {
  DEFAULT_RETRY_POLICY,
  DEFAULT_RESOURCE_LIMITS,
  DEFAULT_SCHEDULER_CONFIG
} from './types'

// Graph Builder
export {
  buildExecutionGraph,
  rebuildGraph
} from './graph-builder'

// Dependency Resolver
export {
  actionDependsOn,
  inferDependencyType,
  analyzeDependencies,
  computeCriticalPath,
  detectCycles,
  topologicalSort,
  getReadyNodes,
  findParallelGroups,
  canRunInParallel,
  resolveEdges
} from './dependency-resolver'

// Artifact Locks
export {
  ArtifactLockManager,
  getArtifactIds,
  getLockType,
  analyzeConflicts,
  acquireNodeLocks,
  releaseNodeLocks,
  canAcquireLocks
} from './artifact-locks'

// Resource Manager
export {
  ResourceManager,
  wouldCauseContention,
  estimateWaitTime
} from './resource-manager'

// Scheduler
export {
  DAGScheduler,
  createScheduler
} from './scheduler'

export type {
  SchedulerEventType,
  SchedulerEvent,
  SchedulerEventHandler
} from './scheduler'

// Executor
export {
  executeGraph,
  retryNode,
  continueExecution
} from './executor'

export type {
  ProgressHandler
} from './executor'

// DAG Helper (FIX 131.1)
export {
  shouldUseDagExecution,
  getDagConfig,
  setDagConfig,
  createGraphSummary,
  dagResultToResponse,
  DEFAULT_DAG_CONFIG
} from './dag-helper'

export type {
  DAGExecutionConfig,
  GraphSummary,
  DAGExecutionResponse
} from './dag-helper'

// Persistence (FIX 131.1)
export {
  createGraphExecutionState,
  updateGraphExecutionState,
  addExecutionEvent,
  getGraphExecution,
  getGraphExecutionByGraphId,
  listGraphExecutions,
  saveGraphExecution,
  deleteGraphExecution,
  clearGraphExecutions
} from './persistence'

export type {
  GraphExecutionState,
  GraphExecutionEvent
} from './persistence'
