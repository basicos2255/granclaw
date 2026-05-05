import { useEffect, useState } from 'react'
import { api } from '../../services/api'

export function AgentsPage() {
  const [agents, setAgents] = useState<unknown[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getAgents().then((res) => {
      if (res.success && res.data) {
        setAgents(res.data)
      } else {
        setError(res.error || 'Failed to fetch agents')
      }
    })
  }, [])

  return (
    <div>
      <h1>Agents</h1>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      <pre>{JSON.stringify(agents, null, 2)}</pre>
      {agents.length === 0 && !error && <p>No agents found</p>}
    </div>
  )
}
