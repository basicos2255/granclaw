/**
 * Tipos de Sessions
 */

export type MessageRole = 'user' | 'assistant' | 'system'

export interface SessionMessage {
  role: MessageRole
  content: string
  timestamp: number
}

export interface Session {
  id: string
  tenantId: string
  messages: SessionMessage[]
  createdAt: number
  updatedAt: number
}

export interface CreateSessionInput {
  initialMessage?: string
}

export interface AddMessageInput {
  role: MessageRole
  content: string
}
