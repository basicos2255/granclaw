/**
 * HubConfigPanel - Panel de políticas por empresa
 * FEATURE 061: UI orientada a caso de uso
 * FEATURE 062: Refinamiento visual empresarial
 */

import { useState } from 'react'
import { ModeSelector } from './ModeSelector'
import type { HubConfig } from '../../services/api'

interface HubConfigPanelProps {
  tenantId: string
  config: HubConfig
  onSave: (config: Partial<HubConfig>) => Promise<void>
  saving: boolean
}

export function HubConfigPanel({ tenantId, config, onSave, saving }: HubConfigPanelProps) {
  const [enabled, setEnabled] = useState(config.enabled)
  const [mode, setMode] = useState<'strict' | 'passthrough'>(config.mode)
  const [blockedWords, setBlockedWords] = useState(config.blockedWords.join(', '))
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    const words = blockedWords
      .split(',')
      .map(w => w.trim())
      .filter(w => w.length > 0)

    await onSave({ enabled, mode, blockedWords: words })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // FEATURE 062: Estilos refinados
  const containerStyle: React.CSSProperties = {
    padding: '24px',
    border: '1px solid #e5e7eb',
    borderRadius: '16px',
    backgroundColor: 'white',
    marginBottom: '20px'
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid #f3f4f6'
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: '600',
    color: '#111827'
  }

  const toggleStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  }

  const checkboxStyle: React.CSSProperties = {
    width: '22px',
    height: '22px',
    cursor: 'pointer',
    accentColor: '#22c55e'
  }

  const fieldStyle: React.CSSProperties = {
    marginBottom: '20px'
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '10px'
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    fontSize: '15px',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    boxSizing: 'border-box',
    backgroundColor: '#f9fafb'
  }

  const buttonStyle: React.CSSProperties = {
    padding: '14px 28px',
    fontSize: '15px',
    fontWeight: '600',
    backgroundColor: saved ? '#22c55e' : (saving ? '#9ca3af' : '#2563eb'),
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: saving ? 'not-allowed' : 'pointer'
  }

  const toggleLabelStyle: React.CSSProperties = {
    fontSize: '14px',
    color: enabled ? '#166534' : '#6b7280',
    fontWeight: '500'
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={titleStyle}>
          {tenantId === 'default' ? 'Política Global' : `Empresa: ${tenantId}`}
        </div>
        <div style={toggleStyle}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            style={checkboxStyle}
            id={`enabled-${tenantId}`}
          />
          <label htmlFor={`enabled-${tenantId}`} style={toggleLabelStyle}>
            {enabled ? '🟢 Seguridad activada' : '⚪ Seguridad desactivada'}
          </label>
        </div>
      </div>

      <div style={fieldStyle}>
        <ModeSelector
          mode={mode}
          onChange={setMode}
          label="Modo"
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Palabras restringidas</label>
        <input
          type="text"
          value={blockedWords}
          onChange={(e) => setBlockedWords(e.target.value)}
          placeholder="borrar, eliminar, destruir (separadas por coma)"
          style={inputStyle}
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={buttonStyle}
      >
        {saved ? '✓ Políticas aplicadas' : (saving ? 'Aplicando...' : 'Aplicar políticas de seguridad')}
      </button>
    </div>
  )
}
