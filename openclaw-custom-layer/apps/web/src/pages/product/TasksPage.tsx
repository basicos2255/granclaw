/**
 * Tasks Page - Task Operating System
 * P2: Product Experience Layer
 *
 * View and manage all tasks with multiple view modes.
 */

import { useState, useEffect } from 'react'
import { api, type GranClawTask, type TaskStatus } from '../../services/api'
import { useRuntimeWs, useRuntimeEvents } from '../../hooks/useRuntimeWs'

type ViewMode = 'list' | 'timeline' | 'grouped'

export function TasksPage() {
  const { isConnected } = useRuntimeWs()
  const { lastEvent } = useRuntimeEvents('runtime', ['workflow:created', 'workflow:complete', 'workflow:failed'])

  const [tasks, setTasks] = useState<GranClawTask[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all')

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

        <button style={{
          padding: '10px 20px',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '500',
          cursor: 'pointer'
        }}>
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
              <div key={task.id} style={cardStyle}>
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
                      {task.source && (
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                          via {task.source}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: '500', color: '#0f172a', marginBottom: '4px' }}>
                      {task.input}
                    </div>
                    {task.error && (
                      <div style={{ fontSize: '13px', color: '#dc2626', marginTop: '8px' }}>
                        Error: {task.error}
                      </div>
                    )}
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
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    <button style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      backgroundColor: '#f1f5f9',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      color: '#475569'
                    }}>
                      Reintentar
                    </button>
                    <button style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      backgroundColor: '#f1f5f9',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      color: '#475569'
                    }}>
                      Ver detalles
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
