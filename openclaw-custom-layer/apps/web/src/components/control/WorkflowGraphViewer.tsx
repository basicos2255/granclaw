/**
 * WorkflowGraphViewer Component
 * FIX 131.1: Wire DAG Engine into Composite Execution + Minimal DAG UI
 * P1.2: Live WebSocket updates for realtime progress
 *
 * Visual representation of DAG workflow execution with:
 * - Node status visualization
 * - Dependency arrows
 * - Progress tracking
 * - Node actions (retry, skip)
 * - Live WebSocket updates (P1.2)
 */

import { useState, useEffect, useMemo } from 'react'
import { useRuntimeWs, useWorkflowEvents } from '../../hooks/useRuntimeWs'

/**
 * Node status types
 */
type NodeStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'validated'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'cancelled'
  | 'blocked'
  | 'validation_failed'

/**
 * Graph node data
 */
interface GraphNode {
  id: string
  description: string
  status: NodeStatus
  dependencies: string[]
  provider?: string
  validationRequired?: boolean
  retries?: number
  error?: string
  tokenSaving?: boolean
}

/**
 * Graph summary data
 */
interface GraphSummary {
  totalNodes: number
  completedNodes: number
  failedNodes: number
  skippedNodes: number
  blockedNodes: number
  validatedNodes: number
  validationFailedNodes: number
  queuedNodes: number
  durationMs: number
  parallelGroups: number
  tokenSavingEstimate: number
  criticalPathLength: number
  timeSavedMs: number
}

interface WorkflowGraphViewerProps {
  /** Graph ID */
  graphId: string
  /** Nodes in the graph */
  nodes: Record<string, GraphNode>
  /** Execution summary */
  summary?: GraphSummary
  /** Callback for retry action */
  onRetryNode?: (nodeId: string) => void
  /** Callback for skip action */
  onSkipNode?: (nodeId: string) => void
  /** Show in compact mode */
  compact?: boolean
}

/**
 * Get status color
 */
function getStatusColor(status: NodeStatus): string {
  switch (status) {
    case 'completed':
    case 'validated':
      return '#16a34a'
    case 'running':
      return '#2563eb'
    case 'queued':
      return '#8b5cf6'
    case 'pending':
      return '#9ca3af'
    case 'failed':
    case 'validation_failed':
      return '#dc2626'
    case 'skipped':
      return '#f59e0b'
    case 'blocked':
      return '#64748b'
    case 'cancelled':
      return '#6b7280'
    default:
      return '#9ca3af'
  }
}

/**
 * Get status icon
 */
function getStatusIcon(status: NodeStatus): string {
  switch (status) {
    case 'completed':
      return '✓'
    case 'validated':
      return '✓✓'
    case 'running':
      return '⏳'
    case 'queued':
      return '⏸'
    case 'pending':
      return '○'
    case 'failed':
      return '✗'
    case 'validation_failed':
      return '⚠'
    case 'skipped':
      return '⏭'
    case 'blocked':
      return '🚫'
    case 'cancelled':
      return '⊘'
    default:
      return '?'
  }
}

/**
 * Get status label
 */
function getStatusLabel(status: NodeStatus): string {
  switch (status) {
    case 'completed':
      return 'Completado'
    case 'validated':
      return 'Validado'
    case 'running':
      return 'Ejecutando'
    case 'queued':
      return 'En cola'
    case 'pending':
      return 'Pendiente'
    case 'failed':
      return 'Fallido'
    case 'validation_failed':
      return 'Validación fallida'
    case 'skipped':
      return 'Saltado'
    case 'blocked':
      return 'Bloqueado'
    case 'cancelled':
      return 'Cancelado'
    default:
      return status
  }
}

/**
 * Get provider badge
 */
function getProviderBadge(provider?: string): { label: string; color: string } {
  switch (provider) {
    case 'task_memory':
      return { label: 'Memoria', color: '#059669' }
    case 'capability':
      return { label: 'Local', color: '#7c3aed' }
    case 'openclaw':
      return { label: 'OpenClaw', color: '#2563eb' }
    case 'local':
      return { label: 'Local', color: '#6b7280' }
    default:
      return { label: provider || 'Auto', color: '#9ca3af' }
  }
}

