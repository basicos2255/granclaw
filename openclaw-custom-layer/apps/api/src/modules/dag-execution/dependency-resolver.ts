/**
 * Dependency Resolver
 * FEATURE 131: DAG Execution Engine & Parallel Tasks
 *
 * Analyzes and resolves dependencies between workflow nodes.
 * Detects cycles, computes transitive dependencies, and identifies
 * the critical execution path.
 */

import type {
  WorkflowNode,
  WorkflowEdge,
  ExecutionGraph,
  DependencyAnalysis,
  DependencyType
} from './types'
import type { TaskActionType } from '../task-memory/types'

/**
 * Dependency rules: what actions depend on what
 */
const ACTION_DEPENDENCIES: Partial<Record<TaskActionType, TaskActionType[]>> = {
  // Install depends on download
  'install_app': ['download_file'],
  // Open depends on install
  'open_app': ['install_app'],
  // Uninstall doesn't need download
  'uninstall_app': [],
  // Close app - no strict dependencies
  'close_app': [],
  // File operations
  'edit_file': ['download_file', 'create_file'],
  'delete_file': [],
  'create_file': [],
  'copy_file': [],
  'move_file': [],
  // Download - no dependencies
  'download_file': [],
  // Upload
  'upload_file': [],
  // Web
  'navigate_url': [],
  'search_web': [],
  'search_file': [],
  // System
  'run_command': [],
  'configure_setting': ['install_app'],
  // Message
  'send_message': [],
  // General
  'general_task': [],
  'unknown': []
}

/**
 * Check if action A naturally depends on action B for same entity
 */
export function actionDependsOn(
  actionA: TaskActionType,
  actionB: TaskActionType,
  entityA?: string,
  entityB?: string
): boolean {
  // Same entity check
  if (entityA && entityB && entityA.toLowerCase() !== entityB.toLowerCase()) {
    return false
  }

  const dependencies = ACTION_DEPENDENCIES[actionA] || []
  return dependencies.includes(actionB)
}

/**
 * Infer dependency type based on actions
 */
export function inferDependencyType(
  fromAction: TaskActionType,
  toAction: TaskActionType
): DependencyType {
  // Critical dependencies (must succeed)
  const hardDependencies: Array<[TaskActionType, TaskActionType]> = [
    ['download_file', 'install_app'],
    ['install_app', 'open_app'],
    ['install_app', 'configure_setting'],
    ['create_file', 'edit_file']
  ]

  for (const [from, to] of hardDependencies) {
    if (fromAction === from && toAction === to) {
      return 'hard'
    }
  }

  return 'soft'
}

/**
 * Analyze dependencies for a single node
 */
