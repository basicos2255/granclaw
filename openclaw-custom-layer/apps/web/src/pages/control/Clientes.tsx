/**
 * Clientes Page - Políticas de empresa
 * FEATURE 061: UI orientada a caso de uso
 * FEATURE 062: Refinamiento visual empresarial
 */

import { useState, useEffect } from 'react'
import { HubConfigPanel } from '../../components/control'
import { api, type HubConfig } from '../../services/api'

interface TenantConfigItem {
  tenantId: string
  config: HubConfig
}

export function Clientes() {
  const [loading, setLoading] = useState(true)
  const [defaultConfig, setDefaultConfig] = useState<HubConfig | null>(null)
  const [tenantConfigs, setTenantConfigs] = useState<TenantConfigItem[]>([])
  const [newTenantId, setNewTenantId] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    setLoading(true)
    try {
      const response = await api.getHubConfig()
      if (response.success && response.data) {
        setDefaultConfig(response.data.defaultConfig)
        const tenants = Object.entries(response.data.tenants).map(([tenantId, config]) => ({
          tenantId,
          config
        }))
        setTenantConfigs(tenants)
      }
    } catch {
      // Error silencioso
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (tenantId: string, config: Partial<HubConfig>) => {
    setSaving(tenantId)
    try {
      await api.setHubTenantConfig(tenantId, config)
      await loadConfigs()
    } finally {
      setSaving(null)
    }
  }

  const handleAddTenant = async () => {
    if (!newTenantId.trim()) return

    setSaving('new')
    try {
      await api.setHubTenantConfig(newTenantId.trim(), {
        enabled: true,
        mode: 'strict',
        blockedWords: []
      })
      setNewTenantId('')
      await loadConfigs()
    } finally {
      setSaving(null)
    }
  }

  // FEATURE 062: Estilos refinados
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

  const addTenantStyle: React.CSSProperties = {
    display: 'flex',
    gap: '16px',
    marginBottom: '32px',
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e5e7eb'
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '14px 16px',
    fontSize: '15px',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    backgroundColor: '#f9fafb'
  }

  const addButtonStyle: React.CSSProperties = {
    padding: '14px 24px',
    fontSize: '15px',
    fontWeight: '600',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer'
  }

  const loadingStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '60px',
    color: '#6b7280',
    fontSize: '16px'
  }

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={containerStyle}>
          <div style={loadingStyle}>
            Cargando políticas de empresa...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div style={headerStyle}>
          <h1 style={titleStyle}>Políticas de empresa</h1>
          <p style={subtitleStyle}>
            Define qué acciones puede realizar la IA para cada empresa.
          </p>
        </div>

        <div style={addTenantStyle}>
          <input
            type="text"
            value={newTenantId}
            onChange={(e) => setNewTenantId(e.target.value)}
            placeholder="Nombre de la nueva empresa..."
            style={inputStyle}
          />
          <button
            onClick={handleAddTenant}
            disabled={!newTenantId.trim() || saving === 'new'}
            style={addButtonStyle}
          >
            + Añadir empresa
          </button>
        </div>

        {defaultConfig && (
          <HubConfigPanel
            tenantId="default"
            config={defaultConfig}
            onSave={(config) => handleSave('default', config)}
            saving={saving === 'default'}
          />
        )}

        {tenantConfigs.map(({ tenantId, config }) => (
          <HubConfigPanel
            key={tenantId}
            tenantId={tenantId}
            config={config}
            onSave={(cfg) => handleSave(tenantId, cfg)}
            saving={saving === tenantId}
          />
        ))}
      </div>
    </div>
  )
}
