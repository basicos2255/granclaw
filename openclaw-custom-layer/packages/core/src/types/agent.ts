export interface Agent {
  id: string
  tenantId: string
  name: string
  description?: string
  presetId?: string
  status: 'idle' | 'running' | 'paused' | 'error'
  createdAt: Date
  updatedAt: Date
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}
