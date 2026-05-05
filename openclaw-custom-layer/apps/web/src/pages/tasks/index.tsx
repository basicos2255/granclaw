import { useEffect, useState } from 'react'
import { api } from '../../services/api'

export function TasksPage() {
  const [tasks, setTasks] = useState<unknown[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getTasks().then((res) => {
      if (res.success && res.data) {
        setTasks(res.data)
      } else {
        setError(res.error || 'Failed to fetch tasks')
      }
    })
  }, [])

  return (
    <div>
      <h1>Tasks</h1>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      <pre>{JSON.stringify(tasks, null, 2)}</pre>
      {tasks.length === 0 && !error && <p>No tasks found</p>}
    </div>
  )
}
