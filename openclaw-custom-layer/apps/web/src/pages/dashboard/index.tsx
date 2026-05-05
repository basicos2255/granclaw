import { useEffect, useState } from 'react'
import { api } from '../../services/api'

interface HealthData {
  status: string
  timestamp: string
  version: string
  uptime: number
}

export function DashboardPage() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getHealth().then((res) => {
      if (res.success && res.data) {
        setHealth(res.data)
      } else {
        setError(res.error || 'Failed to fetch health')
      }
    })
  }, [])

  return (
    <div>
      <h1>GranClaw Dashboard</h1>
      <h2>Health Status</h2>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {health && <pre>{JSON.stringify(health, null, 2)}</pre>}
      {!health && !error && <p>Loading...</p>}
    </div>
  )
}
