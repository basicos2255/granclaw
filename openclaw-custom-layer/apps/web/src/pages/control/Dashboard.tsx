/**
 * Dashboard Page - Vista general del sistema
 * FEATURE 061: UI orientada a caso de uso
 * FEATURE 062: Refinamiento visual empresarial
 * P1.2: Live WebSocket updates for realtime system status
 */

import { useState, useEffect } from 'react'
import { api } from '../../services/api'
import { getHistory } from './Execute'
import { useRuntimeWs, useQueueEvents, useRuntimeEvents } from '../../hooks/useRuntimeWs'

/**
 * P1.2: Queue pressure payload type
 */
interface QueuePressurePayload {
  queuePressure?: {
    pending: number
    running: number
    status: 'ok' | 'warning' | 'critical'
  }
}

/**
 * P1.2: System health payload type
 */
interface SystemHealthPayload {
  status?: 'ok' | 'warning' | 'error'
  memory?: { used: number; total: number }
  cpu?: number
}

export function Dashboard() {
  const [tenantCount, setTenantCount] = useState(0)
  const [lastAction, setLastAction] = useState<{ allowed: boolean; message: string; tenantId: string } | null>(null)
  const [systemStatus, setSystemStatus] = useState<'ok' | 'error' | 'loading'>('loading')

  // P1.2: Live WebSocket connection
  const { isConnected } = useRuntimeWs()
  const { lastEvent: queueEvent } = useQueueEvents()
  const { lastEvent: systemEvent } = useRuntimeEvents<SystemHealthPayload>('runtime', ['system:health-change'])

  // P1.2: Queue stats from live events
  const [queueStats, setQueueStats] = useState({ pending: 0, running: 0, status: 'ok' as 'ok' | 'warning' | 'critical' })

  useEffect(() => {
    loadData()
  }, [])

  // P1.2: Update queue stats from WebSocket events
  useEffect(() => {
    if (queueEvent?.payload) {
      const payload = queueEvent.payload as QueuePressurePayload
      if (payload.queuePressure) {
        setQueueStats(payload.queuePressure)
      }
    }
  }, [queueEvent])

  // P1.2: Update system status from WebSocket events
  useEffect(() => {
    if (systemEvent?.payload?.status) {
      const status = systemEvent.payload.status
      setSystemStatus(status === 'warning' ? 'ok' : status)
    }
  }, [systemEvent])

  const loadData = async () => {
    try {
      // Cargar configuración del Hub
      const hubResponse = await api.getHubConfig()
      if (hubResponse.success && hubResponse.data) {
        setTenantCount(1 + Object.keys(hubResponse.data.tenants).length)
      }

      // Última acción del historial local
      const history = getHistory()
      if (history.length > 0) {
        setLastAction({
          allowed: history[0].allowed,
          message: history[0].message,
          tenantId: history[0].tenantId
        })
      }

      // Verificar estado del sistema
      const healthResponse = await api.getHealth()
      setSystemStatus(healthResponse.success ? 'ok' : 'error')
    } catch {
      setSystemStatus('error')
    }
  }

  // FEATURE 062: Estilos refinados
  const green = '#22c55e'
  const red = '#ef4444'

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: '#f9fafb'
  }

  const containerStyle: React.CSSProperties = {
    maxWidth: '720px',
    margin: '0 auto',
    padding: '48px 24px'
  }

  const headerStyle: React.CSSProperties = {
    marginBottom: '40px'
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

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px'
  }

  const cardStyle: React.CSSProperties = {
    padding: '28px',
    backgroundColor: 'white',
    borderRadius: '16px',
    border: '1px solid #e5e7eb'
  }

  const cardTitleStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: '12px'
  }

  const cardValueStyle: React.CSSProperties = {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#111827'
  }

  const statusBadgeStyle = (status: 'ok' | 'error' | 'loading'): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    borderRadius: '24px',
    backgroundColor: status === 'ok' ? green : (status === 'error' ? red : '#9ca3af'),
    color: 'white',
    fontWeight: '600',
    fontSize: '15px'
  })

  const lastActionBadgeStyle = (allowed: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    borderRadius: '24px',
    backgroundColor: allowed ? green : red,
    color: 'white',
    fontWeight: '600',
    fontSize: '15px'
  })

  const lastActionDetailStyle: React.CSSProperties = {
    marginTop: '16px',
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '10px',
    fontSize: '14px',
    color: '#374151'
  }

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div style={headerStyle}>
          <h1 style={titleStyle}>Panel de control</h1>
          <p style={subtitleStyle}>
            Estado del sistema de seguridad empresarial
          </p>
        </div>

        <div style={gridStyle}>
          <div style={cardStyle}>
            <div style={cardTitleStyle}>Empresas activas</div>
            <div style={cardValueStyle}>{tenantCount}</div>
          </div>

          <div style={cardStyle}>
            <div style={cardTitleStyle}>Estado del sistema</div>
            <div style={statusBadgeStyle(systemStatus)}>
              {systemStatus === 'ok' && '🟢 OK'}
              {systemStatus === 'error' && '🔴 Error'}
              {systemStatus === 'loading' && '⏳ Verificando'}
            </div>
          </div>

          {/* P1.2: Live WebSocket connection status */}
          <div style={cardStyle}>
            <div style={cardTitleStyle}>Conexión Live</div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '24px',
              backgroundColor: isConnected ? green : '#9ca3af',
              color: 'white',
              fontWeight: '600',
              fontSize: '15px'
            }}>
              {isConnected ? (
                <>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    animation: 'pulse 2s infinite'
                  }} />
                  Conectado
                </>
              ) : (
                '⚫ Desconectado'
              )}
            </div>
          </div>

          {/* P1.2: Queue stats from live events */}
          <div style={cardStyle}>
            <div style={cardTitleStyle}>Cola de tareas</div>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2563eb' }}>
                  {queueStats.running}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Ejecutando</div>
              </div>
              <div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#6b7280' }}>
                  {queueStats.pending}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Pendientes</div>
              </div>
              <div style={{
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: '600',
                backgroundColor: queueStats.status === 'ok' ? '#dcfce7' : (queueStats.status === 'warning' ? '#fef3c7' : '#fee2e2'),
                color: queueStats.status === 'ok' ? '#16a34a' : (queueStats.status === 'warning' ? '#d97706' : '#dc2626')
              }}>
                {queueStats.status.toUpperCase()}
              </div>
            </div>
          </div>

          <div style={{ ...cardStyle, gridColumn: '1 / -1' }}>
            <div style={cardTitleStyle}>Última acción</div>
            {lastAction ? (
              <div>
                <div style={lastActionBadgeStyle(lastAction.allowed)}>
                  {lastAction.allowed ? '🟢 Permitida' : '🔴 Bloqueada'}
                </div>
                <div style={lastActionDetailStyle}>
                  <strong>{lastAction.tenantId === 'default' ? 'Global' : lastAction.tenantId}</strong> → {lastAction.message}
                </div>
              </div>
            ) : (
              <div style={{ color: '#9ca3af', fontSize: '15px' }}>
                Sin acciones registradas
              </div>
            )}
          </div>
        </div>

        {/* P1.2: CSS for animations */}
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </div>
    </div>
  )
}
