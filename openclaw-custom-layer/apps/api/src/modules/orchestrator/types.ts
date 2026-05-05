/**
 * Tipos del módulo orchestrator
 */

export interface RunTaskInput {
  message: string
  agentId?: string
  sessionId?: string
  tenantId?: string
}

export type TaskSource = 'mock' | 'openclaw' | 'tool'

export interface RunTaskResult {
  success: boolean
  result: unknown
  source: TaskSource
  agentId?: string
  presetId?: string
  sessionId?: string
  systemPrompt?: string
  toolId?: string
  error?: string
}

/**
 * Input para ACK task (antes llamado streaming)
 * NOTA: chat.send devuelve ACK, streaming real pendiente
 */
export interface StreamTaskInput {
  message: string
  agentId?: string
  sessionId?: string
  tenantId?: string
}

/**
 * Modo de ejecución
 * - ack: chat.send devuelve ACK, respuesta via eventos pendiente
 * - fallback: REST/mock cuando WS no disponible
 * - tool: ejecución de tool
 */
export type StreamMode = 'ack' | 'fallback' | 'tool'

/**
 * Resultado de ACK task
 * NOTA: streaming real pendiente de implementar
 */
export interface StreamTaskResult {
  success: boolean
  mode: StreamMode
  result: unknown
  sessionId?: string
  toolId?: string
  error?: string
}
