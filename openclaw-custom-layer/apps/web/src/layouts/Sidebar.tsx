/**
 * Sidebar Component
 * P2: Product Experience Layer
 *
 * Main navigation sidebar.
 */

import { useRuntimeWs } from '../hooks/useRuntimeWs'

interface NavItem {
  id: string
  label: string
  icon: string
  path: string
  badge?: number
  advanced?: boolean
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/dashboard' },
  { id: 'tasks', label: 'Tareas', icon: '⚡', path: '/tasks' },
  { id: 'automations', label: 'Automatizaciones', icon: '🔄', path: '/automations' },
  { id: 'channels', label: 'Canales', icon: '🔌', path: '/channels' },
  { id: 'approvals', label: 'Aprobaciones', icon: '✋', path: '/approvals' },
  { id: 'notifications', label: 'Notificaciones', icon: '🔔', path: '/notifications' },
  { id: 'credentials', label: 'Credenciales', icon: '🔐', path: '/credentials' },
  { id: 'runtime', label: 'Runtime', icon: '🖥️', path: '/runtime', advanced: true },
  { id: 'settings', label: 'Configuración', icon: '⚙️', path: '/settings' },
  { id: 'control', label: 'Control avanzado', icon: '🛠️', path: '/control', advanced: true }
]

interface SidebarProps {
  currentPath: string
  onNavigate: (path: string) => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export function Sidebar({ currentPath, onNavigate, collapsed, onToggleCollapse }: SidebarProps) {
  const { isConnected } = useRuntimeWs()

  const sidebarStyle: React.CSSProperties = {
    position: 'fixed',
    left: 0,
    top: 0,
    bottom: 0,
    width: collapsed ? '72px' : '260px',
    backgroundColor: '#0f172a',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.2s ease',
    zIndex: 100,
    overflow: 'hidden'
  }

  const logoStyle: React.CSSProperties = {
    padding: collapsed ? '20px 16px' : '20px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  }

  const logoIconStyle: React.CSSProperties = {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    backgroundColor: '#3b82f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: '700',
    flexShrink: 0
  }

  const navStyle: React.CSSProperties = {
    flex: 1,
    padding: '16px 12px',
    overflowY: 'auto'
  }

  const navItemStyle = (isActive: boolean, isAdvanced: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: collapsed ? '12px 16px' : '12px 16px',
    marginBottom: '4px',
    borderRadius: '10px',
    cursor: 'pointer',
    backgroundColor: isActive ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
    color: isActive ? '#60a5fa' : (isAdvanced ? '#94a3b8' : '#e2e8f0'),
    fontSize: '14px',
    fontWeight: isActive ? '600' : '400',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap'
  })

  const iconStyle: React.CSSProperties = {
    fontSize: '18px',
    width: '24px',
    textAlign: 'center',
    flexShrink: 0
  }

  const footerStyle: React.CSSProperties = {
    padding: '16px',
    borderTop: '1px solid rgba(255,255,255,0.1)'
  }

  const statusStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: isConnected ? '#4ade80' : '#94a3b8'
  }

  const collapseButtonStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px',
    marginTop: '8px',
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: 'none',
    borderRadius: '8px',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '12px'
  }

  return (
    <aside style={sidebarStyle}>
      {/* Logo */}
      <div style={logoStyle}>
        <div style={logoIconStyle}>G</div>
        {!collapsed && (
          <div>
            <div style={{ fontSize: '18px', fontWeight: '700' }}>GranClaw</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Task OS</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav style={navStyle}>
        {navItems.map(item => {
          const isActive = currentPath === item.path || currentPath.startsWith(item.path + '/')
          return (
            <div
              key={item.id}
              style={navItemStyle(isActive, item.advanced || false)}
              onClick={() => onNavigate(item.path)}
              title={collapsed ? item.label : undefined}
            >
              <span style={iconStyle}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
              {!collapsed && item.badge !== undefined && item.badge > 0 && (
                <span style={{
                  marginLeft: 'auto',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  backgroundColor: '#ef4444',
                  fontSize: '11px',
                  fontWeight: '600'
                }}>
                  {item.badge}
                </span>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={footerStyle}>
        <div style={statusStyle}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isConnected ? '#4ade80' : '#94a3b8'
          }} />
          {!collapsed && (isConnected ? 'Conectado' : 'Desconectado')}
        </div>
        <button style={collapseButtonStyle} onClick={onToggleCollapse}>
          {collapsed ? '→' : '← Colapsar'}
        </button>
      </div>
    </aside>
  )
}
