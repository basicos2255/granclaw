/**
 * AppShell Layout
 * P2: Product Experience Layer & Task Operating System
 *
 * Main application shell with sidebar navigation.
 */

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useRuntimeWs } from '../hooks/useRuntimeWs'

interface AppShellProps {
  children: React.ReactNode
  currentPath: string
  onNavigate: (path: string) => void
}

export function AppShell({ children, currentPath, onNavigate }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { isConnected } = useRuntimeWs()

  const shellStyle: React.CSSProperties = {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#f8fafc'
  }

  const mainStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    marginLeft: sidebarCollapsed ? '72px' : '260px',
    transition: 'margin-left 0.2s ease'
  }

  const contentStyle: React.CSSProperties = {
    flex: 1,
    padding: '24px 32px',
    overflowY: 'auto'
  }

  return (
    <div style={shellStyle}>
      <Sidebar
        currentPath={currentPath}
        onNavigate={onNavigate}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div style={mainStyle}>
        <Topbar
          isConnected={isConnected}
          onNavigate={onNavigate}
        />
        <main style={contentStyle}>
          {children}
        </main>
      </div>
    </div>
  )
}
