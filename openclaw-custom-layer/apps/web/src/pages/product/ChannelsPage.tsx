/**
 * Channels Page
 * P2/P3: Product Experience Layer + Real Integrations
 *
 * Manage connected channels (email, ftp, browser, whatsapp, etc.)
 */

import { useState, useEffect } from 'react'

interface Channel {
  id: string
  type: 'email' | 'ftp' | 'sftp' | 'browser' | 'filesystem' | 'calendar' | 'whatsapp' | 'api' | 'webhook'
  name: string
  status: 'connected' | 'disconnected' | 'connecting' | 'error' | 'auth_expired' | 'setup_required' | 'rate_limited'
  stability: 'stable' | 'beta' | 'experimental'
  health: {
    isHealthy: boolean
    issues: string[]
  }
  lastActivity?: string
  scopes?: string[]
  metrics?: {
    messagesProcessed: number
    errorsLastHour: number
  }
}

const mockChannels: Channel[] = [
  { id: 'ch-1', type: 'email', name: 'Gmail Work', status: 'connected', stability: 'stable', health: { isHealthy: true, issues: [] }, scopes: ['email.read', 'email.send'], metrics: { messagesProcessed: 156, errorsLastHour: 0 } },
  { id: 'ch-2', type: 'whatsapp', name: 'WhatsApp Business', status: 'connected', stability: 'beta', health: { isHealthy: true, issues: [] }, scopes: ['whatsapp.read', 'whatsapp.send'], metrics: { messagesProcessed: 89, errorsLastHour: 2 } },
  { id: 'ch-3', type: 'ftp', name: 'FTP Deploy Server', status: 'connected', stability: 'stable', health: { isHealthy: true, issues: [] }, scopes: ['ftp.read', 'ftp.write'] },
  { id: 'ch-4', type: 'browser', name: 'Browser Automation', status: 'setup_required', stability: 'beta', health: { isHealthy: false, issues: ['Playwright not configured'] } },
  { id: 'ch-5', type: 'calendar', name: 'Google Calendar', status: 'auth_expired', stability: 'stable', health: { isHealthy: false, issues: ['OAuth token expired'] } },
  { id: 'ch-6', type: 'filesystem', name: 'Local Files', status: 'connected', stability: 'stable', health: { isHealthy: true, issues: [] }, scopes: ['fs.read', 'fs.write'] }
]

export function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setTimeout(() => {
      setChannels(mockChannels)
      setLoading(false)
    }, 500)
  }, [])

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'email': return '📧'
      case 'ftp': return '📂'
      case 'sftp': return '🔐'
      case 'browser': return '🌐'
      case 'filesystem': return '💾'
      case 'calendar': return '📅'
      case 'whatsapp': return '💬'
      case 'api': return '🔗'
      case 'webhook': return '🪝'
      default: return '🔌'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return { bg: '#dcfce7', text: '#16a34a', label: 'Conectado' }
      case 'connecting': return { bg: '#dbeafe', text: '#2563eb', label: 'Conectando...' }
      case 'disconnected': return { bg: '#f3f4f6', text: '#6b7280', label: 'Desconectado' }
      case 'error': return { bg: '#fee2e2', text: '#dc2626', label: 'Error' }
      case 'auth_expired': return { bg: '#fef3c7', text: '#d97706', label: 'Auth Expirada' }
      case 'setup_required': return { bg: '#fef3c7', text: '#d97706', label: 'Configurar' }
      case 'rate_limited': return { bg: '#fce7f3', text: '#db2777', label: 'Rate Limited' }
      default: return { bg: '#f3f4f6', text: '#6b7280', label: status }
    }
  }

  const getStabilityBadge = (stability: string) => {
    switch (stability) {
      case 'stable': return { bg: '#dcfce7', text: '#16a34a', label: 'STABLE' }
      case 'beta': return { bg: '#dbeafe', text: '#2563eb', label: 'BETA' }
      case 'experimental': return { bg: '#fef3c7', text: '#d97706', label: 'EXPERIMENTAL' }
      default: return null
    }
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '20px',
    marginBottom: '12px'
  }

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Canales</h1>
          <p style={{ color: '#64748b' }}>Conexiones a servicios externos</p>
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
          + Conectar Canal
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>Cargando canales...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
          {channels.map(channel => {
            const statusInfo = getStatusColor(channel.status)
            const stabilityInfo = getStabilityBadge(channel.stability)
            return (
              <div key={channel.id} style={{
                ...cardStyle,
                borderColor: channel.health.isHealthy ? '#e2e8f0' : '#fecaca'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px'
                  }}>
                    {getTypeIcon(channel.type)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: '600', color: '#0f172a' }}>{channel.name}</span>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        backgroundColor: statusInfo.bg,
                        color: statusInfo.text
                      }}>
                        {statusInfo.label}
                      </span>
                      {stabilityInfo && stabilityInfo.label !== 'STABLE' && (
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '9px',
                          fontWeight: '600',
                          backgroundColor: stabilityInfo.bg,
                          color: stabilityInfo.text
                        }}>
                          {stabilityInfo.label}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748b', textTransform: 'capitalize' }}>
                      {channel.type}
                    </div>
                    {channel.scopes && channel.scopes.length > 0 && (
                      <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {channel.scopes.slice(0, 4).map(scope => (
                          <span key={scope} style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#f1f5f9',
                            fontSize: '10px',
                            color: '#64748b'
                          }}>
                            {scope.split('.')[1] || scope}
                          </span>
                        ))}
                        {channel.scopes.length > 4 && (
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                            +{channel.scopes.length - 4} mas
                          </span>
                        )}
                      </div>
                    )}
                    {!channel.health.isHealthy && channel.health.issues.length > 0 && (
                      <div style={{
                        marginTop: '8px',
                        padding: '6px 10px',
                        backgroundColor: '#fef2f2',
                        borderRadius: '6px',
                        fontSize: '11px',
                        color: '#dc2626'
                      }}>
                        {channel.health.issues[0]}
                      </div>
                    )}
                    {channel.metrics && (
                      <div style={{ marginTop: '8px', fontSize: '11px', color: '#94a3b8' }}>
                        {channel.metrics.messagesProcessed} procesados
                        {channel.metrics.errorsLastHour > 0 && (
                          <span style={{ color: '#dc2626', marginLeft: '8px' }}>
                            {channel.metrics.errorsLastHour} errores/h
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {channel.status === 'connected' && (
                    <>
                      <button style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        backgroundColor: '#f1f5f9',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: '#475569'
                      }}>
                        Test
                      </button>
                      {(channel.type === 'email' || channel.type === 'whatsapp') && (
                        <button style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}>
                          Ver Mensajes
                        </button>
                      )}
                    </>
                  )}
                  {channel.status === 'disconnected' && (
                    <button style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}>
                      Conectar
                    </button>
                  )}
                  {channel.status === 'setup_required' && (
                    <button style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      backgroundColor: '#f59e0b',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}>
                      Configurar
                    </button>
                  )}
                  {channel.status === 'auth_expired' && (
                    <button style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      backgroundColor: '#f59e0b',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}>
                      Reautorizar
                    </button>
                  )}
                  <button style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    backgroundColor: 'transparent',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: '#64748b'
                  }}>
                    Configurar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
