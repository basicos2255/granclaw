/**
 * Tool Registry
 * Registro central de tools disponibles
 */

import type { Tool, ToolInfo } from './types'

/**
 * Registry interno de tools
 */
const toolRegistry: Map<string, Tool> = new Map()

/**
 * Registrar una tool
 */
export function registerTool(tool: Tool): void {
  if (toolRegistry.has(tool.id)) {
    throw new Error(`Tool with id "${tool.id}" already registered`)
  }
  toolRegistry.set(tool.id, tool)
}

/**
 * Obtener tool por id
 */
export function getTool(id: string): Tool | null {
  return toolRegistry.get(id) || null
}

/**
 * Listar todas las tools (info sin execute)
 */
export function listTools(): ToolInfo[] {
  const tools: ToolInfo[] = []
  toolRegistry.forEach((tool) => {
    tools.push({
      id: tool.id,
      name: tool.name,
      description: tool.description
    })
  })
  return tools
}

/**
 * Verificar si una tool existe
 */
export function hasTool(id: string): boolean {
  return toolRegistry.has(id)
}

/**
 * Obtener múltiples tools por ids
 */
export function getTools(ids: string[]): Tool[] {
  const tools: Tool[] = []
  for (const id of ids) {
    const tool = getTool(id)
    if (tool) {
      tools.push(tool)
    }
  }
  return tools
}
