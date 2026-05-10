/**
 * App.tsx - GranClaw Shell
 * FEATURE 065: Product shell clean - modo producto vs dev
 * FEATURE 071: Auth state + user visible
 * P2: Product Experience Layer integration
 */

import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { DashboardPage } from './pages/dashboard'
import { AgentsPage } from './pages/agents'
import { SessionsPage } from './pages/sessions'
import { TasksPage as DevTasksPage } from './pages/tasks'
import { PresetsPage } from './pages/presets'
import { ConfigPage } from './pages/config'
import { ChatPage } from './pages/chat'
import { LoginPage } from './pages/login'
import { RegisterPage } from './pages/register'
import { DebugPage } from './pages/debug'
import { Execute, Clientes, Dashboard as ControlDashboard, Historial, Tools, Settings, Setup } from './pages/control'
import { AppShell } from './layouts'
import {
  ProductDashboard,
  TasksPage,
  ConversationalTaskDetail,
  AutomationsPage,
  ChannelsPage,
  CredentialsPage,
  ApprovalsPage,
  NotificationsPage,
  RuntimePage,
  SettingsPage,
  WhatsAppPage,
  EmailPage
} from './pages/product'

type Route = string

// Rutas dev (accesibles manualmente)
const devRoutes = [
  { path: '/dev/dashboard', label: 'Dashboard' },
  { path: '/dev/chat', label: 'Chat' },
  { path: '/dev/agents', label: 'Agents' },
  { path: '/dev/sessions', label: 'Sessions' },
  { path: '/dev/tasks', label: 'Tasks' },
  { path: '/dev/presets', label: 'Presets' },
  { path: '/dev/config', label: 'Config' },
  { path: '/dev/debug', label: 'Debug' },
  { path: '/login', label: 'Login' },
  { path: '/register', label: 'Register' }
]

// Product routes (new P2 experience)
const productRoutes = [
  '/dashboard', '/tasks', '/automations', '/channels',
  '/credentials', '/approvals', '/notifications', '/runtime', '/settings'
]

function isProductRoute(path: string): boolean {
  return path.startsWith('/control') || productRoutes.some(r => path === r || path.startsWith(r + '/'))
}

function isAppShellRoute(path: string): boolean {
  // P2.1: / ahora es producto con AppShell (redirige a /dashboard)
  return path === '/' || productRoutes.some(r => path === r || path.startsWith(r + '/'))
}

function Router({ path }: { path: Route }) {
  // P2/P3 Product Experience routes
  if (path === '/dashboard') return <ProductDashboard />
  if (path === '/tasks') return <TasksPage />

  // P6.6: Conversational task detail route (uses ConversationalTaskDetail instead of TaskDetailPage)
  const taskMatch = path.match(/^\/tasks\/([^/]+)$/)
  if (taskMatch) return <ConversationalTaskDetail taskId={taskMatch[1]} />

  if (path === '/automations') return <AutomationsPage />
  if (path === '/channels') return <ChannelsPage />
  if (path === '/channels/whatsapp') return <WhatsAppPage />
  if (path === '/channels/email') return <EmailPage />
  if (path === '/credentials') return <CredentialsPage />
  if (path === '/approvals') return <ApprovalsPage />
  if (path === '/notifications') return <NotificationsPage />
  if (path === '/runtime') return <RuntimePage />
  if (path === '/settings') return <SettingsPage />

  // P2.1: / redirige a dashboard (producto)
  if (path === '/') return <ProductDashboard />

  // Control panel routes (technical/advanced)
  if (path === '/control') return <Execute />
  if (path === '/control/clientes') return <Clientes />
  if (path === '/control/dashboard') return <ControlDashboard />
  if (path === '/control/historial') return <Historial />
  if (path === '/control/tools') return <Tools />
  if (path === '/control/settings') return <Settings />
  if (path === '/control/setup') return <Setup />

  // Rutas dev
  if (path === '/dev/dashboard') return <DashboardPage />
  if (path === '/dev/chat') return <ChatPage />
  if (path === '/dev/agents') return <AgentsPage />
  if (path === '/dev/sessions') return <SessionsPage />
  if (path === '/dev/tasks') return <DevTasksPage />
  if (path === '/dev/presets') return <PresetsPage />
  if (path === '/dev/config') return <ConfigPage />
  if (path === '/dev/debug') return <DebugPage />
  if (path === '/login') return <LoginPage />
  if (path === '/register') return <RegisterPage />

  // Fallback a producto
  return <Execute />
}

