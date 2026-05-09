/**
 * Product Dashboard
 * P2: Product Experience Layer
 * P2.2: API Base URL & Runtime State Fetch Fix
 * P6.1: Functional Quick Action buttons
 *
 * Main dashboard showing runtime health, tasks, automations, token savings.
 */

import { useState, useEffect } from 'react'
import { useNavigation } from '../../hooks/useNavigation'
import { useRuntimeWs, useQueueEvents, useRuntimeEvents } from '../../hooks/useRuntimeWs'
import { getRuntimeState, RuntimeStateData, getPairingHealth, PairingHealthData, getOpenClawAuthHealth, OpenClawAuthHealthData } from '../../services/api'

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
  const { navigate } = useNavigation()
  const { isConnected } = useRuntimeWs()
  const { lastEvent: queueEvent } = useQueueEvents()
  // P6.4: Subscribe to pairing state events
  const { lastEvent: pairingEvent } = useRuntimeEvents('runtime', ['pairing:state-change'])
  // P6.4R: Subscribe to OpenClaw auth events
  const { lastEvent: openclawEvent } = useRuntimeEvents('runtime', [
    'openclaw-connected',
    'openclaw-disconnected',
    'openclaw-degraded',
    'pairing-expired',
    'reauthorization-required',
    'repair-required',
    'pairing-restored',
    'openclaw-health-change'
  ])

  const [runtimeState, setRuntimeState] = useState<RuntimeState | null>(null)
  const [pairingHealth, setPairingHealth] = useState<PairingHealthData | null>(null)
  const [openclawHealth, setOpenclawHealth] = useState<OpenClawAuthHealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)

  useEffect(() => {
    loadRuntimeState()
    loadPairingHealth()
    loadOpenClawHealth() // P6.4R
    const interval = setInterval(loadRuntimeState, 30000) // Refresh every 30s as backup
    return () => clearInterval(interval)
  }, [])

  // Update from WS events
  useEffect(() => {
    if (queueEvent) {
      loadRuntimeState()
    }
  }, [queueEvent])

  // P6.4: Update pairing health from WS events
  useEffect(() => {
    if (pairingEvent) {
      loadPairingHealth()
    }
  }, [pairingEvent])

  // P6.4R: Update OpenClaw auth health from WS events
  useEffect(() => {
    if (openclawEvent) {
      loadOpenClawHealth()
    }
  }, [openclawEvent])

  // P6.4: Load pairing health
  const loadPairingHealth = async () => {
    try {
      const result = await getPairingHealth()
      if (result.success && result.data) {
        setPairingHealth(result.data)
      }
    } catch (err) {
      console.error('Error loading pairing health:', err)
    }
  }

  // P6.4R: Load OpenClaw auth health
  const loadOpenClawHealth = async () => {
    try {
      const result = await getOpenClawAuthHealth()
      if (result.success && result.data) {
        setOpenclawHealth(result.data)
      }
    } catch (err) {
      console.error('Error loading OpenClaw auth health:', err)
    }
  }

  // P2.2: Use centralized API client
  const loadRuntimeState = async () => {
    try {
      const result = await getRuntimeState()

      if (result.success && result.data) {
        // Map API response to component state
        const data = result.data as RuntimeStateData
        setRuntimeState({
          queueStats: data.queueStats || {
            pendingJobs: data.queueState?.totalPending || 0,
            runningJobs: data.queueState?.totalRunning || 0,
            completedJobs: 0,
            failedJobs: 0
          },
          queuePressure: data.queuePressure || {
            status: (data.queueState?.pressure || 0) < 0.5 ? 'ok' : (data.queueState?.pressure || 0) < 0.8 ? 'warning' : 'critical',
            message: ''
          },
          deadLetters: data.deadLetters || { count: data.queueState?.deadLetters || 0 },
          activeWorkflows: data.activeWorkflows || { count: data.dagState?.activeWorkflows || 0 },
          websocket: data.websocket || { activeConnections: data.wsState?.activeConnections || 0 }
        })
        setApiError(null)
      } else {
        // P2.2: Show degraded state instead of crashing
        setApiError(result.error || 'Error desconocido')
      }
    } catch (err) {
      console.error('Error loading runtime state:', err)
      setApiError('Error inesperado al cargar estado')
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

  // P2.2: Show degraded state card if API error
  const ApiErrorCard = () => apiError ? (
    <div style={{
      backgroundColor: '#fef2f2',
      border: '1px solid #fecaca',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '24px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <span style={{ fontSize: '24px' }}>⚠️</span>
        <span style={{ fontWeight: '600', color: '#dc2626' }}>No se pudo conectar con Runtime API</span>
      </div>
      <p style={{ color: '#7f1d1d', fontSize: '14px', margin: 0 }}>
        {apiError}
      </p>
      <p style={{ color: '#991b1b', fontSize: '12px', marginTop: '8px', marginBottom: 0 }}>
        Verifica que el backend este corriendo en VITE_API_BASE_URL
      </p>
    </div>
  ) : null

  return (
    <div>
      {/* P2.2: API Error Banner */}
      <ApiErrorCard />

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

      {/* P6.4: OpenClaw/Pairing Health */}
      <div style={sectionTitleStyle}>
        <span>🔗</span>
        <span>OpenClaw Connection</span>
      </div>
      <div style={gridStyle}>
        <div style={statCardStyle}>
          <span style={statLabelStyle}>Estado de Pairing</span>
          {pairingHealth ? (
            <div style={healthBadgeStyle(
              pairingHealth.overall === 'paired' ? 'ok' :
              pairingHealth.overall === 'degraded' ? 'warning' :
              pairingHealth.overall === 'blocked' || pairingHealth.overall === 'error' || pairingHealth.overall === 'disconnected' ? 'critical' :
              'loading'
            )}>
              {pairingHealth.overall === 'paired' && '✓ Conectado y pareado'}
              {pairingHealth.overall === 'degraded' && '⚠ Degradado (algunos scopes)'}
              {pairingHealth.overall === 'blocked' && '⚠ Bloqueado - requiere auth'}
              {pairingHealth.overall === 'connected' && '○ Conectado (sin auth)'}
              {pairingHealth.overall === 'disconnected' && '✗ Desconectado'}
              {pairingHealth.overall === 'error' && '✗ Error de conexion'}
              {pairingHealth.overall === 'unknown' && '? Estado desconocido'}
            </div>
          ) : (
            <div style={healthBadgeStyle('loading')}>Cargando...</div>
          )}
        </div>

        <div style={statCardStyle}>
          <span style={statLabelStyle}>Capacidad</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {pairingHealth?.canExecute ? (
              <span style={{ color: '#16a34a', fontWeight: '600' }}>✓ Puede ejecutar</span>
            ) : (
              <span style={{ color: '#dc2626', fontWeight: '600' }}>✗ No puede ejecutar</span>
            )}
          </div>
        </div>

        {pairingHealth?.issues && pairingHealth.issues.length > 0 && (
          <div style={{ ...statCardStyle, backgroundColor: '#fef3c7', borderColor: '#fde68a' }}>
            <span style={{ ...statLabelStyle, color: '#92400e' }}>Issues ({pairingHealth.issues.length})</span>
            <div style={{ fontSize: '13px', color: '#78350f' }}>
              {pairingHealth.issues.slice(0, 2).map((issue, i) => (
                <div key={i} style={{ marginBottom: '4px' }}>
                  {issue.severity === 'critical' ? '!' : issue.severity === 'error' ? '!' : '⚠'} {issue.message}
                </div>
              ))}
              {pairingHealth.issues.length > 2 && (
                <div style={{ fontSize: '12px', color: '#a16207' }}>
                  +{pairingHealth.issues.length - 2} mas...
                </div>
              )}
            </div>
          </div>
        )}
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
        <button
          onClick={() => navigate('/tasks?create=true')}
          style={{
            ...cardStyle,
            cursor: 'pointer',
            border: '2px dashed #e2e8f0',
            backgroundColor: '#fafafa',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            padding: '32px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f0f9ff'
            e.currentTarget.style.borderColor = '#3b82f6'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#fafafa'
            e.currentTarget.style.borderColor = '#e2e8f0'
          }}
        >
          <span style={{ fontSize: '32px' }}>⚡</span>
          <span style={{ fontWeight: '600', color: '#374151' }}>Nueva Tarea</span>
        </button>

        <button
          onClick={() => navigate('/automations?create=true')}
          style={{
            ...cardStyle,
            cursor: 'pointer',
            border: '2px dashed #e2e8f0',
            backgroundColor: '#fafafa',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            padding: '32px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f0f9ff'
            e.currentTarget.style.borderColor = '#3b82f6'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#fafafa'
            e.currentTarget.style.borderColor = '#e2e8f0'
          }}
        >
          <span style={{ fontSize: '32px' }}>🔄</span>
          <span style={{ fontWeight: '600', color: '#374151' }}>Nueva Automatización</span>
        </button>

        <button
          onClick={() => navigate('/channels?connect=true')}
          style={{
            ...cardStyle,
            cursor: 'pointer',
            border: '2px dashed #e2e8f0',
            backgroundColor: '#fafafa',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            padding: '32px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f0f9ff'
            e.currentTarget.style.borderColor = '#3b82f6'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#fafafa'
            e.currentTarget.style.borderColor = '#e2e8f0'
          }}
        >
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
