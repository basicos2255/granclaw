/**
 * Graph Builder
 * FEATURE 131: DAG Execution Engine & Parallel Tasks
 *
 * Builds execution graphs from composite task plans.
 * Converts linear step sequences into DAGs with proper
 * dependency relationships and parallel execution groups.
 */

import { v4 as uuidv4 } from 'uuid'
import type {
  WorkflowNode,
  WorkflowEdge,
  ExecutionGraph,
  ExecutionProvider,
  ParallelGroup,
  GraphMetadata,
  BuildGraphInput,
  BuildGraphResult,
  ResourceRequirements,
  DEFAULT_RETRY_POLICY
} from './types'
import {
  DEFAULT_RETRY_POLICY as defaultRetryPolicy
} from './types'
import type { CompositeTaskStep } from '../composite-tasks/types'
import type { TaskActionType } from '../task-memory/types'
import {
  actionDependsOn,
  inferDependencyType,
  computeCriticalPath,
  findParallelGroups,
  resolveEdges,
  detectCycles,
  canRunInParallel
} from './dependency-resolver'

/**
 * Generate unique node ID
 */
function generateNodeId(): string {
  return `node-${uuidv4().substring(0, 8)}`
}

/**
 * Determine execution provider from step type
 */
function getProvider(step: CompositeTaskStep): ExecutionProvider {
  switch (step.type) {
    case 'task_memory':
      return 'task_memory'
    case 'capability':
      return 'capability'
    case 'openclaw':
      return 'openclaw'
    default:
      return 'local'
  }
}

/**
 * Estimate duration based on action type
 */
function estimateDuration(actionType: TaskActionType): number {
  const estimates: Partial<Record<TaskActionType, number>> = {
    'download_file': 30000,
    'install_app': 60000,
    'uninstall_app': 30000,
    'open_app': 5000,
    'close_app': 2000,
    'create_file': 1000,
    'edit_file': 2000,
    'delete_file': 500,
    'copy_file': 2000,
    'move_file': 1000,
    'upload_file': 20000,
    'navigate_url': 3000,
    'search_web': 5000,
    'search_file': 3000,
    'run_command': 10000,
    'configure_setting': 15000,
    'send_message': 2000,
    'general_task': 10000,
    'unknown': 10000
  }

  return estimates[actionType] || 10000
}

/**
 * Estimate token cost based on provider and action
 */
function estimateTokenCost(
  provider: ExecutionProvider,
  actionType: TaskActionType
): number {
  if (provider === 'task_memory' || provider === 'capability') {
    return 0  // No OpenClaw tokens needed
  }

  if (provider === 'local') {
    return 0
  }

  // OpenClaw costs
  const costs: Partial<Record<TaskActionType, number>> = {
    'download_file': 500,
    'install_app': 800,
    'open_app': 300,
    'search_web': 400,
    'search_file': 300,
    'configure_setting': 600,
    'navigate_url': 300,
    'general_task': 500
  }

  return costs[actionType] || 400
}

/**
 * Determine resource requirements
 */
function getResourceRequirements(
  actionType: TaskActionType,
  targetEntity?: string
): ResourceRequirements {
  const requirements: ResourceRequirements = {}

  switch (actionType) {
    case 'download_file':
      requirements.networkIntensive = true
      requirements.diskIntensive = true
      break
    case 'install_app':
      requirements.diskIntensive = true
      requirements.cpuIntensive = true
      if (targetEntity) {
        requirements.requiresExclusiveArtifact = [`install:${targetEntity.toLowerCase()}`]
      }
      break
    case 'uninstall_app':
      requirements.diskIntensive = true
      if (targetEntity) {
        requirements.requiresExclusiveArtifact = [`app:${targetEntity.toLowerCase()}`]
      }
      break
    case 'open_app':
      requirements.memoryIntensive = true
      break
    case 'edit_file':
    case 'create_file':
      if (targetEntity) {
        requirements.requiresExclusiveArtifact = [`file:${targetEntity.toLowerCase()}`]
      }
      break
    case 'run_command':
      requirements.cpuIntensive = true
      break
  }

  return requirements
}

/**
 * Check if action type is parallelizable by default
 */
function isParallelizable(actionType: TaskActionType): boolean {
  // These can typically run in parallel
  const parallelizable: TaskActionType[] = [
    'download_file',
    'navigate_url',
    'search_web',
    'search_file',
    'open_app',
    'close_app'
  ]

  return parallelizable.includes(actionType)
}