// Header producto con usuario y logout
interface ProductHeaderProps {
  currentPath: string
  navigate: (path: string) => void
  userEmail: string | null
  onLogout: () => void
}

function ProductHeader({ currentPath, navigate, userEmail, onLogout }: ProductHeaderProps) {
  const navRoutes = [
    { path: '/control', label: 'Control' },
    { path: '/control/clientes', label: 'Politicas' },
    { path: '/control/historial', label: 'Historial' },
    { path: '/control/tools', label: 'Tools' },
    { path: '/control/settings', label: 'Config' }
  ]

  const isActive = (path: string) => {
    if (path === '/control') return currentPath === '/' || currentPath === '/control'
    return currentPath === path
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 40px',
    backgroundColor: 'white',
    borderBottom: '1px solid #e2e8f0'
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '500',
    backgroundColor: active ? '#2563eb' : 'transparent',
    color: active ? 'white' : '#64748b',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  })

  const userStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '14px',
    color: '#64748b'
  }

  return (
    <header style={headerStyle}>
      <nav style={{ display: 'flex', gap: '8px' }}>
        {navRoutes.map((route) => (
          <button
            key={route.path}
            onClick={() => navigate(route.path)}
            style={tabStyle(isActive(route.path))}
          >
            {route.label}
          </button>
        ))}
      </nav>
      <div style={userStyle}>
        {userEmail ? (
          <>
            <span>{userEmail}</span>
            <button
              onClick={onLogout}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Salir
            </button>
          </>
        ) : (
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Iniciar sesion
          </button>
        )}
      </div>
    </header>
  )
}

// Header dev (solo para rutas /dev/*)
function DevHeader({ currentPath, navigate }: { currentPath: string; navigate: (path: string) => void }) {
  return (
    <header style={{ borderBottom: '1px solid #ccc', padding: '10px', marginBottom: '20px', backgroundColor: '#1e293b' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: '1.2rem', color: '#94a3b8' }}>GranClaw Dev</h1>
        <button
          onClick={() => navigate('/control')}
          style={{
            padding: '6px 12px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          ← Volver a Producto
        </button>
      </div>
      <nav style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {devRoutes.map((route) => (
          <button
            key={route.path}
            onClick={() => navigate(route.path)}
            style={{
              padding: '5px 10px',
              background: currentPath === route.path ? '#3b82f6' : '#334155',
              color: currentPath === route.path ? '#fff' : '#94a3b8',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            {route.label}
          </button>
        ))}
      </nav>
    </header>
  )
}

export function App() {
  const [currentPath, setCurrentPath] = useState<Route>(
    window.location.pathname || '/'
  )
  const { user, logout, loading } = useAuth()

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/')
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // P6.2: Global session-expired handler - redirect to login on 401
  useEffect(() => {
    const handleSessionExpired = () => {
      setCurrentPath('/login')
      window.history.pushState({}, '', '/login')
    }
    window.addEventListener('session-expired', handleSessionExpired)
    return () => window.removeEventListener('session-expired', handleSessionExpired)
  }, [])

  const navigate = (path: string) => {
    window.history.pushState({}, '', path)
    setCurrentPath(path)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isProduct = isProductRoute(currentPath)

  // Loading state
  if (loading && isProduct) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Cargando...</p>
      </div>
    )
  }

  // P2 Product Experience with AppShell
  if (isAppShellRoute(currentPath)) {
    return (
      <AppShell currentPath={currentPath} onNavigate={navigate}>
        <Router path={currentPath} />
      </AppShell>
    )
  }

  // Modo producto (control panel): shell limpio con auth
  if (isProduct) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
        <ProductHeader
          currentPath={currentPath}
          navigate={navigate}
          userEmail={user?.email || null}
          onLogout={handleLogout}
        />
        <Router path={currentPath} />
      </div>
    )
  }

  // Modo dev: header técnico
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a' }}>
      <DevHeader currentPath={currentPath} navigate={navigate} />
      <main style={{ padding: '0 20px' }}>
        <Router path={currentPath} />
      </main>
    </div>
  )
}
