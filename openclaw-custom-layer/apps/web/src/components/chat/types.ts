/**
 * Chat component types
 * FIX 036: Added source and toolId for product UX
 */

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
  source?: 'openclaw' | 'tool' | 'mock'
  toolId?: string
  timestamp?: number
}
