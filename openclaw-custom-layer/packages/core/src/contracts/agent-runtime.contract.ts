import type { Agent, AgentMessage, Session } from '../types'

export interface AgentRuntimeAdapter {
  sendMessage(sessionId: string, message: AgentMessage): Promise<AgentMessage>
  abort(sessionId: string): Promise<void>
  listSessions(agentId: string): Promise<Session[]>
  getSession(sessionId: string): Promise<Session | null>
  patchSession(sessionId: string, patch: Partial<Session>): Promise<Session>
  createSession(agentId: string): Promise<Session>
}
