/**
 * Queue Dashboard Component
 * PHASE H1: Runtime Hardening & Platform Stabilization
 *
 * Dashboard for monitoring runtime queue, jobs, and dead letter queue.
 */

import { useState } from 'react'

/**
 * Job status types
 */
type JobStatus =
  | 'pending'
  | 'scheduled'
  | 'running'
  | 'completed'
  | 'failed'
  | 'retrying'
  | 'cancelled'
  | 'dead'

/**
 * Job priority types
 */
type JobPriority = 'critical' | 'high' | 'normal' | 'low' | 'background'

/**
 * Queue job data
 */
interface QueueJob {
  id: string
  type: string
  status: JobStatus
  priority: JobPriority
  retryCount: number
  progress?: number
  progressMessage?: string
  createdAt: string
  startedAt?: string
  completedAt?: string
  lastError?: {
    message: string
    category: string
  }
}

/**
 * Queue statistics
 */
interface QueueStats {
  byStatus: Record<JobStatus, number>
  byPriority: Record<JobPriority, number>
  avgWaitTimeMs: number
  avgExecutionTimeMs: number
  successRate: number
  lastHourProcessed: number
  lastHourFailed: number
  throughputPerMin: number
  deadLetterSize: number
}

/**
 * Scheduler state
 */
interface SchedulerState {
  running: boolean
  paused: boolean
  activeJobs: number
  processedCount: number
  failedCount: number
}

/**
 * Health status
 */
interface HealthStatus {
  healthy: boolean
  totalJobs: number
  pendingJobs: number
  runningJobs: number
  failedJobs: number
  issues: string[]
  recommendations: string[]
}

interface QueueDashboardProps {
  stats?: QueueStats
  scheduler?: SchedulerState
  health?: HealthStatus
  jobs?: QueueJob[]
  deadLetterCount?: number
  onPause?: () => void
  onResume?: () => void
  onRefresh?: () => void
  onViewJob?: (jobId: string) => void
  onCancelJob?: (jobId: string) => void
  onViewDeadLetter?: () => void
}

/**
 * Status color mapping
 */
function getStatusColor(status: JobStatus): string {
  switch (status) {
    case 'completed':
      return '#16a34a'
    case 'running':
      return '#2563eb'
    case 'scheduled':
    case 'pending':
      return '#9ca3af'
    case 'retrying':
      return '#f59e0b'
    case 'failed':
    case 'dead':
      return '#dc2626'
    case 'cancelled':
      return '#6b7280'
    default:
      return '#9ca3af'
  }
}

/**
 * Priority color mapping
 */
function getPriorityColor(priority: JobPriority): string {
  switch (priority) {
    case 'critical':
      return '#dc2626'
    case 'high':
      return '#f59e0b'
    case 'normal':
      return '#2563eb'
    case 'low':
      return '#6b7280'
    case 'background':
      return '#9ca3af'
    default:
      return '#9ca3af'
  }
}

/**
 * Status icon mapping
 */
function getStatusIcon(status: JobStatus): string {
  switch (status) {
    case 'completed':
      return '✓'
    case 'running':
      return '⏳'
    case 'scheduled':
      return '⏸'
    case 'pending':
      return '○'
    case 'retrying':
      return '↻'
    case 'failed':
      return '✗'
    case 'dead':
      return '💀'
    case 'cancelled':
      return '⊘'
    default:
      return '?'
  }
}

/**
 * Format duration
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

/**
 * Stat card component
 */
function StatCard({
  label,
  value,
  color,
  subtext
}: {
  label: string
  value: string | number
  color?: string
  subtext?: string
}) {
  return (
    <div style={{
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '16px',
      textAlign: 'center'
    }}>
      <div style={{
        fontSize: '28px',
        fontWeight: '700',
        color: color || '#1e293b'
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '12px',
        color: '#64748b',
        marginTop: '4px'
      }}>
        {label}
      </div>
      {subtext && (
        <div style={{
          fontSize: '11px',
          color: '#9ca3af',
          marginTop: '2px'
        }}>
          {subtext}
        </div>
      )}
    </div>
  )
}

/**
 * Job row component
 */
