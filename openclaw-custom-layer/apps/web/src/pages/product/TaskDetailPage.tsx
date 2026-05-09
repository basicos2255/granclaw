/**
 * Task Detail Page
 * P6.3: Operational UX, Result Visibility & Real Task Outcomes
 *
 * Shows detailed task information including structured results.
 */

import { useState, useEffect } from 'react'
import { useNavigation } from '../../hooks/useNavigation'
import { api, type GranClawTask } from '../../services/api'
import { OutputsRenderer, ArtifactsRenderer } from '../../components/results/ResultRenderers'
import { retryTask, cancelTask, type ActionResult } from '../../services/actions'

interface TaskDetailPageProps {
  taskId: string
}

export function TaskDetailPage({ taskId }: TaskDetailPageProps) {
  const { navigate } = useNavigation()
  const [task, setTask] = useState<GranClawTask | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionFeedback, setActionFeedback] = useState<ActionResult | null>(null)

  useEffect(() => {
    loadTask()
  }, [taskId])

  const loadTask = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await api.getTask(taskId)
      if (response.success && response.data) {
        setTask(response.data)
      } else {
        setError(response.error || 'Error cargando tarea')
      }
    } catch (err) {
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = async () => {
    setActionLoading(true)
    const result = await retryTask(taskId)
    setActionLoading(false)
    setActionFeedback(result)
    if (result.success) {
      loadTask()
    }
    setTimeout(() => setActionFeedback(null), 3000)
  }

  const handleCancel = async () => {
    setActionLoading(true)
    const result = await cancelTask(taskId)
    setActionLoading(false)
    setActionFeedback(result)
    if (result.success) {
      loadTask()
    }
    setTimeout(() => setActionFeedback(null), 3000)
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'success':
        return { bg: '#dcfce7', color: '#16a34a', label: 'Completada', icon: 'check' }
      case 'running':
        return { bg: '#dbeafe', color: '#2563eb', label: 'Ejecutando', icon: 'play' }
      case 'blocked':
        return { bg: '#fee2e2', color: '#dc2626', label: 'Bloqueada', icon: 'ban' }
      case 'error':
        return { bg: '#fef3c7', color: '#d97706', label: 'Error', icon: 'alert' }
      case 'unconfirmed':
        return { bg: '#f3e8ff', color: '#7c3aed', label: 'Sin confirmar', icon: 'question' }
      case 'pending':
        return { bg: '#f1f5f9', color: '#64748b', label: 'Pendiente', icon: 'clock' }
      default:
        return { bg: '#f3f4f6', color: '#6b7280', label: status, icon: 'info' }
    }
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '20px',
    marginBottom: '16px'
  }

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: '600',
    color: '#475569',
    marginBottom: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
        Cargando tarea...
      </div>
    )
  }

  if (error || !task) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ color: '#dc2626', marginBottom: '16px' }}>{error || 'Tarea no encontrada'}</div>
        <button
          onClick={() => navigate('/tasks')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Volver a Tareas
        </button>
      </div>
    )
  }

  const statusInfo = getStatusInfo(task.status)

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/tasks')}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            fontSize: '14px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          ← Volver a Tareas
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px 0' }}>
              Detalle de Tarea
            </h1>
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              ID: {task.id}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {(task.status === 'error' || task.status === 'blocked') && (
              <button
                onClick={handleRetry}
                disabled={actionLoading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: actionLoading ? '#e2e8f0' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  fontSize: '13px'
                }}
              >
                {actionLoading ? '...' : 'Reintentar'}
              </button>
            )}
            {task.status === 'running' && (
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: actionLoading ? '#fecaca' : '#fee2e2',
                  color: '#dc2626',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  fontSize: '13px'
                }}
              >
                {actionLoading ? '...' : 'Cancelar'}
              </button>
            )}
          </div>
        </div>

        {actionFeedback && (
          <div style={{
            marginTop: '12px',
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: actionFeedback.success ? '#dcfce7' : '#fef2f2',
            color: actionFeedback.success ? '#16a34a' : '#dc2626',
            fontSize: '13px'
          }}>
            {actionFeedback.message}
          </div>
        )}
      </div>

      {/* Status & Summary */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '16px' }}>
          <span style={{
            padding: '6px 16px',
            borderRadius: '20px',
            backgroundColor: statusInfo.bg,
            color: statusInfo.color,
            fontSize: '13px',
            fontWeight: '600'
          }}>
            {statusInfo.label}
          </span>

          {task.provider && (
            <span style={{
              padding: '6px 12px',
              borderRadius: '20px',
              backgroundColor: '#f1f5f9',
              color: '#475569',
              fontSize: '12px'
            }}>
              via {task.provider}
            </span>
          )}

          {task.executionDurationMs && (
            <span style={{
              padding: '6px 12px',
              borderRadius: '20px',
              backgroundColor: '#f1f5f9',
              color: '#475569',
              fontSize: '12px'
            }}>
              {task.executionDurationMs}ms
            </span>
          )}
        </div>

        {/* Summary */}
        {task.summary && (
          <div style={{
            padding: '16px',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <div style={{ fontSize: '16px', color: '#0f172a', fontWeight: '500' }}>
              {task.summary}
            </div>
          </div>
        )}

        {/* Input */}
        <div>
          <div style={sectionTitleStyle}>Entrada</div>
          <div style={{
            padding: '12px',
            backgroundColor: '#f1f5f9',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#374151'
          }}>
            {task.input}
          </div>
        </div>
      </div>

      {/* Outputs */}
      {task.outputs && task.outputs.length > 0 && (
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Resultados</div>
          <OutputsRenderer outputs={task.outputs} />
        </div>
      )}

      {/* Artifacts */}
      {task.artifacts && task.artifacts.length > 0 && (
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Artifacts ({task.artifacts.length})</div>
          <ArtifactsRenderer artifacts={task.artifacts} />
        </div>
      )}

      {/* Error */}
      {task.error && (
        <div style={{
          ...cardStyle,
          backgroundColor: '#fef2f2',
          borderColor: '#fecaca'
        }}>
          <div style={{ ...sectionTitleStyle, color: '#dc2626' }}>Error</div>
          <div style={{ color: '#991b1b', fontSize: '14px' }}>
            {task.error}
          </div>
          {task.reason && (
            <div style={{ color: '#7f1d1d', fontSize: '13px', marginTop: '8px' }}>
              Razon: {task.reason}
            </div>
          )}
        </div>
      )}

      {/* Execution Trace */}
      {task.executionTrace && task.executionTrace.length > 0 && (
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Workflow ({task.executionTrace.length} pasos)</div>
          <div>
            {task.executionTrace.map((step, idx) => (
              <div key={step.id || idx} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                backgroundColor: idx % 2 ? '#f8fafc' : 'white',
                borderRadius: '6px',
                marginBottom: '4px'
              }}>
                <span style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: step.status === 'success' ? '#dcfce7' :
                                   step.status === 'error' ? '#fee2e2' : '#f1f5f9',
                  color: step.status === 'success' ? '#16a34a' :
                         step.status === 'error' ? '#dc2626' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  {idx + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '500', color: '#0f172a', fontSize: '13px' }}>
                    {step.label}
                  </div>
                  {step.detail && (
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {step.detail}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {step.stage}
                  {step.durationMs && ` - ${step.durationMs}ms`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>Metadata</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px'
        }}>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Creada</div>
            <div style={{ fontSize: '14px', color: '#0f172a' }}>
              {new Date(task.createdAt).toLocaleString('es-ES')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Actualizada</div>
            <div style={{ fontSize: '14px', color: '#0f172a' }}>
              {new Date(task.updatedAt).toLocaleString('es-ES')}
            </div>
          </div>
          {task.source && (
            <div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Fuente</div>
              <div style={{ fontSize: '14px', color: '#0f172a' }}>{task.source}</div>
            </div>
          )}
          {task.requestId && (
            <div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Request ID</div>
              <div style={{ fontSize: '12px', color: '#0f172a', fontFamily: 'monospace' }}>
                {task.requestId}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
