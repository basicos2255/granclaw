/**
 * WhatsApp Channel Page
 * P3: Real Integrations & Operational Channels
 *
 * WhatsApp Business integration management.
 */

import { useState, useEffect } from 'react'
import { useRuntimeWs } from '../../hooks/useRuntimeWs'

interface WhatsAppChat {
  id: string
  name: string
  phone: string
  lastMessage: string
  lastMessageAt: string
  unreadCount: number
  isGroup: boolean
}

interface AutoReplyRule {
  id: string
  name: string
  trigger: string
  response: string
  enabled: boolean
  mode: 'safe' | 'approval' | 'autonomous'
}

export function WhatsAppPage() {
  const { isConnected } = useRuntimeWs()
  const [chats, setChats] = useState<WhatsAppChat[]>([])
  const [rules, setRules] = useState<AutoReplyRule[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'chats' | 'rules' | 'settings'>('chats')
  const [autoReplyMode, setAutoReplyMode] = useState<'off' | 'safe' | 'approval' | 'autonomous'>('safe')

  useEffect(() => {
    // Mock data
    setTimeout(() => {
      setChats([
        { id: '1', name: 'Juan Perez', phone: '+34612345678', lastMessage: 'Hola, necesito informacion sobre precios', lastMessageAt: new Date().toISOString(), unreadCount: 2, isGroup: false },
        { id: '2', name: 'Maria Garcia', phone: '+34687654321', lastMessage: 'Gracias por la respuesta!', lastMessageAt: new Date(Date.now() - 3600000).toISOString(), unreadCount: 0, isGroup: false },
        { id: '3', name: 'Soporte Clientes', phone: '', lastMessage: 'Nuevo ticket #234', lastMessageAt: new Date(Date.now() - 7200000).toISOString(), unreadCount: 5, isGroup: true }
      ])
      setRules([
        { id: 'r1', name: 'Saludo', trigger: 'hola|buenos dias|buenas', response: 'Hola! Gracias por contactarnos. En breve te atenderemos.', enabled: true, mode: 'safe' },
        { id: 'r2', name: 'Precios', trigger: 'precio|costo|cuanto', response: 'Te enviamos informacion de precios. Un representante te contactara.', enabled: true, mode: 'approval' },
        { id: 'r3', name: 'Fuera de horario', trigger: '*', response: 'Estamos fuera de horario. Te responderemos manana.', enabled: false, mode: 'safe' }
      ])
      setLoading(false)
    }, 500)
  }, [])

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'safe': return { bg: '#dcfce7', text: '#16a34a' }
      case 'approval': return { bg: '#fef3c7', text: '#d97706' }
      case 'autonomous': return { bg: '#fee2e2', text: '#dc2626' }
      default: return { bg: '#f3f4f6', text: '#6b7280' }
    }
  }

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

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span style={{ fontSize: '32px' }}>💬</span>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a' }}>WhatsApp Business</h1>
            <span style={{
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: '600',
              backgroundColor: '#dbeafe',
              color: '#2563eb'
            }}>
              BETA
            </span>
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
          <p style={{ color: '#64748b' }}>Gestion de mensajes y automatizaciones</p>
        </div>
      </div>

      {/* Auto-reply mode selector */}
      <div style={{
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontWeight: '600', color: '#0f172a', marginBottom: '4px' }}>Modo Autorespuesta</div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            {autoReplyMode === 'off' && 'Las respuestas automaticas estan desactivadas'}
            {autoReplyMode === 'safe' && 'Solo respuestas seguras predefinidas'}
            {autoReplyMode === 'approval' && 'Requiere aprobacion humana antes de enviar'}
            {autoReplyMode === 'autonomous' && 'Responde automaticamente (usar con precaucion)'}
          </div>
        </div>
        <select
          value={autoReplyMode}
          onChange={(e) => setAutoReplyMode(e.target.value as typeof autoReplyMode)}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            fontSize: '14px',
            color: '#0f172a',
            backgroundColor: 'white'
          }}
        >
          <option value="off">Desactivado</option>
          <option value="safe">Modo Seguro</option>
          <option value="approval">Requiere Aprobacion</option>
          <option value="autonomous">Autonomo</option>
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button style={tabStyle(activeTab === 'chats')} onClick={() => setActiveTab('chats')}>
          Chats ({chats.reduce((acc, c) => acc + c.unreadCount, 0)} sin leer)
        </button>
        <button style={tabStyle(activeTab === 'rules')} onClick={() => setActiveTab('rules')}>
          Reglas Automaticas ({rules.filter(r => r.enabled).length})
        </button>
        <button style={tabStyle(activeTab === 'settings')} onClick={() => setActiveTab('settings')}>
          Configuracion
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>Cargando...</div>
      ) : (
        <>
          {/* Chats Tab */}
          {activeTab === 'chats' && (
            <div>
              {chats.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                  No hay chats recientes
                </div>
              ) : (
                chats.map(chat => (
                  <div key={chat.id} style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    padding: '16px 20px',
                    marginBottom: '8px',
                    cursor: 'pointer'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: chat.isGroup ? '#dbeafe' : '#dcfce7',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '18px'
                        }}>
                          {chat.isGroup ? '👥' : '👤'}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: '600', color: '#0f172a' }}>{chat.name}</span>
                            {chat.unreadCount > 0 && (
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '11px',
                                backgroundColor: '#3b82f6',
                                color: 'white'
                              }}>
                                {chat.unreadCount}
                              </span>
                            )}
                          </div>
                          {chat.phone && (
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>{chat.phone}</div>
                          )}
                          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                            {chat.lastMessage.substring(0, 50)}{chat.lastMessage.length > 50 ? '...' : ''}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {new Date(chat.lastMessageAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))
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
                  + Nueva Regla
                </button>
              </div>
              {rules.map(rule => {
                const modeColor = getModeColor(rule.mode)
                return (
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: '600', color: '#0f172a' }}>{rule.name}</span>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            backgroundColor: modeColor.bg,
                            color: modeColor.text
                          }}>
                            {rule.mode}
                          </span>
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
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                          Trigger: <code style={{ backgroundColor: '#f1f5f9', padding: '2px 4px', borderRadius: '3px' }}>{rule.trigger}</code>
                        </div>
                        <div style={{ fontSize: '13px', color: '#475569' }}>
                          {rule.response}
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
                        <button style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: '#f1f5f9',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: '#475569'
                        }}>
                          Editar
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
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
                Configuracion de WhatsApp Business
              </h3>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                  Phone Number ID
                </label>
                <input
                  type="text"
                  placeholder="xxxxxxxxxx"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                  Business Account ID
                </label>
                <input
                  type="text"
                  placeholder="xxxxxxxxxx"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                  Max Auto-replies per Hour
                </label>
                <input
                  type="number"
                  defaultValue={100}
                  style={{
                    width: '150px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{
                padding: '16px',
                backgroundColor: '#fef3c7',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#92400e'
              }}>
                <strong>Nota:</strong> WhatsApp Business API requiere una cuenta verificada y aprobada por Meta.
                Las credenciales se almacenan de forma segura en el vault de credenciales.
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
