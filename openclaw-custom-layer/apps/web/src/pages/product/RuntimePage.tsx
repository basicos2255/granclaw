/**
 * Runtime Monitor Page
 * P2: Product Experience Layer
 *
 * Advanced runtime monitoring for devops/power users.
 */

import { useState, useEffect } from 'react'
import { useRuntimeWs, useQueueEvents } from '../../hooks/useRuntimeWs'

interface RuntimeState {
  queue: {
    pending: number
    running: number
    pressure: number
    avgWaitMs: number
  }
  workers: {
    total: number
    busy: number
    idle: number
  }
  dag: {
    active: number
    completed: number
    failed: number
  }
  websocket: {
    connections: number
    subscriptions: number
    messagesPerMinute: number
  }
  resources: {
    memoryUsageMb: number
    cpuPercent: number
    openConnections: number
  }
  deadLetters: number
  retries: {
    pending: number
    lastHour: number
  }
  locks: {
    active: number
    waiting: number
  }
}

export function RuntimePage() {
  const { isConnected, state: connectionState } = useRuntimeWs()
  const { lastEvent } = useQueueEvents()
  const [state, setState] = useState<RuntimeState | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Fetch runtime state
  const fetchState = async () => {
    try {
      const res = await fetch('/api/runtime/state')
      if (res.ok) {
        const data = await res.json()
        setState({
          queue: {
            pending: data.queueState?.totalPending ?? 0,
            running: data.queueState?.totalRunning ?? 0,
            pressure: data.queueState?.pressure ?? 0,
            avgWaitMs: data.queueState?.avgWaitTime ?? 0
          },
          workers: {
            total: data.orchestratorState?.totalWorkers ?? 4,
            busy: data.orchestratorState?.busyWorkers ?? 0,
            idle: data.orchestratorState?.idleWorkers ?? 4
          },
          dag: {
            active: data.dagState?.activeWorkflows ?? 0,
            completed: data.dagState?.completedToday ?? 0,
            failed: data.dagState?.failedToday ?? 0
          },
          websocket: {
            connections: data.wsState?.activeConnections ?? 0,
            subscriptions: data.wsState?.totalSubscriptions ?? 0,
            messagesPerMinute: data.wsState?.messagesSentLastMinute ?? 0
          },
          resources: {
            memoryUsageMb: data.resources?.memoryUsageMb ?? 0,
            cpuPercent: data.resources?.cpuPercent ?? 0,
            openConnections: data.wsState?.activeConnections ?? 0
          },
          deadLetters: data.queueState?.deadLetters ?? 0,
          retries: {
            pending: data.queueState?.pendingRetries ?? 0,
            lastHour: 0
          },
          locks: {
            active: 0,
            waiting: 0
          }
        })
        setLastUpdate(new Date())
      }
    } catch (err) {
      console.error('Failed to fetch runtime state:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchState()
  }, [])

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchState, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  // Update on queue events
  useEffect(() => {
    if (lastEvent) {
      fetchState()
    }
  }, [lastEvent])

  const getPressureLevel = (pressure: number): { label: string; color: string } => {
    if (pressure < 0.3) return { label: 'Normal', color: '#16a34a' }
    if (pressure < 0.6) return { label: 'Moderate', color: '#d97706' }
    if (pressure < 0.8) return { label: 'High', color: '#f97316' }
    return { label: 'Critical', color: '#dc2626' }
  }

  const MetricCard = ({ title, children, status }: { title: string; children: React.ReactNode; status?: 'good' | 'warning' | 'error' }) => {
    const borderColor = status === 'error' ? '#fee2e2' : status === 'warning' ? '#fef3c7' : '#e2e8f0'
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        border: `1px solid ${borderColor}`,
        padding: '20px'
      }}>
        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px', fontWeight: '500' }}>
          {title}
        </div>
        {children}
      </div>
    )
  }

  const pressureLevel = state ? getPressureLevel(state.queue.pressure) : { label: 'Unknown', color: '#94a3b8' }

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a' }}>Runtime Monitor</h1>
            <span style={{
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: '600',
              backgroundColor: isConnected ? '#dcfce7' : '#fee2e2',
              color: isConnected ? '#16a34a' : '#dc2626'
            }}>
              {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>
          <p style={{ color: '#64748b' }}>
            Advanced monitoring for runtime health
            {lastUpdate && (
              <span style={{ marginLeft: '12px', fontSize: '12px' }}>
                Updated: {lastUpdate.toLocaleTimeString('es-ES')}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            Auto-refresh
          </label>
          <button
            onClick={fetchState}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f1f5f9',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#475569',
              cursor: 'pointer'
            }}
          >
            Refresh Now
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>Loading runtime state...</div>
      ) : !state ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#dc2626' }}>Failed to load runtime state</div>
      ) : (
        <>
          {/* Queue Pressure Banner */}
          <div style={{
            backgroundColor: pressureLevel.color + '15',
            border: `1px solid ${pressureLevel.color}40`,
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: pressureLevel.color
              }} />
              <div>
                <span style={{ fontWeight: '600', color: '#0f172a' }}>Queue Pressure: </span>
                <span style={{ color: pressureLevel.color, fontWeight: '600' }}>{pressureLevel.label}</span>
                <span style={{ color: '#64748b', marginLeft: '8px' }}>({Math.round(state.queue.pressure * 100)}%)</span>
              </div>
            </div>
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              {state.queue.pending} pending · {state.queue.running} running
            </div>
          </div>

          {/* Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>

            {/* Queue */}
            <MetricCard title="QUEUE" status={state.queue.pressure > 0.8 ? 'error' : state.queue.pressure > 0.5 ? 'warning' : 'good'}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a' }}>{state.queue.pending}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Pending</div>
                </div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#3b82f6' }}>{state.queue.running}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Running</div>
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: '#0f172a' }}>{state.queue.avgWaitMs}ms</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Avg Wait</div>
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: state.deadLetters > 0 ? '#dc2626' : '#0f172a' }}>
                    {state.deadLetters}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Dead Letters</div>
                </div>
              </div>
            </MetricCard>

            {/* Workers */}
            <MetricCard title="WORKERS">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a' }}>{state.workers.total}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Total</div>
                </div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#3b82f6' }}>{state.workers.busy}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Busy</div>
                </div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#16a34a' }}>{state.workers.idle}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Idle</div>
                </div>
              </div>
              {/* Worker utilization bar */}
              <div style={{ marginTop: '16px' }}>
                <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(state.workers.busy / state.workers.total) * 100}%`,
                    backgroundColor: '#3b82f6',
                    borderRadius: '4px'
                  }} />
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  {Math.round((state.workers.busy / state.workers.total) * 100)}% utilization
                </div>
              </div>
            </MetricCard>

            {/* DAG */}
            <MetricCard title="DAG WORKFLOWS" status={state.dag.failed > 0 ? 'warning' : 'good'}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#3b82f6' }}>{state.dag.active}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Active</div>
                </div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#16a34a' }}>{state.dag.completed}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Completed</div>
                </div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: state.dag.failed > 0 ? '#dc2626' : '#0f172a' }}>
                    {state.dag.failed}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Failed</div>
                </div>
              </div>
            </MetricCard>

            {/* WebSocket */}
            <MetricCard title="WEBSOCKET">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a' }}>{state.websocket.connections}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Connections</div>
                </div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a' }}>{state.websocket.subscriptions}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Subscriptions</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: '#0f172a' }}>{state.websocket.messagesPerMinute}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Messages/min</div>
                </div>
              </div>
            </MetricCard>

            {/* Retries */}
            <MetricCard title="RETRIES" status={state.retries.pending > 10 ? 'warning' : 'good'}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: state.retries.pending > 0 ? '#d97706' : '#0f172a' }}>
                    {state.retries.pending}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Pending</div>
                </div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a' }}>{state.retries.lastHour}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Last Hour</div>
                </div>
              </div>
            </MetricCard>

            {/* Locks */}
            <MetricCard title="LOCKS">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a' }}>{state.locks.active}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Active</div>
                </div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: state.locks.waiting > 0 ? '#d97706' : '#0f172a' }}>
                    {state.locks.waiting}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Waiting</div>
                </div>
              </div>
            </MetricCard>

          </div>

          {/* Connection State Debug */}
          <div style={{
            marginTop: '24px',
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            padding: '16px 20px',
            fontSize: '12px',
            fontFamily: 'monospace',
            color: '#64748b'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '8px', color: '#0f172a' }}>Connection State</div>
            <div>WebSocket: {connectionState}</div>
            <div>Runtime URL: /ws</div>
            <div>Last Heartbeat: {new Date().toISOString()}</div>
          </div>
        </>
      )}
    </div>
  )
}