function JobRow({
  job,
  onView,
  onCancel
}: {
  job: QueueJob
  onView?: () => void
  onCancel?: () => void
}) {
  const statusColor = getStatusColor(job.status)
  const priorityColor = getPriorityColor(job.priority)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 16px',
      backgroundColor: 'white',
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
      marginBottom: '8px'
    }}>
      {/* Status */}
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        backgroundColor: `${statusColor}15`,
        color: statusColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        fontWeight: '600'
      }}>
        {getStatusIcon(job.status)}
      </div>

      {/* Info */}
      <div style={{ flex: 1 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{
            fontWeight: '600',
            fontSize: '14px',
            color: '#1e293b'
          }}>
            {job.type}
          </span>
          <span style={{
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: '500',
            backgroundColor: `${priorityColor}15`,
            color: priorityColor,
            textTransform: 'uppercase'
          }}>
            {job.priority}
          </span>
          {job.retryCount > 0 && (
            <span style={{
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              backgroundColor: '#fef3c7',
              color: '#d97706'
            }}>
              Retry {job.retryCount}
            </span>
          )}
        </div>
        <div style={{
          fontSize: '12px',
          color: '#64748b',
          marginTop: '2px'
        }}>
          {job.id.substring(0, 8)}... •{' '}
          {new Date(job.createdAt).toLocaleTimeString()}
          {job.progressMessage && ` • ${job.progressMessage}`}
        </div>
        {job.lastError && (
          <div style={{
            fontSize: '11px',
            color: '#dc2626',
            marginTop: '4px'
          }}>
            Error: {job.lastError.message}
          </div>
        )}
      </div>

      {/* Progress */}
      {job.progress !== undefined && job.status === 'running' && (
        <div style={{ width: '80px' }}>
          <div style={{
            height: '6px',
            backgroundColor: '#e5e7eb',
            borderRadius: '3px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${job.progress}%`,
              backgroundColor: '#2563eb',
              transition: 'width 0.3s'
            }} />
          </div>
          <div style={{
            fontSize: '10px',
            color: '#64748b',
            textAlign: 'center',
            marginTop: '2px'
          }}>
            {job.progress}%
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {onView && (
          <button
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              backgroundColor: '#f1f5f9',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
            onClick={onView}
          >
            Ver
          </button>
        )}
        {onCancel && (job.status === 'pending' || job.status === 'running') && (
          <button
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
            onClick={onCancel}
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Main Queue Dashboard component
 */
export function QueueDashboard({
  stats,
  scheduler,
  health,
  jobs = [],
  deadLetterCount = 0,
  onPause,
  onResume,
  onRefresh,
  onViewJob,
  onCancelJob,
  onViewDeadLetter
}: QueueDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'health'>('overview')

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
    marginTop: '24px'
  }

  const headerStyle: React.CSSProperties = {
    padding: '20px 24px',
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: active ? '600' : '400',
    backgroundColor: active ? 'white' : 'transparent',
    border: active ? '1px solid #e5e7eb' : 'none',
    borderBottom: active ? 'none' : undefined,
    borderRadius: active ? '8px 8px 0 0' : '8px',
    cursor: 'pointer',
    color: active ? '#1e293b' : '#64748b'
  })

  const buttonStyle: React.CSSProperties = {
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: '500',
    backgroundColor: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer'
  }

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>📊</span>
          <span style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>
            Runtime Queue
          </span>
          {scheduler && (
            <span style={{
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '500',
              backgroundColor: scheduler.paused ? '#fef3c7' : scheduler.running ? '#dcfce7' : '#fee2e2',
              color: scheduler.paused ? '#d97706' : scheduler.running ? '#16a34a' : '#dc2626'
            }}>
              {scheduler.paused ? 'Pausado' : scheduler.running ? 'Activo' : 'Detenido'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {onRefresh && (
            <button style={buttonStyle} onClick={onRefresh}>
              ↻ Actualizar
            </button>
          )}
          {scheduler?.paused && onResume && (
            <button style={{ ...buttonStyle, backgroundColor: '#dcfce7', borderColor: '#16a34a', color: '#16a34a' }} onClick={onResume}>
              ▶ Reanudar
            </button>
          )}
          {scheduler?.running && !scheduler?.paused && onPause && (
            <button style={{ ...buttonStyle, backgroundColor: '#fef3c7', borderColor: '#d97706', color: '#d97706' }} onClick={onPause}>
              ⏸ Pausar
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '12px 24px',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <button style={tabStyle(activeTab === 'overview')} onClick={() => setActiveTab('overview')}>
          Resumen
        </button>
        <button style={tabStyle(activeTab === 'jobs')} onClick={() => setActiveTab('jobs')}>
          Trabajos ({jobs.length})
        </button>
        <button style={tabStyle(activeTab === 'health')} onClick={() => setActiveTab('health')}>
          Salud
        </button>
      </div>

      <div style={{ padding: '24px' }}>
        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '16px',
              marginBottom: '24px'
            }}>
              <StatCard
                label="Pendientes"
                value={stats.byStatus.pending || 0}
                color="#6b7280"
              />
              <StatCard
                label="En ejecución"
                value={stats.byStatus.running || 0}
                color="#2563eb"
              />
              <StatCard
                label="Completados/h"
                value={stats.lastHourProcessed}
                color="#16a34a"
              />
              <StatCard
                label="Fallidos/h"
                value={stats.lastHourFailed}
                color={stats.lastHourFailed > 0 ? '#dc2626' : '#16a34a'}
              />
              <StatCard
                label="Tasa éxito"
                value={`${Math.round(stats.successRate * 100)}%`}
                color={stats.successRate > 0.9 ? '#16a34a' : '#f59e0b'}
              />
              <StatCard
                label="Dead Letter"
                value={stats.deadLetterSize}
                color={stats.deadLetterSize > 10 ? '#dc2626' : '#6b7280'}
              />
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px'
            }}>
              <div style={{
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                padding: '16px'
              }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '8px' }}>
                  Tiempo promedio
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Espera: {formatDuration(stats.avgWaitTimeMs)}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Ejecución: {formatDuration(stats.avgExecutionTimeMs)}
                </div>
              </div>

              <div style={{
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                padding: '16px'
              }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '8px' }}>
                  Rendimiento
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  {stats.throughputPerMin.toFixed(1)} trabajos/min
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  {scheduler?.processedCount || 0} procesados total
                </div>
              </div>
            </div>

            {deadLetterCount > 0 && onViewDeadLetter && (
              <div style={{
                marginTop: '24px',
                padding: '16px',
                backgroundColor: '#fef2f2',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <span style={{ color: '#dc2626', fontWeight: '600' }}>
                    {deadLetterCount} trabajos en Dead Letter
                  </span>
                  <span style={{ color: '#991b1b', fontSize: '12px', marginLeft: '8px' }}>
                    Requieren atención
                  </span>
                </div>
                <button
                  style={{ ...buttonStyle, backgroundColor: 'white', color: '#dc2626', borderColor: '#dc2626' }}
                  onClick={onViewDeadLetter}
                >
                  Ver Dead Letter
                </button>
              </div>
            )}
          </>
        )}

        {/* Jobs Tab */}
        {activeTab === 'jobs' && (
          <div>
            {jobs.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '48px',
                color: '#64748b'
              }}>
                No hay trabajos en la cola
              </div>
            ) : (
              jobs.map(job => (
                <JobRow
                  key={job.id}
                  job={job}
                  onView={onViewJob ? () => onViewJob(job.id) : undefined}
                  onCancel={onCancelJob ? () => onCancelJob(job.id) : undefined}
                />
              ))
            )}
          </div>
        )}

        {/* Health Tab */}
        {activeTab === 'health' && health && (
          <div>
            <div style={{
              padding: '20px',
              backgroundColor: health.healthy ? '#dcfce7' : '#fef2f2',
              borderRadius: '12px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}>
              <span style={{ fontSize: '32px' }}>
                {health.healthy ? '✅' : '⚠️'}
              </span>
              <div>
                <div style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: health.healthy ? '#16a34a' : '#dc2626'
                }}>
                  {health.healthy ? 'Sistema saludable' : 'Problemas detectados'}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  {health.totalJobs} trabajos en cola • {health.runningJobs} ejecutando
                </div>
              </div>
            </div>

            {health.issues.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '12px' }}>
                  Problemas detectados
                </div>
                {health.issues.map((issue, idx) => (
                  <div key={idx} style={{
                    padding: '12px 16px',
                    backgroundColor: '#fef2f2',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: '#991b1b',
                    marginBottom: '8px'
                  }}>
                    ⚠️ {issue}
                  </div>
                ))}
              </div>
            )}

            {health.recommendations.length > 0 && (
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '12px' }}>
                  Recomendaciones
                </div>
                {health.recommendations.map((rec, idx) => (
                  <div key={idx} style={{
                    padding: '12px 16px',
                    backgroundColor: '#eff6ff',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: '#1e40af',
                    marginBottom: '8px'
                  }}>
                    💡 {rec}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
