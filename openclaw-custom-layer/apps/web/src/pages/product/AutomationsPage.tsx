/**
 * Automations Page
 * P2: Product Experience Layer
 *
 * Manage recurring and event-driven automations.
 */

import { useState, useEffect } from 'react'

interface Automation {
  id: string
  name: string
  description: string
  trigger: {
    type: 'periodic' | 'event' | 'conditional'
    schedule?: string // cron
    event?: string
    condition?: string
  }
  enabled: boolean
  lastRunAt?: string
  nextRunAt?: string
  stats: {
    totalRuns: number
    successCount: number
    failureCount: number
  }
}

// Mock data for now
const mockAutomations: Automation[] = [
  {
    id: 'auto-1',
    name: 'Revisar emails',
    description: 'Revisa bandeja de entrada cada mañana',
    trigger: { type: 'periodic', schedule: '0 9 * * *' },
    enabled: true,
    lastRunAt: new Date(Date.now() - 86400000).toISOString(),
    nextRunAt: new Date(Date.now() + 43200000).toISOString(),
    stats: { totalRuns: 15, successCount: 14, failureCount: 1 }
  },
  {
    id: 'auto-2',
    name: 'Verificar servidor',
    description: 'Health check del servidor cada hora',
    trigger: { type: 'periodic', schedule: '0 * * * *' },
    enabled: true,
    lastRunAt: new Date(Date.now() - 3600000).toISOString(),
    nextRunAt: new Date(Date.now() + 1800000).toISOString(),
    stats: { totalRuns: 168, successCount: 168, failureCount: 0 }
  },
  {
    id: 'auto-3',
    name: 'Reporte semanal',
    description: 'Genera reporte de actividad cada viernes',
    trigger: { type: 'periodic', schedule: '0 17 * * 5' },
    enabled: false,
    lastRunAt: new Date(Date.now() - 604800000).toISOString(),
    stats: { totalRuns: 4, successCount: 4, failureCount: 0 }
  }
]

export function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: Load from API
    setTimeout(() => {
      setAutomations(mockAutomations)
      setLoading(false)
    }, 500)
  }, [])

  const toggleAutomation = (id: string) => {
    setAutomations(prev =>
      prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a)
    )
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '20px',
    marginBottom: '12px'
  }

  const headerStyle: React.CSSProperties = {
    marginBottom: '24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '8px'
  }

  const formatNextRun = (dateStr?: string): string => {
    if (!dateStr) return 'No programada'
    const date = new Date(dateStr)
    const now = new Date()
    const diff = date.getTime() - now.getTime()

    if (diff < 0) return 'Pendiente'
    if (diff < 3600000) return `En ${Math.round(diff / 60000)} minutos`
    if (diff < 86400000) return `En ${Math.round(diff / 3600000)} horas`
    return date.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })
  }

  const getTriggerIcon = (type: string): string => {
    switch (type) {
      case 'periodic': return '⏰'
      case 'event': return '⚡'
      case 'conditional': return '🔀'
      default: return '📋'
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Automatizaciones</h1>
          <p style={{ color: '#64748b' }}>Tareas recurrentes y basadas en eventos</p>
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
          + Nueva Automatización
        </button>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={cardStyle}>
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>Activas</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#16a34a' }}>
            {automations.filter(a => a.enabled).length}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>Próxima ejecución</div>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#0f172a' }}>
            {formatNextRun(automations.find(a => a.enabled && a.nextRunAt)?.nextRunAt)}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>Ejecuciones hoy</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#3b82f6' }}>
            {automations.reduce((sum, a) => sum + a.stats.totalRuns, 0)}
          </div>
        </div>
      </div>

      {/* Automations List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
          Cargando automatizaciones...
        </div>
      ) : automations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔄</div>
          <div>No hay automatizaciones configuradas</div>
        </div>
      ) : (
        <div>
          {automations.map(automation => (
            <div key={automation.id} style={{
              ...cardStyle,
              opacity: automation.enabled ? 1 : 0.6
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '20px' }}>{getTriggerIcon(automation.trigger.type)}</span>
                    <span style={{ fontSize: '16px', fontWeight: '600', color: '#0f172a' }}>
                      {automation.name}
                    </span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      backgroundColor: automation.enabled ? '#dcfce7' : '#f3f4f6',
                      color: automation.enabled ? '#16a34a' : '#6b7280'
                    }}>
                      {automation.enabled ? 'Activa' : 'Pausada'}
                    </span>
                  </div>
                  <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '12px' }}>
                    {automation.description}
                  </div>
                  <div style={{ display: 'flex', gap: '24px', fontSize: '12px', color: '#94a3b8' }}>
                    <span>Próxima: {formatNextRun(automation.nextRunAt)}</span>
                    <span>Éxitos: {automation.stats.successCount}</span>
                    <span>Fallos: {automation.stats.failureCount}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => toggleAutomation(automation.id)}
                    style={{
                      padding: '8px 16px',
                      fontSize: '13px',
                      backgroundColor: automation.enabled ? '#fef3c7' : '#dcfce7',
                      color: automation.enabled ? '#d97706' : '#16a34a',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    {automation.enabled ? 'Pausar' : 'Activar'}
                  </button>
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
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
