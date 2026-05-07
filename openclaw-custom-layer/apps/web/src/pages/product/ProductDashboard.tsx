/**
 * Product Dashboard
 * P2: Product Experience Layer
 *
 * Main dashboard showing runtime health, tasks, automations, token savings.
 */

import { useState, useEffect } from 'react'
import { useRuntimeWs, useQueueEvents } from '../../hooks/useRuntimeWs'

interface RuntimeState {
  queueStats: {
    pendingJobs: number
    runningJobs: number
    completedJobs: number
    failedJobs: number
  }
  queuePressure: {
    status: 'ok' | 'warning' | 'critical'
    message: string
  }
  deadLetters: {
    count: number
  }
  activeWorkflows: {
    count: number
  }
  websocket: {
    activeConnections: number
  }
}

export function ProductDashboard() {
  const { isConnected } = useRuntimeWs()
  const { lastEvent: queueEvent } = useQueueEvents()

  const [runtimeState, setRuntimeState] = useState<RuntimeState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRuntimeState()
    const interval = setInterval(loadRuntimeState, 30000) // Refresh every 30s as backup
    return () => clearInterval(interval)
  }, [])

  // Update from WS events
  useEffect(() => {
    if (queueEvent) {
      loadRuntimeState()
    }
  }, [queueEvent])

  const loadRuntimeState = async () => {
    try {
      const response = await fetch('/api/runtime/state')
      if (response.ok) {
        const data = await response.json()
        setRuntimeState(data)
      }
    } catch (err) {
      console.error('Error loading runtime state:', err)
    } finally {
      setLoading(false)
    }
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  }

  const headerStyle: React.CSSProperties = {
    marginBottom: '32px'
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '8px'
  }

  const subtitleStyle: React.CSSProperties = {
    fontSize: '16px',
    color: '#64748b'
  }

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
    marginBottom: '32px'
  }

  const statCardStyle: React.CSSProperties = {
    ...cardStyle,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  }

  const statLabelStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: '500',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  }

  const statValueStyle: React.CSSProperties = {
    fontSize: '36px',
    fontWeight: '700',
    color: '#0f172a'
  }

  const healthBadgeStyle = (status: 'ok' | 'warning' | 'critical' | 'loading'): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '600',
    backgroundColor: status === 'ok' ? '#dcfce7' : (status === 'warning' ? '#fef3c7' : (status === 'critical' ? '#fee2e2' : '#f3f4f6')),
    color: status === 'ok' ? '#16a34a' : (status === 'warning' ? '#d97706' : (status === 'critical' ? '#dc2626' : '#6b7280'))
  })

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
        Cargando dashboard...
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={titleStyle}>Dashboard</h1>
          {isConnected && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: '600',
              backgroundColor: '#dcfce7',
              color: '#16a34a'
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#16a34a',
                animation: 'pulse 2s infinite'
              }} />
              LIVE
            </span>
          )}
        </div>
        <p style={subtitleStyle}>Vista general del sistema agente</p>
      </div>

      {/* Runtime Health */}
      <div style={sectionTitleStyle}>
        <span>🖥️</span>
        <span>Runtime Health</span>
      </div>
      <div style={gridStyle}>
        <div style={statCardStyle}>
          <span style={statLabelStyle}>Estado</span>
          <div style={healthBadgeStyle(runtimeState?.queuePressure?.status || 'loading')}>
            {runtimeState?.queuePressure?.status === 'ok' && '✓ Operando normalmente'}
            {runtimeState?.queuePressure?.status === 'warning' && '⚠ Carga moderada'}
            {runtimeState?.queuePressure?.status === 'critical' && '⚠ Alta carga'}
            {!runtimeState && 'Cargando...'}
          </div>
        </div>

        <div style={statCardStyle}>
          <span style={statLabelStyle}>WebSocket</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={statValueStyle}>{runtimeState?.websocket?.activeConnections || 0}</span>
            <span style={{ color: '#64748b', fontSize: '14px' }}>conexiones</span>
          </div>
        </div>

        <div style={statCardStyle}>
          <span style={statLabelStyle}>Dead Letters</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ ...statValueStyle, color: (runtimeState?.deadLetters?.count || 0) > 0 ? '#dc2626' : '#16a34a' }}>
              {runtimeState?.deadLetters?.count || 0}
            </span>
            <span style={{ color: '#64748b', fontSize: '14px' }}>fallidas</span>
          </div>
        </div>
      </div>

      {/* Active Tasks */}
      <div style={sectionTitleStyle}>
        <span>⚡</span>
        <span>Tareas Activas</span>
      </div>
      <div style={gridStyle}>
        <div style={statCardStyle}>
          <span style={statLabelStyle}>En ejecución</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ ...statValueStyle, color: '#3b82f6' }}>
              {runtimeState?.queueStats?.runningJobs || 0}
            </span>
          </div>
        </div>

        <div style={statCardStyle}>
          <span style={statLabelStyle}>En cola</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ ...statValueStyle, color: '#8b5cf6' }}>
              {runtimeState?.queueStats?.pendingJobs || 0}
            </span>
          </div>
        </div>

        <div style={statCardStyle}>
          <span style={statLabelStyle}>Workflows activos</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ ...statValueStyle, color: '#0ea5e9' }}>
              {runtimeState?.activeWorkflows?.count || 0}
            </span>
          </div>
        </div>

        <div style={statCardStyle}>
          <span style={statLabelStyle}>Completadas hoy</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ ...statValueStyle, color: '#16a34a' }}>
              {runtimeState?.queueStats?.completedJobs || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={sectionTitleStyle}>
        <span>🚀</span>
        <span>Acciones Rápidas</span>
      </div>
      <div style={{ ...gridStyle, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <button style={{
          ...cardStyle,
          cursor: 'pointer',
          border: '2px dashed #e2e8f0',
          backgroundColor: '#fafafa',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          padding: '32px'
        }}>
          <span style={{ fontSize: '32px' }}>⚡</span>
          <span style={{ fontWeight: '600', color: '#374151' }}>Nueva Tarea</span>
        </button>

        <button style={{
          ...cardStyle,
          cursor: 'pointer',
          border: '2px dashed #e2e8f0',
          backgroundColor: '#fafafa',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          padding: '32px'
        }}>
          <span style={{ fontSize: '32px' }}>🔄</span>
          <span style={{ fontWeight: '600', color: '#374151' }}>Nueva Automatización</span>
        </button>

        <button style={{
          ...cardStyle,
          cursor: 'pointer',
          border: '2px dashed #e2e8f0',
          backgroundColor: '#fafafa',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          padding: '32px'
        }}>
          <span style={{ fontSize: '32px' }}>🔌</span>
          <span style={{ fontWeight: '600', color: '#374151' }}>Conectar Canal</span>
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
