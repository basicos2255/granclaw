/**
 * GlobalHeader - Cabecera global de GranClaw Control
 * FEATURE 062: Refinamiento UI empresarial
 * FEATURE 063: UI v3 - badge de modo visible
 * FEATURE 064: UI SaaS moderna
 * P1.2: Live notifications integration
 */

import { TenantSelector } from './TenantSelector'
import { ModeSelector } from './ModeSelector'
import { NotificationBell, NotificationPanel, useNotificationPanel } from './NotificationPanel'

interface GlobalHeaderProps {
  tenants: string[]
  selectedTenant: string
  onTenantChange: (tenantId: string) => void
  mode: 'strict' | 'passthrough'
  onModeChange: (mode: 'strict' | 'passthrough') => void
}

export function GlobalHeader({
  tenants,
  selectedTenant,
  onTenantChange,
  mode,
  onModeChange
}: GlobalHeaderProps) {
  // P1.2: Notification panel state
  const { isOpen, toggle, unreadCount, close } = useNotificationPanel()

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 40px',
    backgroundColor: 'white',
    borderBottom: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
  }

  const brandStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  }

  const logoStyle: React.CSSProperties = {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    backgroundColor: '#2563eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '18px',
    fontWeight: '700'
  }

  const brandTextStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: '700',
    color: '#0f172a',
    margin: 0,
    letterSpacing: '-0.3px'
  }

  const subtitleStyle: React.CSSProperties = {
    fontSize: '13px',
    color: '#64748b',
    margin: 0
  }

  const controlsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  }

  const selectorWrapperStyle: React.CSSProperties = {
    minWidth: '160px'
  }

  const modeBadgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    backgroundColor: mode === 'strict' ? '#ecfdf5' : '#fffbeb',
    color: mode === 'strict' ? '#059669' : '#d97706',
    border: `1px solid ${mode === 'strict' ? '#a7f3d0' : '#fde68a'}`
  }

  return (
    <header style={headerStyle}>
      <div style={brandStyle}>
        <div style={logoStyle}>G</div>
        <div style={brandTextStyle}>
          <h1 style={titleStyle}>GranClaw</h1>
          <p style={subtitleStyle}>Control de IA empresarial</p>
        </div>
      </div>

      <div style={controlsStyle}>
        <div style={modeBadgeStyle}>
          {mode === 'strict' ? '🛡️ Modo Seguro' : '⚡ Modo Libre'}
        </div>
        <div style={selectorWrapperStyle}>
          <TenantSelector
            tenants={tenants}
            selected={selectedTenant}
            onChange={onTenantChange}
            label="Empresa"
          />
        </div>
        <div style={selectorWrapperStyle}>
          <ModeSelector
            mode={mode}
            onChange={onModeChange}
            label="Modo"
          />
        </div>

        {/* P1.2: Notification bell */}
        <NotificationBell onClick={toggle} unreadCount={unreadCount} />
      </div>

      {/* P1.2: Notification panel */}
      <NotificationPanel isOpen={isOpen} onClose={close} />
    </header>
  )
}