/**
 * Convert CompositeTaskStep to WorkflowNode
 */
function stepToNode(step: CompositeTaskStep): WorkflowNode {
  const provider = getProvider(step)

  return {
    id: generateNodeId(),
    stepId: step.stepId,
    actionType: step.actionType,
    targetEntity: step.targetEntity,
    description: step.description,
    provider,
    dependencies: [],
    dependencyType: 'hard',
    parallelizable: isParallelizable(step.actionType),
    priority: 50,  // Default priority
    estimatedDurationMs: step.estimatedDurationMs || estimateDuration(step.actionType),
    estimatedTokenCost: estimateTokenCost(provider, step.actionType),
    validationRequired: step.validationRequired || false,
    validationType: step.validationType,
    validationTarget: step.validationTarget,
    validationCritical: step.validationCritical,
    retryPolicy: { ...defaultRetryPolicy },
    resourceRequirements: getResourceRequirements(step.actionType, step.targetEntity),
    taskPatternId: step.taskPatternId,
    capabilityKey: step.capabilityKey,
    status: 'pending',
    attempts: 0
  }
}

/**
 * Infer dependencies between nodes
 */
function inferDependencies(
  nodes: WorkflowNode[],
  respectOrder: boolean = true
): void {
  // Group nodes by target entity
  const byEntity = new Map<string, WorkflowNode[]>()

  for (const node of nodes) {
    const key = node.targetEntity?.toLowerCase() || '_none_'
    if (!byEntity.has(key)) {
      byEntity.set(key, [])
    }
    byEntity.get(key)!.push(node)
  }

  // Infer dependencies within same entity
  for (const [entity, entityNodes] of byEntity) {
    if (entity === '_none_') continue

    for (let i = 0; i < entityNodes.length; i++) {
      const current = entityNodes[i]

      for (let j = 0; j < i; j++) {
        const previous = entityNodes[j]

        // Check if current naturally depends on previous
        if (actionDependsOn(current.actionType, previous.actionType, current.targetEntity, previous.targetEntity)) {
          if (!current.dependencies.includes(previous.id)) {
            current.dependencies.push(previous.id)
            current.dependencyType = inferDependencyType(previous.actionType, current.actionType)
          }
        }
      }
    }
  }

  // If respectOrder and no natural dependencies, use sequential order
  if (respectOrder) {
    for (let i = 1; i < nodes.length; i++) {
      const current = nodes[i]
      const previous = nodes[i - 1]

      // If no dependencies yet and previous is same entity or sequential required
      if (current.dependencies.length === 0) {
        // Check if there's an implicit order requirement
        const sameEntity = current.targetEntity &&
          current.targetEntity.toLowerCase() === previous.targetEntity?.toLowerCase()

        if (sameEntity && !isParallelizable(current.actionType)) {
          current.dependencies.push(previous.id)
          current.dependencyType = 'hard'
        }
      }
    }
  }
}

/**
 * Find root nodes (no dependencies)
 */
function findRootNodes(nodes: Map<string, WorkflowNode>): string[] {
  const roots: string[] = []
  for (const [id, node] of nodes) {
    if (node.dependencies.length === 0) {
      roots.push(id)
    }
  }
  return roots
}

/**
 * Find leaf nodes (no dependents)
 */
function findLeafNodes(nodes: Map<string, WorkflowNode>): string[] {
  const hasDependent = new Set<string>()

  for (const [, node] of nodes) {
    for (const depId of node.dependencies) {
      hasDependent.add(depId)
    }
  }

  const leaves: string[] = []
  for (const [id] of nodes) {
    if (!hasDependent.has(id)) {
      leaves.push(id)
    }
  }

  return leaves
}

/**
 * Compute graph metadata
 */
