/**
 * Dashboard Page - Vista general del sistema
 * FEATURE 061: UI orientada a caso de uso
 * FEATURE 062: Refinamiento visual empresarial
 */

import { useState, useEffect } from 'react'
import { api } from '../../services/api'
import { getHistory } from './Execute'

export function Dashboard() {
  const [tenantCount, setTenantCount] = useState(0)
  const [lastAction, setLastAction] = useState<{ allowed: boolean; message: string; tenantId: string } | null>(null)
  const [systemStatus, setSystemStatus] = useState<'ok' | 'error' | 'loading'>('loading')

  useEffect(() => {
    loadData()
  }, [])

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
      </div>
    </div>
  )
}