export function analyzeDependencies(
  nodeId: string,
  graph: ExecutionGraph
): DependencyAnalysis {
  const node = graph.nodes.get(nodeId)
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`)
  }

  // Direct dependencies
  const directDependencies = [...node.dependencies]

  // Transitive dependencies (DFS)
  const transitiveDependencies = new Set<string>()
  const visited = new Set<string>()

  function traverseDeps(id: string): void {
    if (visited.has(id)) return
    visited.add(id)

    const n = graph.nodes.get(id)
    if (!n) return

    for (const depId of n.dependencies) {
      if (depId !== nodeId) {
        transitiveDependencies.add(depId)
        traverseDeps(depId)
      }
    }
  }

  for (const depId of directDependencies) {
    transitiveDependencies.add(depId)
    traverseDeps(depId)
  }

  // Direct dependents (who depends on this node)
  const dependents: string[] = []
  for (const [id, n] of graph.nodes) {
    if (n.dependencies.includes(nodeId)) {
      dependents.push(id)
    }
  }

  // Transitive dependents
  const transitiveDependents = new Set<string>()
  visited.clear()

  function traverseDependents(id: string): void {
    if (visited.has(id)) return
    visited.add(id)

    for (const [nId, n] of graph.nodes) {
      if (n.dependencies.includes(id) && nId !== nodeId) {
        transitiveDependents.add(nId)
        traverseDependents(nId)
      }
    }
  }

  for (const depId of dependents) {
    transitiveDependents.add(depId)
    traverseDependents(depId)
  }

  // Compute depth (longest path from any root)
  const depth = computeNodeDepth(nodeId, graph)

  // Check if on critical path
  const criticalPath = computeCriticalPath(graph)

  return {
    nodeId,
    directDependencies,
    transitiveDependencies: Array.from(transitiveDependencies),
    dependents,
    transitiveDependents: Array.from(transitiveDependents),
    isRoot: directDependencies.length === 0,
    isLeaf: dependents.length === 0,
    depth,
    criticalPathMember: criticalPath.includes(nodeId)
  }
}

/**
 * Compute depth of a node (longest path from root)
 */
function computeNodeDepth(
  nodeId: string,
  graph: ExecutionGraph,
  memo: Map<string, number> = new Map()
): number {
  if (memo.has(nodeId)) {
    return memo.get(nodeId)!
  }

  const node = graph.nodes.get(nodeId)
  if (!node || node.dependencies.length === 0) {
    memo.set(nodeId, 0)
    return 0
  }

  let maxDepth = 0
  for (const depId of node.dependencies) {
    const depDepth = computeNodeDepth(depId, graph, memo)
    maxDepth = Math.max(maxDepth, depDepth + 1)
  }

  memo.set(nodeId, maxDepth)
  return maxDepth
}

/**
 * Compute the critical path (longest execution path)
 */
export function computeCriticalPath(graph: ExecutionGraph): string[] {
  // Find all paths from roots to leaves
  const paths: Array<{ path: string[]; duration: number }> = []

  function findPaths(
    nodeId: string,
    currentPath: string[],
    currentDuration: number
  ): void {
    const node = graph.nodes.get(nodeId)
    if (!node) return

    const newPath = [...currentPath, nodeId]
    const newDuration = currentDuration + node.estimatedDurationMs

    // Find children (nodes that depend on this one)
    const children: string[] = []
    for (const [id, n] of graph.nodes) {
      if (n.dependencies.includes(nodeId)) {
        children.push(id)
      }
    }

    if (children.length === 0) {
      // Leaf node - record path
      paths.push({ path: newPath, duration: newDuration })
    } else {
      for (const childId of children) {
        findPaths(childId, newPath, newDuration)
      }
    }
  }

  // Start from all root nodes
  for (const rootId of graph.rootNodes) {
    findPaths(rootId, [], 0)
  }

  // Find longest path
  if (paths.length === 0) {
    return []
  }

  const longestPath = paths.reduce((max, p) =>
    p.duration > max.duration ? p : max
  )

  return longestPath.path
}

/**
 * Detect cycles in the graph
 */
export function detectCycles(graph: ExecutionGraph): string[][] {
  const cycles: string[][] = []
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  const currentPath: string[] = []

  function dfs(nodeId: string): void {
    visited.add(nodeId)
    recursionStack.add(nodeId)
    currentPath.push(nodeId)

    const node = graph.nodes.get(nodeId)
    if (node) {
      for (const depId of node.dependencies) {
        if (!visited.has(depId)) {
          dfs(depId)
        } else if (recursionStack.has(depId)) {
          // Cycle detected
          const cycleStart = currentPath.indexOf(depId)
          const cycle = currentPath.slice(cycleStart)
          cycle.push(depId) // Complete the cycle
          cycles.push(cycle)
        }
      }
    }

    currentPath.pop()
    recursionStack.delete(nodeId)
  }

  for (const [nodeId] of graph.nodes) {
    if (!visited.has(nodeId)) {
      dfs(nodeId)
    }
  }

  return cycles
}

/**
 * Topological sort of nodes
 */
export function topologicalSort(graph: ExecutionGraph): string[] {
  const inDegree = new Map<string, number>()
  const result: string[] = []
  const queue: string[] = []

  // Initialize in-degree
  for (const [nodeId, node] of graph.nodes) {
    inDegree.set(nodeId, node.dependencies.length)
    if (node.dependencies.length === 0) {
      queue.push(nodeId)
    }
  }

  while (queue.length > 0) {
    // Sort queue by priority (higher priority first)
    queue.sort((a, b) => {
      const nodeA = graph.nodes.get(a)
      const nodeB = graph.nodes.get(b)
      return (nodeB?.priority || 0) - (nodeA?.priority || 0)
    })

    const nodeId = queue.shift()!
    result.push(nodeId)

    // Decrease in-degree for dependents
    for (const [id, node] of graph.nodes) {
      if (node.dependencies.includes(nodeId)) {
        const newDegree = (inDegree.get(id) || 1) - 1
        inDegree.set(id, newDegree)
        if (newDegree === 0) {
          queue.push(id)
        }
      }
    }
  }

  // Check for remaining nodes (cycle detection)
  if (result.length !== graph.nodes.size) {
    console.warn('[DependencyResolver] Graph has cycles, topological sort incomplete')
  }

  return result
}

/**
 * Get nodes ready to execute (all dependencies satisfied)
 */
export function getReadyNodes(
  graph: ExecutionGraph,
  completedNodes: Set<string>,
  runningNodes: Set<string>,
  failedNodes: Set<string>
): string[] {
  const ready: string[] = []

  for (const [nodeId, node] of graph.nodes) {
    // Skip if already processed or running
    if (completedNodes.has(nodeId) || runningNodes.has(nodeId) || failedNodes.has(nodeId)) {
      continue
    }

    // Skip if status indicates already processed
    if (node.status !== 'pending' && node.status !== 'queued') {
      continue
    }

    // Check all dependencies are satisfied
    let allDependenciesSatisfied = true
    let anyHardDependencyFailed = false

    for (const depId of node.dependencies) {
      const dep = graph.nodes.get(depId)
      if (!dep) continue

      if (dep.dependencyType === 'hard') {
        if (failedNodes.has(depId) || dep.status === 'failed' || dep.status === 'validation_failed') {
          anyHardDependencyFailed = true
          break
        }
        if (!completedNodes.has(depId) && dep.status !== 'completed' && dep.status !== 'validated') {
          allDependenciesSatisfied = false
          break
        }
      } else {
        // Soft dependency - can proceed if failed or completed
        if (!completedNodes.has(depId) && !failedNodes.has(depId) &&
            dep.status !== 'completed' && dep.status !== 'validated' &&
            dep.status !== 'failed' && dep.status !== 'validation_failed') {
          allDependenciesSatisfied = false
          break
        }
      }
    }

    if (anyHardDependencyFailed) {
      node.status = 'blocked'
      continue
    }

    if (allDependenciesSatisfied) {
      ready.push(nodeId)
    }
  }

  // Sort by priority
  ready.sort((a, b) => {
    const nodeA = graph.nodes.get(a)
    const nodeB = graph.nodes.get(b)
    return (nodeB?.priority || 0) - (nodeA?.priority || 0)
  })

  return ready
}

/**
 * Find parallelizable groups (nodes that can run together)
 */
export function findParallelGroups(graph: ExecutionGraph): string[][] {
  const groups: string[][] = []
  const visited = new Set<string>()

  // Group by depth level
  const byDepth = new Map<number, string[]>()

  for (const [nodeId] of graph.nodes) {
    if (visited.has(nodeId)) continue

    const depth = computeNodeDepth(nodeId, graph)
    if (!byDepth.has(depth)) {
      byDepth.set(depth, [])
    }
    byDepth.get(depth)!.push(nodeId)
    visited.add(nodeId)
  }

  // Convert to array sorted by depth
  const sortedDepths = Array.from(byDepth.keys()).sort((a, b) => a - b)

  for (const depth of sortedDepths) {
    const nodesAtDepth = byDepth.get(depth)!

    // Filter to only parallelizable nodes
    const parallelizable = nodesAtDepth.filter(id => {
      const node = graph.nodes.get(id)
      return node?.parallelizable
    })

    if (parallelizable.length > 1) {
      groups.push(parallelizable)
    }
  }

  return groups
}

/**
 * Check if two nodes can run in parallel (no conflicts)
 */
export function canRunInParallel(
  nodeIdA: string,
  nodeIdB: string,
  graph: ExecutionGraph
): { canParallel: boolean; reason?: string } {
  const nodeA = graph.nodes.get(nodeIdA)
  const nodeB = graph.nodes.get(nodeIdB)

  if (!nodeA || !nodeB) {
    return { canParallel: false, reason: 'Node not found' }
  }

  // Check if one depends on the other
  if (nodeA.dependencies.includes(nodeIdB) || nodeB.dependencies.includes(nodeIdA)) {
    return { canParallel: false, reason: 'Direct dependency exists' }
  }

  // Check transitive dependencies
  const analysisA = analyzeDependencies(nodeIdA, graph)
  const analysisB = analyzeDependencies(nodeIdB, graph)

  if (analysisA.transitiveDependencies.includes(nodeIdB) ||
      analysisB.transitiveDependencies.includes(nodeIdA)) {
    return { canParallel: false, reason: 'Transitive dependency exists' }
  }

  // Check artifact conflicts
  const artifactsA = nodeA.resourceRequirements.requiresExclusiveArtifact || []
  const artifactsB = nodeB.resourceRequirements.requiresExclusiveArtifact || []

  for (const artifact of artifactsA) {
    if (artifactsB.includes(artifact)) {
      return { canParallel: false, reason: `Artifact conflict: ${artifact}` }
    }
  }

  // Check same target entity with conflicting actions
  if (nodeA.targetEntity && nodeA.targetEntity === nodeB.targetEntity) {
    // Two installs of same app
    if (nodeA.actionType === 'install_app' && nodeB.actionType === 'install_app') {
      return { canParallel: false, reason: 'Same install target' }
    }
    // Two writes to same file
    if ((nodeA.actionType === 'edit_file' || nodeA.actionType === 'create_file') &&
        (nodeB.actionType === 'edit_file' || nodeB.actionType === 'create_file')) {
      return { canParallel: false, reason: 'Same file write target' }
    }
  }

  // Check if either is marked non-parallelizable
  if (!nodeA.parallelizable || !nodeB.parallelizable) {
    return { canParallel: false, reason: 'Node marked non-parallelizable' }
  }

  return { canParallel: true }
}

/**
 * Resolve edges from dependencies
 */
export function resolveEdges(nodes: Map<string, WorkflowNode>): WorkflowEdge[] {
  const edges: WorkflowEdge[] = []
  let edgeCounter = 0

  for (const [nodeId, node] of nodes) {
    for (const depId of node.dependencies) {
      const depNode = nodes.get(depId)
      if (depNode) {
        edges.push({
          id: `edge-${++edgeCounter}`,
          from: depId,
          to: nodeId,
          type: node.dependencyType
        })
      }
    }
  }

  return edges
}