function computeMetadata(
  nodes: Map<string, WorkflowNode>,
  edges: WorkflowEdge[],
  graph: ExecutionGraph
): GraphMetadata {
  // Compute max depth
  let maxDepth = 0
  const depths = new Map<string, number>()

  function getDepth(nodeId: string): number {
    if (depths.has(nodeId)) return depths.get(nodeId)!

    const node = nodes.get(nodeId)
    if (!node || node.dependencies.length === 0) {
      depths.set(nodeId, 0)
      return 0
    }

    const depth = 1 + Math.max(...node.dependencies.map(getDepth))
    depths.set(nodeId, depth)
    return depth
  }

  for (const [nodeId] of nodes) {
    const depth = getDepth(nodeId)
    maxDepth = Math.max(maxDepth, depth)
  }

  // Compute total and parallel durations
  let totalSequential = 0
  const levelDurations = new Map<number, number>()

  for (const [nodeId, node] of nodes) {
    totalSequential += node.estimatedDurationMs

    const depth = depths.get(nodeId) || 0
    const current = levelDurations.get(depth) || 0
    levelDurations.set(depth, Math.max(current, node.estimatedDurationMs))
  }

  let totalParallel = 0
  for (const [, duration] of levelDurations) {
    totalParallel += duration
  }

  // Compute token cost
  let totalTokens = 0
  for (const [, node] of nodes) {
    totalTokens += node.estimatedTokenCost
  }

  // Find parallel groups
  const parallelGroupIds = findParallelGroups(graph)
  const parallelGroups: ParallelGroup[] = parallelGroupIds.map((groupIds, index) => {
    const groupNodes = groupIds.map(id => nodes.get(id)!).filter(Boolean)
    const maxDuration = Math.max(...groupNodes.map(n => n.estimatedDurationMs))
    const combinedRequirements: ResourceRequirements = {}

    for (const node of groupNodes) {
      Object.assign(combinedRequirements, node.resourceRequirements)
    }

    return {
      id: `group-${index + 1}`,
      nodeIds: groupIds,
      estimatedDurationMs: maxDuration,
      resourceRequirements: combinedRequirements
    }
  })

  // Compute critical path
  const criticalPath = computeCriticalPath(graph)

  return {
    totalNodes: nodes.size,
    totalEdges: edges.length,
    maxDepth: maxDepth + 1,
    estimatedDurationMs: totalSequential,
    estimatedDurationParallelMs: totalParallel,
    estimatedTokenCost: totalTokens,
    parallelizableGroups: parallelGroups,
    criticalPath,
    hasOptionalBranches: edges.some(e => e.type === 'soft')
  }
}

/**
 * Optimize graph for parallel execution
 */
function optimizeGraph(graph: ExecutionGraph): string[] {
  const optimizations: string[] = []

  // Boost priority for critical path nodes
  for (const nodeId of graph.metadata.criticalPath) {
    const node = graph.nodes.get(nodeId)
    if (node) {
      node.priority = Math.min(100, node.priority + 20)
    }
  }
  if (graph.metadata.criticalPath.length > 0) {
    optimizations.push('Boosted critical path priority')
  }

  // Mark parallelizable nodes
  for (const group of graph.metadata.parallelizableGroups) {
    for (const nodeId of group.nodeIds) {
      const node = graph.nodes.get(nodeId)
      if (node) {
        node.parallelizable = true
      }
    }
  }
  if (graph.metadata.parallelizableGroups.length > 0) {
    optimizations.push(`Identified ${graph.metadata.parallelizableGroups.length} parallel groups`)
  }

  // Verify no unsafe parallelism
  for (const group of graph.metadata.parallelizableGroups) {
    const nodeIds = group.nodeIds
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const result = canRunInParallel(nodeIds[i], nodeIds[j], graph)
        if (!result.canParallel) {
          // Remove from parallelizable
          const nodeB = graph.nodes.get(nodeIds[j])
          if (nodeB) {
            nodeB.parallelizable = false
          }
          optimizations.push(`Serialized ${nodeIds[j]} due to: ${result.reason}`)
        }
      }
    }
  }

  return optimizations
}

/**
 * Build execution graph from composite task steps
 */
