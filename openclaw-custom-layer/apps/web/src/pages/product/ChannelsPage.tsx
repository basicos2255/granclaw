/**
 * Channels Page
 * P2/P3: Product Experience Layer + Real Integrations
 * P6.1: Functional channel buttons
 *
 * Manage connected channels (email, ftp, browser, whatsapp, etc.)
 */

import { useState, useEffect } from 'react'
import { useSearchParams } from '../../hooks/useNavigation'
import { testChannel, type ActionResult } from '../../services/actions'

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
  const [searchParams, setSearchParams] = useSearchParams()
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)

  // P6.1: Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionFeedback, setActionFeedback] = useState<{ id: string; result: ActionResult } | null>(null)
  const [showConnectModal, setShowConnectModal] = useState(false)

  useEffect(() => {
    setTimeout(() => {
      setChannels(mockChannels)
      setLoading(false)
    }, 500)
  }, [])

  // P6.1: Handle URL param for connect modal
  useEffect(() => {
    if (searchParams.get('connect') === 'true') {
      setShowConnectModal(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // P6.1: Test channel handler
  const handleTestChannel = async (channelId: string) => {
    setActionLoading(channelId)
    setActionFeedback(null)

    const result = await testChannel(channelId)
    setActionLoading(null)

    setActionFeedback({ id: channelId, result })
    setTimeout(() => setActionFeedback(null), 4000)
  }

  // P6.1: Placeholder for not-yet-implemented actions
  const handleNotImplemented = (action: string) => {
    setActionFeedback({
      id: 'general',
      result: {
        success: false,
        status: 'not_available',
        message: `${action} no disponible aun`,
        error: 'Funcion en desarrollo'
      }
    })
    setTimeout(() => setActionFeedback(null), 3000)
  }

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
        <button
          onClick={() => setShowConnectModal(true)}
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
          + Conectar Canal
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>Cargando canales...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
          {/* P6.1: General feedback banner */}
          {actionFeedback?.id === 'general' && (
            <div style={{
              gridColumn: '1 / -1',
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: '#fef3c7',
              color: '#92400e',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>⚠️</span>
              {actionFeedback.result.message}
            </div>
          )}

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
                <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {channel.status === 'connected' && (
                    <>
                      <button
                        onClick={() => handleTestChannel(channel.id)}
                        disabled={actionLoading === channel.id}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: actionLoading === channel.id ? '#e2e8f0' : '#f1f5f9',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: actionLoading === channel.id ? 'not-allowed' : 'pointer',
                          color: '#475569'
                        }}
                      >
                        {actionLoading === channel.id ? '...' : 'Test'}
                      </button>
                      {(channel.type === 'email' || channel.type === 'whatsapp') && (
                        <button
                          onClick={() => handleNotImplemented('Ver mensajes')}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            backgroundColor: '#94a3b8',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'not-allowed',
                            opacity: 0.7
                          }}
                          title="Funcion en desarrollo"
                        >
                          Ver Mensajes
                        </button>
                      )}
                    </>
                  )}
                  {channel.status === 'disconnected' && (
                    <button
                      onClick={() => handleNotImplemented('Conectar canal')}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        backgroundColor: '#94a3b8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'not-allowed',
                        opacity: 0.7
                      }}
                      title="Funcion en desarrollo"
                    >
                      Conectar
                    </button>
                  )}
                  {channel.status === 'setup_required' && (
                    <button
                      onClick={() => handleNotImplemented('Configurar canal')}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        backgroundColor: '#d97706',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'not-allowed',
                        opacity: 0.7
                      }}
                      title="Funcion en desarrollo"
                    >
                      Configurar
                    </button>
                  )}
                  {channel.status === 'auth_expired' && (
                    <button
                      onClick={() => handleNotImplemented('Reautorizar canal')}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        backgroundColor: '#d97706',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'not-allowed',
                        opacity: 0.7
                      }}
                      title="Funcion en desarrollo"
                    >
                      Reautorizar
                    </button>
                  )}
                  <button
                    onClick={() => handleNotImplemented('Configuracion de canal')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      backgroundColor: 'transparent',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      cursor: 'not-allowed',
                      color: '#94a3b8',
                      opacity: 0.7
                    }}
                    title="Funcion en desarrollo"
                  >
                    Configurar
                  </button>
                  {actionFeedback?.id === channel.id && (
                    <span style={{
                      fontSize: '11px',
                      color: actionFeedback.result.success ? '#16a34a' : '#dc2626'
                    }}>
                      {actionFeedback.result.message}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* P6.1: Connect Channel Modal - placeholder */}
      {showConnectModal && (
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
                Conectar Canal
              </h2>
              <button
                onClick={() => setShowConnectModal(false)}
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

            <div style={{
              padding: '24px',
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔌</div>
              <div style={{ fontWeight: '600', color: '#0f172a', marginBottom: '8px' }}>
                Funcion en desarrollo
              </div>
              <div style={{ fontSize: '14px', color: '#64748b' }}>
                La conexion de nuevos canales estara disponible pronto.
                <br />
                Por ahora, los canales se configuran via API.
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowConnectModal(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
