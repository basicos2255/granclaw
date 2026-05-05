/**
 * Debug page
 * FIX 035: Muestra estado real del backend
 */

import { useState, useEffect } from 'react'
import { api } from '../../services/api'

interface DebugData {
  authStatus: unknown
  tools: unknown
  sessions: unknown
  loading: boolean
  error: string | null
}

export function DebugPage() {
  const [data, setData] = useState<DebugData>({
    authStatus: null,
    tools: null,
    sessions: null,
    loading: true,
    error: null
  })

  useEffect(() => {
    async function fetchData() {
      try {
        const [authRes, toolsRes, sessionsRes] = await Promise.all([
          api.getOpenClawAuthStatus(),
          api.getTools(),
          api.getSessions()
        ])

        setData({
          authStatus: authRes.data ?? authRes,
          tools: toolsRes.data ?? toolsRes,
          sessions: sessionsRes.data ?? sessionsRes,
          loading: false,
          error: null
        })
      } catch (err) {
        setData({
          authStatus: null,
          tools: null,
          sessions: null,
          loading: false,
          error: err instanceof Error ? err.message : 'Error desconocido'
        })
      }
    }

    fetchData()
  }, [])

  const refresh = () => {
    setData(prev => ({ ...prev, loading: true }))
    window.location.reload()
  }

  if (data.loading) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Debug Panel</h1>
        <p>Cargando...</p>
      </div>
    )
  }

  if (data.error) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Debug Panel</h1>
        <p style={{ color: 'red' }}>Error: {data.error}</p>
        <button onClick={refresh}>Reintentar</button>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Debug Panel</h1>
        <button onClick={refresh} style={{ padding: '8px 16px' }}>Refrescar</button>
      </div>

      <section style={{ marginBottom: '24px' }}>
        <h2>OpenClaw Auth Status</h2>
        <pre style={{
          backgroundColor: '#f5f5f5',
          padding: '12px',
          borderRadius: '4px',
          overflow: 'auto',
          maxHeight: '300px'
        }}>
          {JSON.stringify(data.authStatus, null, 2)}
        </pre>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2>Tools Disponibles</h2>
        <pre style={{
          backgroundColor: '#f5f5f5',
          padding: '12px',
          borderRadius: '4px',
          overflow: 'auto',
          maxHeight: '300px'
        }}>
          {JSON.stringify(data.tools, null, 2)}
        </pre>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2>Sessions</h2>
        <pre style={{
          backgroundColor: '#f5f5f5',
          padding: '12px',
          borderRadius: '4px',
          overflow: 'auto',
          maxHeight: '300px'
        }}>
          {JSON.stringify(data.sessions, null, 2)}
        </pre>
      </section>
    </div>
  )
}