export function buildExecutionGraph(input: BuildGraphInput): BuildGraphResult {
  const {
    compositeTaskId,
    steps,
    sourceInput,
    tenantId,
    userId,
    optimizeParallelism = true,
    respectDependencies = true
  } = input

  const warnings: string[] = []
  const optimizationApplied: string[] = []

  try {
    // Convert steps to nodes
    const nodeArray = steps.map(stepToNode)

    // Infer dependencies
    inferDependencies(nodeArray, respectDependencies)

    // Build nodes map
    const nodes = new Map<string, WorkflowNode>()
    for (const node of nodeArray) {
      nodes.set(node.id, node)
    }

    // Resolve edges from dependencies
    const edges = resolveEdges(nodes)

    // Find roots and leaves
    const rootNodes = findRootNodes(nodes)
    const leafNodes = findLeafNodes(nodes)

    if (rootNodes.length === 0 && nodes.size > 0) {
      warnings.push('No root nodes found - possible cycle')
    }

    // Create initial graph
    const graphId = `graph-${uuidv4().substring(0, 8)}`

    const graph: ExecutionGraph = {
      id: graphId,
      tenantId,
      userId,
      sourceInput,
      compositeTaskId,
      nodes,
      edges,
      rootNodes,
      leafNodes,
      metadata: {
        totalNodes: 0,
        totalEdges: 0,
        maxDepth: 0,
        estimatedDurationMs: 0,
        estimatedDurationParallelMs: 0,
        estimatedTokenCost: 0,
        parallelizableGroups: [],
        criticalPath: [],
        hasOptionalBranches: false
      },
      status: 'pending',
      createdAt: new Date().toISOString()
    }

    // Compute metadata (needs graph reference)
    graph.metadata = computeMetadata(nodes, edges, graph)

    // Detect cycles
    const cycles = detectCycles(graph)
    if (cycles.length > 0) {
      warnings.push(`Detected ${cycles.length} cycle(s) in graph`)
      // Try to break cycles by removing soft dependencies
      for (const cycle of cycles) {
        for (let i = 0; i < cycle.length - 1; i++) {
          const edge = edges.find(e => e.from === cycle[i] && e.to === cycle[i + 1])
          if (edge && edge.type === 'soft') {
            const idx = edges.indexOf(edge)
            if (idx >= 0) {
              edges.splice(idx, 1)
              const node = nodes.get(edge.to)
              if (node) {
                node.dependencies = node.dependencies.filter(d => d !== edge.from)
              }
              warnings.push(`Broke cycle by removing soft edge: ${edge.from} -> ${edge.to}`)
            }
          }
        }
      }
    }

    // Optimize if requested
    if (optimizeParallelism) {
      const opts = optimizeGraph(graph)
      optimizationApplied.push(...opts)
    }

    // Recompute metadata after optimizations
    graph.metadata = computeMetadata(nodes, edges, graph)

    console.log(`[GraphBuilder] Built graph ${graphId}: ${nodes.size} nodes, ${edges.length} edges, ` +
      `${graph.metadata.parallelizableGroups.length} parallel groups, ` +
      `estimated ${Math.round(graph.metadata.estimatedDurationParallelMs / 1000)}s (parallel) vs ` +
      `${Math.round(graph.metadata.estimatedDurationMs / 1000)}s (sequential)`)

    return {
      success: true,
      graph,
      warnings,
      optimizationApplied
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error('[GraphBuilder] Error building graph:', err)
    return {
      success: false,
      error: errorMessage,
      warnings,
      optimizationApplied
    }
  }
}

/**
 * Rebuild graph from existing with modifications
 */
export function rebuildGraph(
  existingGraph: ExecutionGraph,
  modifications: {
    addNodes?: WorkflowNode[]
    removeNodes?: string[]
    updateNodes?: Array<{ id: string; updates: Partial<WorkflowNode> }>
    addEdges?: WorkflowEdge[]
    removeEdges?: string[]
  }
): BuildGraphResult {
  const warnings: string[] = []
  const optimizationApplied: string[] = []

  // Clone nodes
  const nodes = new Map(existingGraph.nodes)

  // Apply modifications
  if (modifications.removeNodes) {
    for (const nodeId of modifications.removeNodes) {
      nodes.delete(nodeId)
      // Remove from dependencies
      for (const [, node] of nodes) {
        node.dependencies = node.dependencies.filter(d => d !== nodeId)
      }
    }
  }

  if (modifications.addNodes) {
    for (const node of modifications.addNodes) {
      nodes.set(node.id, node)
    }
  }

  if (modifications.updateNodes) {
    for (const { id, updates } of modifications.updateNodes) {
      const existing = nodes.get(id)
      if (existing) {
        nodes.set(id, { ...existing, ...updates })
      }
    }
  }

  // Handle edges
  let edges = [...existingGraph.edges]

  if (modifications.removeEdges) {
    edges = edges.filter(e => !modifications.removeEdges!.includes(e.id))
  }

  if (modifications.addEdges) {
    edges.push(...modifications.addEdges)
  }

  // Rebuild graph
  const rootNodes = findRootNodes(nodes)
  const leafNodes = findLeafNodes(nodes)

  const newGraph: ExecutionGraph = {
    ...existingGraph,
    id: `graph-${uuidv4().substring(0, 8)}`,
    nodes,
    edges,
    rootNodes,
    leafNodes,
    createdAt: new Date().toISOString()
  }

  newGraph.metadata = computeMetadata(nodes, edges, newGraph)

  return {
    success: true,
    graph: newGraph,
    warnings,
    optimizationApplied
  }
}
