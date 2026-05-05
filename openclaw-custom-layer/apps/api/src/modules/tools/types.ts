/**
 * Tool types
 * Sistema de tools interno para agentes
 */

/**
 * Contexto de ejecución de tool
 */
export interface ToolExecutionContext {
  tenantId?: string
  userId?: string
  sessionId?: string
}

/**
 * Función de ejecución de tool
 */
export type ToolExecutor = (input: unknown, context?: ToolExecutionContext) => Promise<unknown>

/**
 * Definición de Tool
 */
export interface Tool {
  id: string
  name: string
  description: string
  execute: ToolExecutor
}

/**
 * Resultado de ejecución de tool
 */
export interface ToolExecutionResult {
  success: boolean
  toolId: string
  result: unknown
  error?: string
}

/**
 * Tool info (sin execute para serialización)
 */
export interface ToolInfo {
  id: string
  name: string
  description: string
}
