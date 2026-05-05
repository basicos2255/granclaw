/**
 * ModeSelector - Selector de modo (Seguro/Libre)
 * FEATURE 061: UI orientada a caso de uso
 */

interface ModeSelectorProps {
  mode: 'strict' | 'passthrough'
  onChange: (mode: 'strict' | 'passthrough') => void
  label?: string
}

export function ModeSelector({ mode, onChange, label }: ModeSelectorProps) {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: '500',
    color: '#424242'
  }

  const optionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px'
  }

  const getButtonStyle = (isActive: boolean, isStrict: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '12px 16px',
    fontSize: '14px',
    fontWeight: '500',
    border: '2px solid',
    borderColor: isActive
      ? (isStrict ? '#4caf50' : '#ff9800')
      : '#e0e0e0',
    borderRadius: '8px',
    backgroundColor: isActive
      ? (isStrict ? '#e8f5e9' : '#fff3e0')
      : 'white',
    color: isActive
      ? (isStrict ? '#2e7d32' : '#e65100')
      : '#757575',
    cursor: 'pointer',
    transition: 'all 0.2s'
  })

  return (
    <div style={containerStyle}>
      {label && <label style={labelStyle}>{label}</label>}
      <div style={optionsStyle}>
        <button
          type="button"
          style={getButtonStyle(mode === 'strict', true)}
          onClick={() => onChange('strict')}
        >
          🛡️ Seguro
        </button>
        <button
          type="button"
          style={getButtonStyle(mode === 'passthrough', false)}
          onClick={() => onChange('passthrough')}
        >
          🔓 Libre
        </button>
      </div>
    </div>
  )
}