/**
 * Single node display
 */
function NodeCard({
  node,
  allNodes,
  onRetry,
  onSkip
}: {
  node: GraphNode
  allNodes: Record<string, GraphNode>
  onRetry?: () => void
  onSkip?: () => void
}) {
  const statusColor = getStatusColor(node.status)
  const statusIcon = getStatusIcon(node.status)
  const providerBadge = getProviderBadge(node.provider)

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    border: `2px solid ${statusColor}`,
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px'
  }

  const statusBadgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    backgroundColor: `${statusColor}15`,
    color: statusColor
  }

  const providerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '500',
    backgroundColor: `${providerBadge.color}15`,
    color: providerBadge.color
  }

  const descriptionStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#374151',
    lineHeight: '1.5',
    marginBottom: '12px'
  }

  const depsStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#6b7280',
    marginBottom: '8px'
  }

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginTop: '12px'
  }

  const actionBtnStyle: React.CSSProperties = {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '500',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    backgroundColor: 'white',
    cursor: 'pointer'
  }

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span style={statusBadgeStyle}>
          <span>{statusIcon}</span>
          <span>{getStatusLabel(node.status)}</span>
        </span>
        <span style={providerStyle}>{providerBadge.label}</span>
        {node.validationRequired && (
          <span style={{ ...providerStyle, backgroundColor: '#fef3c7', color: '#d97706' }}>
            Validación
          </span>
        )}
        {node.tokenSaving && (
          <span style={{ ...providerStyle, backgroundColor: '#dcfce7', color: '#16a34a' }}>
            Token Saved
          </span>
        )}
      </div>

      <div style={descriptionStyle}>{node.description}</div>

      {node.dependencies.length > 0 && (
        <div style={depsStyle}>
          <strong>Depende de:</strong>{' '}
          {node.dependencies.map((depId, idx) => (
            <span key={depId}>
              {idx > 0 && ', '}
              {allNodes[depId]?.description?.substring(0, 30) || depId}
            </span>
          ))}
        </div>
      )}

      {node.error && (
        <div style={{ fontSize: '12px', color: '#dc2626', backgroundColor: '#fef2f2', padding: '8px', borderRadius: '6px', marginBottom: '8px' }}>
          <strong>Error:</strong> {node.error}
        </div>
      )}

      {node.retries !== undefined && node.retries > 0 && (
        <div style={{ fontSize: '11px', color: '#6b7280' }}>
          Reintentos: {node.retries}
        </div>
      )}

      {(node.status === 'failed' || node.status === 'validation_failed') && (onRetry || onSkip) && (
        <div style={actionsStyle}>
          {onRetry && (
            <button style={{ ...actionBtnStyle, backgroundColor: '#eff6ff', borderColor: '#bfdbfe', color: '#2563eb' }} onClick={onRetry}>
              Reintentar
            </button>
          )}
          {onSkip && (
            <button style={actionBtnStyle} onClick={onSkip}>
              Saltar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Summary panel
 */
function SummaryPanel({ summary }: { summary: GraphSummary }) {
  const panelStyle: React.CSSProperties = {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px'
  }

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '16px'
  }

  const statStyle: React.CSSProperties = {
    textAlign: 'center'
  }

  const statValueStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1e293b'
  }

  const statLabelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#64748b',
    marginTop: '4px'
  }

  const progress = summary.totalNodes > 0
    ? Math.round((summary.completedNodes + summary.skippedNodes) / summary.totalNodes * 100)
    : 0

  const progressBarStyle: React.CSSProperties = {
    width: '100%',
    height: '8px',
    backgroundColor: '#e2e8f0',
    borderRadius: '4px',
    overflow: 'hidden',
    marginTop: '16px'
  }

  const progressFillStyle: React.CSSProperties = {
    height: '100%',
    width: `${progress}%`,
    backgroundColor: summary.failedNodes > 0 ? '#f59e0b' : '#16a34a',
    transition: 'width 0.3s'
  }

  return (
    <div style={panelStyle}>
      <div style={gridStyle}>
        <div style={statStyle}>
          <div style={statValueStyle}>{summary.completedNodes}/{summary.totalNodes}</div>
          <div style={statLabelStyle}>Completados</div>
        </div>
        <div style={statStyle}>
          <div style={{ ...statValueStyle, color: summary.failedNodes > 0 ? '#dc2626' : '#16a34a' }}>
            {summary.failedNodes}
          </div>
          <div style={statLabelStyle}>Fallidos</div>
        </div>
        <div style={statStyle}>
          <div style={statValueStyle}>{summary.parallelGroups}</div>
          <div style={statLabelStyle}>Grupos paralelos</div>
        </div>
        <div style={statStyle}>
          <div style={{ ...statValueStyle, color: '#16a34a' }}>
            {summary.timeSavedMs > 0 ? `${Math.round(summary.timeSavedMs / 1000)}s` : '-'}
          </div>
          <div style={statLabelStyle}>Tiempo ahorrado</div>
        </div>
        <div style={statStyle}>
          <div style={{ ...statValueStyle, color: '#7c3aed' }}>
            {summary.tokenSavingEstimate > 0 ? summary.tokenSavingEstimate : '-'}
          </div>
          <div style={statLabelStyle}>Tokens ahorrados</div>
        </div>
        <div style={statStyle}>
          <div style={statValueStyle}>
            {summary.durationMs > 0 ? `${(summary.durationMs / 1000).toFixed(1)}s` : '-'}
          </div>
          <div style={statLabelStyle}>Duración</div>
        </div>
      </div>
      <div style={progressBarStyle}>
        <div style={progressFillStyle} />
      </div>
      <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
        Progreso: {progress}%
      </div>
    </div>
  )
}

/**
 * Main WorkflowGraphViewer component
 */
export function WorkflowGraphViewer({
  graphId,
  nodes,
  summary,
  onRetryNode,
  onSkipNode,
  compact = false,
  isLive = false
}: WorkflowGraphViewerProps & { isLive?: boolean }) {
  const [showAllNodes, setShowAllNodes] = useState(!compact)
  const [showJson, setShowJson] = useState(false)

  const nodeArray = Object.entries(nodes).map(([nodeId, node]) => ({ ...node, id: node.id || nodeId }))

  // Sort nodes: running first, then by status
  const sortedNodes = [...nodeArray].sort((a, b) => {
    const statusOrder: Record<NodeStatus, number> = {
      running: 0,
      queued: 1,
      pending: 2,
      failed: 3,
      validation_failed: 4,
      blocked: 5,
      completed: 6,
      validated: 7,
      skipped: 8,
      cancelled: 9
    }
    return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99)
  })

  const displayNodes = showAllNodes ? sortedNodes : sortedNodes.slice(0, 5)

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
    marginTop: '24px'
  }

  const headerStyle: React.CSSProperties = {
    padding: '20px 24px',
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  }

  const titleStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  }

  const contentStyle: React.CSSProperties = {
    padding: '24px'
  }

  const toggleBtnStyle: React.CSSProperties = {
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: '500',
    backgroundColor: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer'
  }

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div style={titleStyle}>
          <span style={{ fontSize: '24px' }}>🔀</span>
          <span style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>
            Workflow DAG
          </span>
          <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
            {graphId}
          </span>
          {isLive && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: '600',
              backgroundColor: '#dcfce7',
              color: '#16a34a',
              animation: 'pulse 2s infinite'
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#16a34a',
                animation: 'blink 1s infinite'
              }} />
              LIVE
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={toggleBtnStyle} onClick={() => setShowJson(!showJson)}>
            {showJson ? 'Ver nodos' : 'Ver JSON'}
          </button>
        </div>
      </div>

      <div style={contentStyle}>
        {summary && <SummaryPanel summary={summary} />}

        {showJson ? (
          <pre style={{
            backgroundColor: '#f8fafc',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '12px',
            overflow: 'auto',
            maxHeight: '400px'
          }}>
            {JSON.stringify({ graphId, nodes, summary }, null, 2)}
          </pre>
        ) : (
          <>
            {displayNodes.map((node) => (
              <NodeCard
                key={node.id}
                node={node}
                allNodes={nodes}
                onRetry={onRetryNode ? () => onRetryNode(node.id) : undefined}
                onSkip={onSkipNode ? () => onSkipNode(node.id) : undefined}
              />
            ))}

            {sortedNodes.length > 5 && !showAllNodes && (
              <button
                style={{ ...toggleBtnStyle, width: '100%', marginTop: '8px' }}
                onClick={() => setShowAllNodes(true)}
              >
                Mostrar todos ({sortedNodes.length - 5} más)
              </button>
            )}

            {showAllNodes && sortedNodes.length > 5 && (
              <button
                style={{ ...toggleBtnStyle, width: '100%', marginTop: '8px' }}
                onClick={() => setShowAllNodes(false)}
              >
                Mostrar menos
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/**
 * P1.2: Payload types for WebSocket events
 */
interface NodeEventPayload {
  workflowId: string
  nodeId: string
  nodeName?: string
  nodeType: string
  status: string
  progress?: number
  message?: string
  error?: string
  retryCount?: number
  duration?: number
}

interface WorkflowEventPayload {
  workflowId: string
  graphId?: string
  status: string
  progress?: number
  message?: string
  nodeCount?: number
  completedNodes?: number
  failedNodes?: number
}

/**
 * P1.2: Live Workflow Graph Viewer
 * Wrapper that adds WebSocket live updates to WorkflowGraphViewer
 */
interface LiveWorkflowGraphViewerProps {
  /** Workflow/Graph ID to subscribe to */
  workflowId: string
  /** Initial nodes data (optional) */
  initialNodes?: Record<string, GraphNode>
  /** Initial summary (optional) */
  initialSummary?: GraphSummary
  /** Callback for retry action */
  onRetryNode?: (nodeId: string) => void
  /** Callback for skip action */
  onSkipNode?: (nodeId: string) => void
  /** Show in compact mode */
  compact?: boolean
  /** Called when workflow completes */
  onComplete?: (summary: GraphSummary) => void
  /** Called when workflow fails */
  onFailed?: (error: string) => void
}

export function LiveWorkflowGraphViewer({
  workflowId,
  initialNodes = {},
  initialSummary,
  onRetryNode,
  onSkipNode,
  compact = false,
  onComplete,
  onFailed
}: LiveWorkflowGraphViewerProps) {
  const { isConnected } = useRuntimeWs()
  const { lastEvent } = useWorkflowEvents(workflowId)

  // Internal state for nodes and summary
  const [nodes, setNodes] = useState<Record<string, GraphNode>>(initialNodes)
  const [summary, setSummary] = useState<GraphSummary | undefined>(initialSummary)
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now())

  // Update nodes when initial data changes
  useEffect(() => {
    if (Object.keys(initialNodes).length > 0) {
      setNodes(initialNodes)
    }
  }, [initialNodes])

  useEffect(() => {
    if (initialSummary) {
      setSummary(initialSummary)
    }
  }, [initialSummary])

  // Process incoming WebSocket events
  useEffect(() => {
    if (!lastEvent) return

    const { payload, frame } = lastEvent
    const event = frame.event

    // Handle node events
    if (event?.startsWith('node:')) {
      const nodePayload = payload as NodeEventPayload
      if (!nodePayload.nodeId) return

      setNodes(prev => {
        const existing = prev[nodePayload.nodeId] || {
          id: nodePayload.nodeId,
          description: nodePayload.nodeName || nodePayload.nodeId,
          status: 'pending' as NodeStatus,
          dependencies: []
        }

        return {
          ...prev,
          [nodePayload.nodeId]: {
            ...existing,
            status: mapStatusFromEvent(nodePayload.status),
            error: nodePayload.error,
            retries: nodePayload.retryCount
          }
        }
      })
      setLastUpdate(Date.now())
    }

    // Handle workflow events
    if (event?.startsWith('workflow:')) {
      const wfPayload = payload as WorkflowEventPayload

      // Update summary if available
      if (wfPayload.completedNodes !== undefined || wfPayload.failedNodes !== undefined) {
        setSummary(prev => ({
          totalNodes: wfPayload.nodeCount || prev?.totalNodes || 0,
          completedNodes: wfPayload.completedNodes ?? prev?.completedNodes ?? 0,
          failedNodes: wfPayload.failedNodes ?? prev?.failedNodes ?? 0,
          skippedNodes: prev?.skippedNodes ?? 0,
          blockedNodes: prev?.blockedNodes ?? 0,
          validatedNodes: prev?.validatedNodes ?? 0,
          validationFailedNodes: prev?.validationFailedNodes ?? 0,
          queuedNodes: prev?.queuedNodes ?? 0,
          durationMs: prev?.durationMs ?? 0,
          parallelGroups: prev?.parallelGroups ?? 0,
          tokenSavingEstimate: prev?.tokenSavingEstimate ?? 0,
          criticalPathLength: prev?.criticalPathLength ?? 0,
          timeSavedMs: prev?.timeSavedMs ?? 0
        }))
      }

      // Handle completion
      if (event === 'workflow:complete' && onComplete && summary) {
        onComplete(summary)
      }

      // Handle failure
      if (event === 'workflow:failed' && onFailed) {
        onFailed(wfPayload.message || 'Workflow failed')
      }

      setLastUpdate(Date.now())
    }
  }, [lastEvent, onComplete, onFailed, summary])

  // Compute live summary from nodes if no summary provided
  const computedSummary = useMemo((): GraphSummary => {
    if (summary) return summary

    const nodeArray = Object.values(nodes)
    return {
      totalNodes: nodeArray.length,
      completedNodes: nodeArray.filter(n => n.status === 'completed' || n.status === 'validated').length,
      failedNodes: nodeArray.filter(n => n.status === 'failed').length,
      skippedNodes: nodeArray.filter(n => n.status === 'skipped').length,
      blockedNodes: nodeArray.filter(n => n.status === 'blocked').length,
      validatedNodes: nodeArray.filter(n => n.status === 'validated').length,
      validationFailedNodes: nodeArray.filter(n => n.status === 'validation_failed').length,
      queuedNodes: nodeArray.filter(n => n.status === 'queued').length,
      durationMs: 0,
      parallelGroups: 0,
      tokenSavingEstimate: 0,
      criticalPathLength: 0,
      timeSavedMs: 0
    }
  }, [nodes, summary])

  return (
    <div>
      {/* Connection status indicator */}
      {!isConnected && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#fef3c7',
          border: '1px solid #fcd34d',
          borderRadius: '8px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          color: '#92400e'
        }}>
          <span>⚠️</span>
          <span>Conexión WebSocket no disponible. Los datos pueden no estar actualizados.</span>
        </div>
      )}

      {/* CSS for animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      <WorkflowGraphViewer
        graphId={workflowId}
        nodes={nodes}
        summary={computedSummary}
        onRetryNode={onRetryNode}
        onSkipNode={onSkipNode}
        compact={compact}
        isLive={isConnected}
      />

      {/* Last update indicator */}
      <div style={{
        textAlign: 'center',
        fontSize: '11px',
        color: '#9ca3af',
        marginTop: '8px'
      }}>
        Última actualización: {new Date(lastUpdate).toLocaleTimeString()}
      </div>
    </div>
  )
}

/**
 * Map event status string to NodeStatus
 */
function mapStatusFromEvent(status: string): NodeStatus {
  const statusMap: Record<string, NodeStatus> = {
    'pending': 'pending',
    'queued': 'queued',
    'running': 'running',
    'started': 'running',
    'in_progress': 'running',
    'validated': 'validated',
    'completed': 'completed',
    'success': 'completed',
    'failed': 'failed',
    'error': 'failed',
    'skipped': 'skipped',
    'cancelled': 'cancelled',
    'blocked': 'blocked',
    'validation_failed': 'validation_failed'
  }
  return statusMap[status.toLowerCase()] || 'pending'
}
