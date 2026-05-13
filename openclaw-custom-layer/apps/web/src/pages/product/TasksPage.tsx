/**
 * Tasks Page - Task Operating System
 * P2: Product Experience Layer
 * P6.1: Functional task buttons
 *
 * View and manage all tasks with multiple view modes.
 */

import { useState, useEffect } from 'react'
import { useNavigation, useSearchParams } from '../../hooks/useNavigation'
import { api, type GranClawTask, type TaskStatus } from '../../services/api'
import { useRuntimeWs, useRuntimeEvents } from '../../hooks/useRuntimeWs'
import { createTask, retryTask, cancelTask, type ActionResult } from '../../services/actions'

type ViewMode = 'list' | 'timeline' | 'grouped'

export function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { navigate } = useNavigation()
  const { isConnected } = useRuntimeWs()
  const { lastEvent } = useRuntimeEvents('runtime', ['workflow:created', 'workflow:complete', 'workflow:failed'])

  const [tasks, setTasks] = useState<GranClawTask[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all')

  // P6.1: Modal and action state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [taskInput, setTaskInput] = useState('')
  const [taskMode, setTaskMode] = useState<'safe' | 'free'>('safe')
  const [creating, setCreating] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionFeedback, setActionFeedback] = useState<{ id: string; result: ActionResult } | null>(null)

  // P6.1: Open modal from URL param
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setShowCreateModal(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    loadTasks()
  }, [])

  useEffect(() => {
    if (lastEvent) {
      setTimeout(loadTasks, 500)
    }
  }, [lastEvent])

  const loadTasks = async () => {
    try {
      const response = await api.getTasks()
      if (response.success && response.data) {
        setTasks(response.data)
      }
    } catch (err) {
      console.error('Error loading tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.status === filter)

  // P6.1: Create task handler
  const handleCreateTask = async () => {
    if (!taskInput.trim()) return

    setCreating(true)
    const result = await createTask({
      message: taskInput.trim(),
      mode: taskMode,
      priority: 'normal'
    })

    setCreating(false)

    if (result.success) {
      setShowCreateModal(false)
      setTaskInput('')
      setTaskMode('safe')
      // Reload tasks after creation
      loadTasks()
    } else {
      setActionFeedback({ id: 'create', result })
      setTimeout(() => setActionFeedback(null), 3000)
    }
  }

  // P6.1: Retry task handler
  const handleRetryTask = async (taskId: string) => {
    setActionLoading(taskId)
    const result = await retryTask(taskId)
    setActionLoading(null)

    setActionFeedback({ id: taskId, result })
    setTimeout(() => setActionFeedback(null), 3000)

    if (result.success) {
      loadTasks()
    }
  }

  // P6.1: Cancel task handler
  const handleCancelTask = async (taskId: string) => {
    setActionLoading(taskId)
    const result = await cancelTask(taskId)
    setActionLoading(null)

    setActionFeedback({ id: taskId, result })
    setTimeout(() => setActionFeedback(null), 3000)

    if (result.success) {
      loadTasks()
    }
  }

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'success': return { bg: '#dcfce7', text: '#16a34a', label: 'Completada' }
      case 'running': return { bg: '#dbeafe', text: '#2563eb', label: 'Ejecutando' }
      case 'blocked': return { bg: '#fee2e2', text: '#dc2626', label: 'Bloqueada' }
      case 'error': return { bg: '#fef3c7', text: '#d97706', label: 'Error' }
      case 'unconfirmed': return { bg: '#f3e8ff', text: '#7c3aed', label: 'Sin confirmar' }
      default: return { bg: '#f3f4f6', text: '#6b7280', label: 'Pendiente' }
    }
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '20px',
    marginBottom: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s'
  }

  const headerStyle: React.CSSProperties = {
    marginBottom: '24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '16px'
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '8px'
  }

  const tabsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px'
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: active ? '#0f172a' : '#f1f5f9',
    color: active ? 'white' : '#64748b',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer'
  })

  const filterStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '24px'
  }

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    borderRadius: '20px',
    border: active ? 'none' : '1px solid #e2e8f0',
    backgroundColor: active ? '#0f172a' : 'white',
    color: active ? 'white' : '#64748b',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer'
  })

  const counts = {
    all: tasks.length,
    running: tasks.filter(t => t.status === 'running').length,
    success: tasks.filter(t => t.status === 'success').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
    error: tasks.filter(t => t.status === 'error').length,
    unconfirmed: tasks.filter(t => t.status === 'unconfirmed').length
  }

  return (
    <div>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={titleStyle}>Tareas</h1>
            {isConnected && (
              <span style={{
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: '600',
                backgroundColor: '#dcfce7',
                color: '#16a34a'
              }}>
                LIVE
              </span>
            )}
          </div>
          <p style={{ color: '#64748b' }}>Task Operating System</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
        >
          + Nueva Tarea
        </button>
      </div>

      {/* View Tabs */}
      <div style={tabsStyle}>
        <button style={tabStyle(viewMode === 'list')} onClick={() => setViewMode('list')}>
          Lista
        </button>
        <button style={tabStyle(viewMode === 'timeline')} onClick={() => setViewMode('timeline')}>
          Timeline
        </button>
        <button style={tabStyle(viewMode === 'grouped')} onClick={() => setViewMode('grouped')}>
          Por Workflow
        </button>
      </div>

      {/* Filters */}
      <div style={filterStyle}>
        <button style={filterBtnStyle(filter === 'all')} onClick={() => setFilter('all')}>
          Todas ({counts.all})
        </button>
        <button style={filterBtnStyle(filter === 'running')} onClick={() => setFilter('running')}>
          Ejecutando ({counts.running})
        </button>
        <button style={filterBtnStyle(filter === 'success')} onClick={() => setFilter('success')}>
          Completadas ({counts.success})
        </button>
        <button style={filterBtnStyle(filter === 'blocked')} onClick={() => setFilter('blocked')}>
          Bloqueadas ({counts.blocked})
        </button>
        <button style={filterBtnStyle(filter === 'error')} onClick={() => setFilter('error')}>
          Errores ({counts.error})
        </button>
      </div>

      {/* Task List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
          Cargando tareas...
        </div>
      ) : filteredTasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚡</div>
          <div>No hay tareas {filter !== 'all' && `con estado "${filter}"`}</div>
        </div>
      ) : (
        <div>
          {filteredTasks.map(task => {
            const statusInfo = getStatusColor(task.status)
            return (
              <div
                key={task.id}
                style={{ ...cardStyle, cursor: 'pointer' }}
                onClick={() => navigate(`/tasks/${task.id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        backgroundColor: statusInfo.bg,
                        color: statusInfo.text,
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {statusInfo.label}
                      </span>
                      {task.provider && (
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                          via {task.provider}
                        </span>
                      )}
                      {task.artifacts && task.artifacts.length > 0 && (
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '10px',
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          fontSize: '11px'
                        }}>
                          {task.artifacts.length} artifact{task.artifacts.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {/* P6.3: Show summary if available, otherwise input */}
                    {task.summary ? (
                      <>
                        <div style={{ fontSize: '15px', fontWeight: '500', color: '#0f172a', marginBottom: '4px' }}>
                          {task.summary}
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>
                          {task.input}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: '15px', fontWeight: '500', color: '#0f172a', marginBottom: '4px' }}>
                        {task.input}
                      </div>
                    )}
                    {/* P6.3: Show output preview */}
                    {task.outputs && task.outputs.length > 0 && task.outputs[0].type === 'text' && (
                      <div style={{
                        fontSize: '13px',
                        color: '#475569',
                        marginTop: '8px',
                        padding: '8px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '6px',
                        maxHeight: '60px',
                        overflow: 'hidden'
                      }}>
                        {String(task.outputs[0].value).substring(0, 150)}
                        {String(task.outputs[0].value).length > 150 && '...'}
                      </div>
                    )}
                    {/* P6.13: Show failure explanation if available, otherwise fallback to error */}
                    {task.failureExplanation ? (
                      <div style={{
                        fontSize: '13px',
                        marginTop: '8px',
                        padding: '10px',
                        backgroundColor: '#fef2f2',
                        borderRadius: '6px',
                        borderLeft: '3px solid #dc2626'
                      }}>
                        <div style={{ fontWeight: '600', color: '#991b1b', marginBottom: '4px' }}>
                          {task.failureExplanation.title}
                        </div>
                        <div style={{ color: '#7f1d1d' }}>
                          {task.failureExplanation.humanMessage}
                        </div>
                        {task.failureExplanation.capability && (
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                            Capacidad: {task.failureExplanation.capability}
                          </div>
                        )}
                      </div>
                    ) : task.error ? (
                      <div style={{ fontSize: '13px', color: '#dc2626', marginTop: '8px' }}>
                        Error: {task.error}
                      </div>
                    ) : (task.status === 'error' && task.source === 'validation') ? (
                      <div style={{
                        fontSize: '13px',
                        marginTop: '8px',
                        padding: '10px',
                        backgroundColor: '#fef2f2',
                        borderRadius: '6px',
                        borderLeft: '3px solid #dc2626'
                      }}>
                        <div style={{ fontWeight: '600', color: '#991b1b', marginBottom: '4px' }}>
                          Error de validación
                        </div>
                        <div style={{ color: '#7f1d1d' }}>
                          {task.reason || 'La tarea no pudo completarse. Revisa los detalles para más información.'}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {new Date(task.createdAt).toLocaleString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                    {task.executionDurationMs && (
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                        {task.executionDurationMs}ms
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {(task.status === 'error' || task.status === 'blocked') && (
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRetryTask(task.id) }}
                      disabled={actionLoading === task.id}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        backgroundColor: actionLoading === task.id ? '#e2e8f0' : '#f1f5f9',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: actionLoading === task.id ? 'not-allowed' : 'pointer',
                        color: '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {actionLoading === task.id ? '...' : 'Reintentar'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/tasks/${task.id}`) }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        backgroundColor: '#f1f5f9',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: '#475569'
                      }}
                    >
                      Ver detalles
                    </button>
                    {actionFeedback?.id === task.id && (
                      <span style={{
                        fontSize: '12px',
                        color: actionFeedback.result.success ? '#16a34a' : '#dc2626'
                      }}>
                        {actionFeedback.result.message}
                      </span>
                    )}
                  </div>
                )}
                {task.status === 'running' && (
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCancelTask(task.id) }}
                      disabled={actionLoading === task.id}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        backgroundColor: actionLoading === task.id ? '#fecaca' : '#fee2e2',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: actionLoading === task.id ? 'not-allowed' : 'pointer',
                        color: '#dc2626'
                      }}
                    >
                      {actionLoading === task.id ? '...' : 'Cancelar'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/tasks/${task.id}`) }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        backgroundColor: '#f1f5f9',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: '#475569'
                      }}
                    >
                      Ver detalles
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* P6.1: Create Task Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#0f172a', margin: 0 }}>
                Nueva Tarea
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#94a3b8'
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#475569', marginBottom: '6px' }}>
                Descripcion de la tarea
              </label>
              <textarea
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                placeholder="Describe lo que quieres que el agente haga..."
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
                autoFocus
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#475569', marginBottom: '8px' }}>
                Modo de ejecucion
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setTaskMode('safe')}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: taskMode === 'safe' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                    backgroundColor: taskMode === 'safe' ? '#eff6ff' : 'white',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ fontWeight: '600', color: '#0f172a', marginBottom: '4px' }}>Seguro</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Requiere aprobacion para acciones destructivas</div>
                </button>
                <button
                  onClick={() => setTaskMode('free')}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: taskMode === 'free' ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                    backgroundColor: taskMode === 'free' ? '#fffbeb' : 'white',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ fontWeight: '600', color: '#0f172a', marginBottom: '4px' }}>Libre</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Ejecuta sin restricciones</div>
                </button>
              </div>
            </div>

            {actionFeedback?.id === 'create' && !actionFeedback.result.success && (
              <div style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                fontSize: '13px',
                marginBottom: '16px'
              }}>
                {actionFeedback.result.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: 'white',
                  color: '#475569',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateTask}
                disabled={!taskInput.trim() || creating}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: !taskInput.trim() || creating ? '#94a3b8' : '#3b82f6',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: !taskInput.trim() || creating ? 'not-allowed' : 'pointer'
                }}
              >
                {creating ? 'Creando...' : 'Crear Tarea'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
