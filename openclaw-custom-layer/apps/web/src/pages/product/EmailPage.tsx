/**
 * Email Channel Page
 * P3: Real Integrations & Operational Channels
 *
 * Email integration management.
 */

import { useState, useEffect } from 'react'
import { useRuntimeWs } from '../../hooks/useRuntimeWs'

interface EmailThread {
  id: string
  subject: string
  from: string
  preview: string
  receivedAt: string
  isRead: boolean
  isUrgent: boolean
  hasAttachments: boolean
  classification: 'invoice' | 'support' | 'urgent' | 'newsletter' | 'personal' | 'unknown'
}

interface AutomationRule {
  id: string
  name: string
  condition: string
  action: string
  enabled: boolean
}

export function EmailPage() {
  const { isConnected } = useRuntimeWs()
  const [threads, setThreads] = useState<EmailThread[]>([])
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'inbox' | 'rules' | 'settings'>('inbox')
  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent'>('all')

  useEffect(() => {
    setTimeout(() => {
      setThreads([
        { id: '1', subject: 'Factura #12345 - Servicios Marzo', from: 'facturacion@empresa.com', preview: 'Adjuntamos la factura correspondiente...', receivedAt: new Date().toISOString(), isRead: false, isUrgent: false, hasAttachments: true, classification: 'invoice' },
        { id: '2', subject: 'URGENTE: Problema con pedido', from: 'cliente@gmail.com', preview: 'Necesito ayuda urgente con mi pedido...', receivedAt: new Date(Date.now() - 1800000).toISOString(), isRead: false, isUrgent: true, hasAttachments: false, classification: 'urgent' },
        { id: '3', subject: 'Reunion manana a las 10', from: 'jefe@empresa.com', preview: 'Te confirmo la reunion de manana...', receivedAt: new Date(Date.now() - 3600000).toISOString(), isRead: true, isUrgent: false, hasAttachments: false, classification: 'personal' },
        { id: '4', subject: 'Newsletter Semanal', from: 'news@marketing.com', preview: 'Las ultimas novedades de la semana...', receivedAt: new Date(Date.now() - 7200000).toISOString(), isRead: true, isUrgent: false, hasAttachments: false, classification: 'newsletter' },
        { id: '5', subject: 'Ticket #567 - Soporte tecnico', from: 'soporte@cliente.es', preview: 'Gracias por contactar con soporte...', receivedAt: new Date(Date.now() - 10800000).toISOString(), isRead: false, isUrgent: false, hasAttachments: false, classification: 'support' }
      ])
      setRules([
        { id: 'r1', name: 'Facturas a contabilidad', condition: 'clasificacion = factura', action: 'Reenviar a contabilidad@empresa.com', enabled: true },
        { id: 'r2', name: 'Urgentes a notificacion', condition: 'clasificacion = urgente', action: 'Notificar por push + WhatsApp', enabled: true },
        { id: 'r3', name: 'Newsletters archivados', condition: 'clasificacion = newsletter', action: 'Archivar automaticamente', enabled: false }
      ])
      setLoading(false)
    }, 500)
  }, [])

  const getClassificationBadge = (classification: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      invoice: { bg: '#dbeafe', text: '#2563eb', label: 'Factura' },
      support: { bg: '#dcfce7', text: '#16a34a', label: 'Soporte' },
      urgent: { bg: '#fee2e2', text: '#dc2626', label: 'Urgente' },
      newsletter: { bg: '#f3f4f6', text: '#6b7280', label: 'Newsletter' },
      personal: { bg: '#e0e7ff', text: '#4f46e5', label: 'Personal' },
      unknown: { bg: '#f3f4f6', text: '#6b7280', label: 'Sin clasificar' }
    }
    return badges[classification] || badges.unknown
  }

  const filteredThreads = threads.filter(t => {
    if (filter === 'unread') return !t.isRead
    if (filter === 'urgent') return t.isUrgent
    return true
  })

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '500',
    backgroundColor: active ? '#0f172a' : 'transparent',
    color: active ? 'white' : '#64748b',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  })

  const filterStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    fontSize: '13px',
    backgroundColor: active ? '#e2e8f0' : 'transparent',
    color: active ? '#0f172a' : '#64748b',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  })

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span style={{ fontSize: '32px' }}>📧</span>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a' }}>Email</h1>
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
          <p style={{ color: '#64748b' }}>Inbox inteligente con clasificacion automatica</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {[
          { label: 'Sin leer', value: threads.filter(t => !t.isRead).length, color: '#3b82f6' },
          { label: 'Urgentes', value: threads.filter(t => t.isUrgent).length, color: '#dc2626' },
          { label: 'Facturas', value: threads.filter(t => t.classification === 'invoice').length, color: '#2563eb' },
          { label: 'Soporte', value: threads.filter(t => t.classification === 'support').length, color: '#16a34a' }
        ].map((stat, i) => (
          <div key={i} style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '16px 20px'
          }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '13px', color: '#64748b' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button style={tabStyle(activeTab === 'inbox')} onClick={() => setActiveTab('inbox')}>
          Inbox
        </button>
        <button style={tabStyle(activeTab === 'rules')} onClick={() => setActiveTab('rules')}>
          Automatizaciones
        </button>
        <button style={tabStyle(activeTab === 'settings')} onClick={() => setActiveTab('settings')}>
          Configuracion
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>Cargando...</div>
      ) : (
        <>
          {/* Inbox Tab */}
          {activeTab === 'inbox' && (
            <div>
              {/* Filters */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
                <button style={filterStyle(filter === 'all')} onClick={() => setFilter('all')}>
                  Todos ({threads.length})
                </button>
                <button style={filterStyle(filter === 'unread')} onClick={() => setFilter('unread')}>
                  Sin leer ({threads.filter(t => !t.isRead).length})
                </button>
                <button style={filterStyle(filter === 'urgent')} onClick={() => setFilter('urgent')}>
                  Urgentes ({threads.filter(t => t.isUrgent).length})
                </button>
              </div>

              {filteredThreads.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                  No hay emails en esta vista
                </div>
              ) : (
                filteredThreads.map(thread => {
                  const badge = getClassificationBadge(thread.classification)
                  return (
                    <div key={thread.id} style={{
                      backgroundColor: thread.isRead ? 'white' : '#f8fafc',
                      borderRadius: '12px',
                      border: `1px solid ${thread.isUrgent ? '#fecaca' : '#e2e8f0'}`,
                      padding: '16px 20px',
                      marginBottom: '8px',
                      cursor: 'pointer'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                            {!thread.isRead && (
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
                            )}
                            <span style={{ fontWeight: thread.isRead ? '500' : '600', color: '#0f172a' }}>
                              {thread.subject}
                            </span>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              backgroundColor: badge.bg,
                              color: badge.text
                            }}>
                              {badge.label}
                            </span>
                            {thread.hasAttachments && (
                              <span style={{ fontSize: '12px' }}>📎</span>
                            )}
                          </div>
                          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>
                            {thread.from}
                          </div>
                          <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                            {thread.preview}
                          </div>
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', marginLeft: '16px' }}>
                          {new Date(thread.receivedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* Rules Tab */}
          {activeTab === 'rules' && (
            <div>
              <div style={{ marginBottom: '16px' }}>
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
                  + Nueva Automatizacion
                </button>
              </div>
              {rules.map(rule => (
                <div key={rule.id} style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  padding: '16px 20px',
                  marginBottom: '8px',
                  opacity: rule.enabled ? 1 : 0.6
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontWeight: '600', color: '#0f172a' }}>{rule.name}</span>
                        {!rule.enabled && (
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            backgroundColor: '#f3f4f6',
                            color: '#6b7280'
                          }}>
                            DESACTIVADA
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>
                        <strong>Si:</strong> {rule.condition}
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748b' }}>
                        <strong>Entonces:</strong> {rule.action}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        backgroundColor: rule.enabled ? '#fee2e2' : '#dcfce7',
                        color: rule.enabled ? '#dc2626' : '#16a34a',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}>
                        {rule.enabled ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '24px'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0f172a', marginBottom: '20px' }}>
                Configuracion IMAP/SMTP
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                    IMAP Host
                  </label>
                  <input
                    type="text"
                    placeholder="imap.gmail.com"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                    IMAP Port
                  </label>
                  <input
                    type="number"
                    defaultValue={993}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    placeholder="smtp.gmail.com"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                    SMTP Port
                  </label>
                  <input
                    type="number"
                    defaultValue={587}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                  Poll Interval (segundos)
                </label>
                <input
                  type="number"
                  defaultValue={60}
                  style={{
                    width: '150px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '14px'
                  }}
                />
              </div>

              <button style={{
                marginTop: '20px',
                padding: '10px 20px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}>
                Guardar Configuracion
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
