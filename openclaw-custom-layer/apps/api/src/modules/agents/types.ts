/**
 * Tipos de Agents
 */

/**
 * Modo de ejecución de tool
 */
export type ToolMode = 'internal' | 'openclaw'

/**
 * Configuración individual de tool
 */
export interface ToolConfig {
  mode: ToolMode
}

/**
 * Configuración de tools del agent
 */
export type ToolsConfig = Record<string, ToolConfig>

export interface Agent {
  id: string
  tenantId: string
  name: string
  presetId: string
  tools: string[]
  toolsConfig?: ToolsConfig
  active: boolean
}

export interface CreateAgentInput {
  name: string
  presetId: string
  tools?: string[]
  toolsConfig?: ToolsConfig
  active?: boolean
}
