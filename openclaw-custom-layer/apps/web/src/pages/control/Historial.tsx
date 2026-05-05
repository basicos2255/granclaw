/**
 * Historial Page - Lista de acciones ejecutadas
 * FEATURE 061: UI orientada a caso de uso
 * FEATURE 062: Refinamiento visual empresarial
 * FEATURE 063: UI v3 - impacto visual en historial
 * FEATURE 080: Task System v1 - historial desde backend
 */

import { useState, useEffect } from 'react'
import { api, type GranClawTask, type TaskStatus } from '../../services/api'

export function Historial() {
  const [tasks, setTasks] = useState<GranClawTask[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<GranClawTask | null>(null)

  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = async () => {
    setLoading(true)
    try {
      const response = await api.getTasks()
      if (response.success && response.data) {
        setTasks(response.data)
      }
    } catch {
      // Error loading tasks
    } finally {
      setLoading(false)
    }
  }

  // FEATURE 080: Determinar si fue permitido según status
  const isAllowed = (status: TaskStatus): boolean => {
    return status === 'success' || status === 'unconfirmed'
  }

  // FEATURE 080: Colores según status
  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'success':
        return { main: '#16a34a', bg: '#dcfce7' }
      case 'blocked':
        return { main: '#dc2626', bg: '#fee2e2' }
      case 'error':
        return { main: '#6b7280', bg: '#f3f4f6' }
      case 'unconfirmed':
        return { main: '#d97706', bg: '#fef3c7' }
      case 'running':
        return { main: '#2563eb', bg: '#dbeafe' }
      default:
        return { main: '#9ca3af', bg: '#f9fafb' }
    }
  }

  // FEATURE 080: Texto según status
  const getStatusText = (status: TaskStatus): string => {
    switch (status) {
      case 'success': return 'PERMITIDO'
      case 'blocked': return 'BLOQUEADO'
      case 'error': return 'ERROR'
      case 'unconfirmed': return 'SIN CONFIRMAR'
      case 'running': return 'EJECUTANDO'
      default: return 'PENDIENTE'
    }
  }

  // FEATURE 080: Icono según status
  const getStatusIcon = (status: TaskStatus): string => {
    switch (status) {
      case 'success': return '✓'
      case 'blocked': return '✕'
      case 'error': return '⚠'
      case 'unconfirmed': return '?'
      case 'running': return '⟳'
      default: return '○'
    }
  }

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: '#f9fafb'
  }

  const containerStyle: React.CSSProperties = {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '48px 24px'
  }

  const headerStyle: React.CSSProperties = {
    marginBottom: '40px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: '12px'
  }

  const subtitleStyle: React.CSSProperties = {
    fontSize: '18px',
    color: '#6b7280',
    lineHeight: '1.6'
  }

  const refreshButtonStyle: React.CSSProperties = {
    padding: '10px 20px',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  }

  const listStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  }

  const itemStyle = (status: TaskStatus): React.CSSProperties => {
    const colors = getStatusColor(status)
    return {
      display: 'flex',
      alignItems: 'center',
      gap: '18px',
      padding: '22px 28px',
      backgroundColor: isAllowed(status) ? 'white' : colors.bg,
      borderRadius: '14px',
      border: `2px solid ${isAllowed(status) ? '#e5e7eb' : colors.main}`,
      cursor: 'pointer',
      transition: 'transform 0.1s ease'
    }
  }

  const statusBadgeStyle = (status: TaskStatus): React.CSSProperties => {
    const colors = getStatusColor(status)
    return {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '44px',
      height: '44px',
      borderRadius: '50%',
      backgroundColor: colors.bg,
      border: `2px solid ${colors.main}`,
      fontSize: '20px',
      flexShrink: 0
    }
  }

  const contentStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0
  }

  const lineStyle: React.CSSProperties = {
    fontSize: '16px',
    color: '#111827',
    lineHeight: '1.6'
  }

  const inputStyle: React.CSSProperties = {
    fontWeight: '500',
    color: '#374151',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '400px',
    display: 'inline-block'
  }

  const resultStyle = (status: TaskStatus): React.CSSProperties => ({
    fontWeight: '700',
    color: getStatusColor(status).main,
    fontSize: '15px'
  })

  const metaStyle: React.CSSProperties = {
    fontSize: '13px',
    color: '#6b7280',
    marginTop: '4px',
    display: 'flex',
    gap: '12px'
  }

  const timeStyle: React.CSSProperties = {
    fontSize: '13px',
    color: '#9ca3af',
    flexShrink: 0,
    fontWeight: '500',
    textAlign: 'right'
  }

  const emptyStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '80px 20px',
    backgroundColor: 'white',
    borderRadius: '16px',
    border: '1px solid #e5e7eb'
  }

  const loadingStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#6b7280'
  }

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr)
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // FEATURE 080: Modal de detalle
  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  }

  const modalStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '32px',
    maxWidth: '700px',
    width: '90%',
    maxHeight: '80vh',
    overflow: 'auto'
  }

  const modalHeaderStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  }

  const closeButtonStyle: React.CSSProperties = {
    padding: '8px 16px',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px'
  }

  const detailRowStyle: React.CSSProperties = {
    display: 'flex',
    borderBottom: '1px solid #e5e7eb',
    padding: '12px 0'
  }

  const detailLabelStyle: React.CSSProperties = {
    width: '140px',
    fontWeight: '600',
    color: '#374151',
    flexShrink: 0
  }

  const detailValueStyle: React.CSSProperties = {
    flex: 1,
    color: '#6b7280',
    wordBreak: 'break-word'
  }

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div style={headerStyle}>
          <div>
            <h1 style={titleStyle}>Historial de tareas</h1>
            <p style={subtitleStyle}>
              Registro de todas las acciones ejecutadas
            </p>
          </div>
          <button style={refreshButtonStyle} onClick={loadTasks}>
            Actualizar
          </button>
        </div>

        {loading ? (
          <div style={loadingStyle}>Cargando historial...</div>
        ) : tasks.length === 0 ? (
          <div style={emptyStyle}>
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>📋</div>
            <div style={{ color: '#6b7280', fontSize: '16px' }}>
              Sin tareas registradas
            </div>
          </div>
        ) : (
          <div style={listStyle}>
            {tasks.map((task) => (
              <div
                key={task.id}
                style={itemStyle(task.status)}
                onClick={() => setSelectedTask(task)}
              >
                <div style={statusBadgeStyle(task.status)}>
                  {getStatusIcon(task.status)}
                </div>
                <div style={contentStyle}>
                  <div style={lineStyle}>
                    <span style={inputStyle}>{task.input}</span>
                    {' → '}
                    <span style={resultStyle(task.status)}>
                      {getStatusText(task.status)}
                    </span>
                  </div>
                  <div style={metaStyle}>
                    {task.source && <span>Fuente: {task.source}</span>}
                    {task.executionDurationMs && <span>{task.executionDurationMs}ms</span>}
                  </div>
                </div>
                <div style={timeStyle}>{formatTime(task.createdAt)}</div>
              </div>
            ))}
          </div>
        )}

        {/* FEATURE 080: Modal de detalle */}
        {selectedTask && (
          <div style={modalOverlayStyle} onClick={() => setSelectedTask(null)}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
              <div style={modalHeaderStyle}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
                  Detalle de tarea
                </h2>
                <button style={closeButtonStyle} onClick={() => setSelectedTask(null)}>
                  Cerrar
                </button>
              </div>

              <div style={detailRowStyle}>
                <div style={detailLabelStyle}>ID</div>
                <div style={{ ...detailValueStyle, fontFamily: 'monospace', fontSize: '13px' }}>
                  {selectedTask.id}
                </div>
              </div>

              <div style={detailRowStyle}>
                <div style={detailLabelStyle}>Estado</div>
                <div style={{ ...detailValueStyle, color: getStatusColor(selectedTask.status).main, fontWeight: '600' }}>
                  {getStatusText(selectedTask.status)}
                </div>
              </div>

              <div style={detailRowStyle}>
                <div style={detailLabelStyle}>Input</div>
                <div style={detailValueStyle}>{selectedTask.input}</div>
              </div>

              {selectedTask.result !== undefined && selectedTask.result !== null && (
                <div style={detailRowStyle}>
                  <div style={detailLabelStyle}>Resultado</div>
                  <div style={{ ...detailValueStyle, whiteSpace: 'pre-wrap' }}>
                    {typeof selectedTask.result === 'string'
                      ? selectedTask.result
                      : JSON.stringify(selectedTask.result, null, 2)}
                  </div>
                </div>
              )}

              {selectedTask.reason && (
                <div style={detailRowStyle}>
                  <div style={detailLabelStyle}>Motivo</div>
                  <div style={detailValueStyle}>{selectedTask.reason}</div>
                </div>
              )}

              {selectedTask.error && (
                <div style={detailRowStyle}>
                  <div style={detailLabelStyle}>Error</div>
                  <div style={{ ...detailValueStyle, color: '#dc2626' }}>{selectedTask.error}</div>
                </div>
              )}

              <div style={detailRowStyle}>
                <div style={detailLabelStyle}>Fuente</div>
                <div style={detailValueStyle}>{selectedTask.source || 'unknown'}</div>
              </div>

              {selectedTask.executionDurationMs && (
                <div style={detailRowStyle}>
                  <div style={detailLabelStyle}>Duración</div>
                  <div style={detailValueStyle}>{selectedTask.executionDurationMs}ms</div>
                </div>
              )}

              <div style={detailRowStyle}>
                <div style={detailLabelStyle}>Request ID</div>
                <div style={{ ...detailValueStyle, fontFamily: 'monospace', fontSize: '12px' }}>
                  {selectedTask.requestId || 'N/A'}
                </div>
              </div>

              <div style={detailRowStyle}>
                <div style={detailLabelStyle}>Creado</div>
                <div style={detailValueStyle}>{new Date(selectedTask.createdAt).toLocaleString('es-ES')}</div>
              </div>

              {selectedTask.executionTrace && selectedTask.executionTrace.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
                    Trace de ejecución
                  </h3>
                  <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', fontSize: '13px' }}>
                    {selectedTask.executionTrace.map((step, idx) => (
                      <div key={idx} style={{ padding: '8px 0', borderBottom: idx < selectedTask.executionTrace!.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                        <span style={{ fontWeight: '600' }}>{step.label}</span>
                        {step.detail && <span style={{ color: '#6b7280' }}> - {step.detail}</span>}
                        {step.durationMs && <span style={{ color: '#9ca3af' }}> ({step.durationMs}ms)</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedTask.debugSnapshot && (
                <div style={{ marginTop: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
                    Debug Snapshot
                  </h3>
                  <pre style={{
                    backgroundColor: '#f9fafb',
                    padding: '16px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    overflow: 'auto',
                    maxHeight: '200px'
                  }}>
                    {JSON.stringify(selectedTask.debugSnapshot, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
