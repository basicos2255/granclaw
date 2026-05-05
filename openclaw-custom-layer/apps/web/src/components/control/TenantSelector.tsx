/**
 * TenantSelector - Selector de cliente/tenant
 * FEATURE 061: UI orientada a caso de uso
 */

interface TenantSelectorProps {
  tenants: string[]
  selected: string
  onChange: (tenantId: string) => void
  label?: string
}

export function TenantSelector({ tenants, selected, onChange, label }: TenantSelectorProps) {
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

  const selectStyle: React.CSSProperties = {
    padding: '12px',
    fontSize: '16px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    backgroundColor: 'white',
    cursor: 'pointer'
  }

  return (
    <div style={containerStyle}>
      {label && <label style={labelStyle}>{label}</label>}
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        style={selectStyle}
      >
        {tenants.map((tenant) => (
          <option key={tenant} value={tenant}>
            {tenant === 'default' ? 'Cliente por defecto' : tenant}
          </option>
        ))}
      </select>
    </div>
  )
}
