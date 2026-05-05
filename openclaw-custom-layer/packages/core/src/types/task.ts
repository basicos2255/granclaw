export interface Task {
  id: string
  tenantId: string
  name: string
  description?: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  priority: 'low' | 'medium' | 'high'
  scheduledAt?: Date
  startedAt?: Date
  completedAt?: Date
  result?: unknown
  error?: string
  createdAt: Date
  updatedAt: Date
}

export interface TaskInput {
  name: string
  description?: string
  priority?: 'low' | 'medium' | 'high'
  scheduledAt?: Date
  payload?: Record<string, unknown>
}
