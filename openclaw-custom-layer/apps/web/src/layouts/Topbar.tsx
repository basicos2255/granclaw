/**
 * Topbar Component
 * P2: Product Experience Layer
 *
 * Top navigation bar with notifications, user menu, tenant switcher.
 */

import { useState } from 'react'
import { NotificationBell, NotificationPanel, useNotificationPanel } from '../components/control/NotificationPanel'
import { useAuth } from '../hooks/useAuth'

interface TopbarProps {
  isConnected: boolean
  onNavigate: (path: string) => void
}

export function Topbar({ isConnected, onNavigate }: TopbarProps) {
  const { user, isAuthenticated, logout } = useAuth()
  const { isOpen, toggle, unreadCount, close } = useNotificationPanel()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const topbarStyle: React.CSSProperties = {
    height: '64px',
    backgroundColor: 'white',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 32px',
    position: 'sticky',
    top: 0,
    zIndex: 50
  }

  const leftStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  }

  const rightStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  }

  const runtimeIndicatorStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '500',
    backgroundColor: isConnected ? '#dcfce7' : '#f3f4f6',
    color: isConnected ? '#16a34a' : '#6b7280'
  }

  const userButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    backgroundColor: 'white',
    cursor: 'pointer',
    fontSize: '14px'
  }

  const avatarStyle: React.CSSProperties = {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '600'
  }

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '8px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
    border: '1px solid #e2e8f0',
    minWidth: '200px',
    overflow: 'hidden',
    zIndex: 100
  }

  const dropdownItemStyle: React.CSSProperties = {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#374151',
    cursor: 'pointer',
    borderBottom: '1px solid #f3f4f6'
  }

  return (
    <header style={topbarStyle}>
      <div style={leftStyle}>
        {/* Runtime Indicator */}
        <div style={runtimeIndicatorStyle}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: isConnected ? '#16a34a' : '#9ca3af'
          }} />
          {isConnected ? 'Live' : 'Offline'}
        </div>
      </div>

      <div style={rightStyle}>
        {/* Quick Action - P6.4: Use query param instead of non-existent route */}
        <button
          onClick={() => onNavigate('/tasks?create=true')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span>+</span>
          Nueva Tarea
        </button>

        {/* Notifications */}
        <NotificationBell onClick={toggle} unreadCount={unreadCount} />

        {/* User Menu or Login Button */}
        {isAuthenticated ? (
          <div style={{ position: 'relative' }}>
            <button
              style={userButtonStyle}
              onClick={() => setUserMenuOpen(!userMenuOpen)}
            >
              <div style={avatarStyle}>
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span style={{ color: '#374151' }}>
                {user?.email?.split('@')[0] || 'Usuario'}
              </span>
              <span style={{ color: '#9ca3af', fontSize: '10px' }}>▼</span>
            </button>

            {userMenuOpen && (
              <>
                <div
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
                  onClick={() => setUserMenuOpen(false)}
                />
                <div style={dropdownStyle}>
                  <div style={{ ...dropdownItemStyle, backgroundColor: '#f9fafb' }}>
                    <div style={{ fontWeight: '500', color: '#111827' }}>{user?.email}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                      {user?.role || 'Usuario'}
                    </div>
                  </div>
                  <div
                    style={dropdownItemStyle}
                    onClick={() => { setUserMenuOpen(false); onNavigate('/settings') }}
                  >
                    Configuracion
                  </div>
                  <div
                    style={{ ...dropdownItemStyle, color: '#dc2626', borderBottom: 'none' }}
                    onClick={async () => {
                      setUserMenuOpen(false)
                      await logout()
                      onNavigate('/login')
                    }}
                  >
                    Cerrar sesion
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => onNavigate('/login')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0f172a',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Iniciar Sesion
          </button>
        )}
      </div>

      {/* Notification Panel */}
      <NotificationPanel isOpen={isOpen} onClose={close} />
    </header>
  )
}
