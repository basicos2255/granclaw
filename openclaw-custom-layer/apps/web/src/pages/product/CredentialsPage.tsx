/**
 * Credentials Page - Credential Vault UX
 * P2: Product Experience Layer
 *
 * Manage credentials without showing secrets.
 */

import { useState, useEffect } from 'react'

interface Credential {
  id: string
  name: string
  type: 'api_key' | 'oauth' | 'password' | 'token'
  service: string
  status: 'active' | 'expired' | 'revoked'
  lastUsed?: string
  expiresAt?: string
  scopes?: string[]
}

const mockCredentials: Credential[] = [
  { id: 'cred-1', name: 'OpenClaw API', type: 'api_key', service: 'openclaw', status: 'active', lastUsed: new Date().toISOString(), scopes: ['execute', 'tools'] },
  { id: 'cred-2', name: 'Gmail OAuth', type: 'oauth', service: 'google', status: 'active', expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(), scopes: ['mail.read', 'mail.send'] },
  { id: 'cred-3', name: 'FTP Server', type: 'password', service: 'ftp', status: 'expired' }
]

export function CredentialsPage() {
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setTimeout(() => {
      setCredentials(mockCredentials)
      setLoading(false)
    }, 500)
  }, [])

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'api_key': return '🔑'
      case 'oauth': return '🔐'
      case 'password': return '🔒'
      case 'token': return '🎫'
      default: return '🔑'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return { bg: '#dcfce7', text: '#16a34a', label: 'Activo' }
      case 'expired': return { bg: '#fee2e2', text: '#dc2626', label: 'Expirado' }
      case 'revoked': return { bg: '#f3f4f6', text: '#6b7280', label: 'Revocado' }
      default: return { bg: '#f3f4f6', text: '#6b7280', label: status }
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Credenciales</h1>
          <p style={{ color: '#64748b' }}>Gestión segura de credenciales</p>
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
          + Nueva Credencial
        </button>
      </div>

      {/* Security Notice */}
      <div style={{
        backgroundColor: '#f0f9ff',
        border: '1px solid #bae6fd',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <span style={{ fontSize: '20px' }}>🔒</span>
        <div style={{ fontSize: '14px', color: '#0369a1' }}>
          Los valores de las credenciales están encriptados y nunca se muestran en la interfaz.
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>Cargando credenciales...</div>
      ) : (
        <div>
          {credentials.map(credential => {
            const statusInfo = getStatusColor(credential.status)
            return (
              <div key={credential.id} style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                padding: '20px',
                marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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
                      {getTypeIcon(credential.type)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '600', color: '#0f172a' }}>{credential.name}</span>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          backgroundColor: statusInfo.bg,
                          color: statusInfo.text
                        }}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748b' }}>
                        {credential.service} • {credential.type.replace('_', ' ')}
                      </div>
                      {credential.scopes && (
                        <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {credential.scopes.map(scope => (
                            <span key={scope} style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: '#f1f5f9',
                              fontSize: '10px',
                              color: '#64748b'
                            }}>
                              {scope}
                            </span>
                          ))}
                        </div>
                      )}
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>
                        {credential.lastUsed && `Usado: ${new Date(credential.lastUsed).toLocaleDateString('es-ES')}`}
                        {credential.expiresAt && ` • Expira: ${new Date(credential.expiresAt).toLocaleDateString('es-ES')}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {credential.status === 'expired' && (
                      <button style={{
                        padding: '8px 16px',
                        fontSize: '13px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}>
                        Renovar
                      </button>
                    )}
                    <button style={{
                      padding: '8px 16px',
                      fontSize: '13px',
                      backgroundColor: '#f1f5f9',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      color: '#475569'
                    }}>
                      Editar
                    </button>
                    <button style={{
                      padding: '8px 16px',
                      fontSize: '13px',
                      backgroundColor: '#fee2e2',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      color: '#dc2626'
                    }}>
                      Revocar
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
