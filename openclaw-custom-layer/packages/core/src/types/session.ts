export interface Session {
  id: string
  agentId: string
  tenantId: string
  status: 'active' | 'completed' | 'aborted' | 'error'
  startedAt: Date
  endedAt?: Date
  metadata?: Record<string, unknown>
}

export interface SessionMessage {
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}
