import { useEffect, useState } from 'react'
import { api } from '../../services/api'

export function SessionsPage() {
  const [sessions, setSessions] = useState<unknown[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getSessions().then((res) => {
      if (res.success && res.data) {
        setSessions(res.data)
      } else {
        setError(res.error || 'Failed to fetch sessions')
      }
    })
  }, [])

  return (
    <div>
      <h1>Sessions</h1>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      <pre>{JSON.stringify(sessions, null, 2)}</pre>
      {sessions.length === 0 && !error && <p>No sessions found</p>}
    </div>
  )
}
