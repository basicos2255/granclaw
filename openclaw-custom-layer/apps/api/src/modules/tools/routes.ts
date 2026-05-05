/**
 * Routes para módulo tools
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { json, badRequest, notFound } from '../../shared/response'
import { listTools, getTool } from './registry'

/**
 * GET /tools - Lista todas las tools disponibles
 */
export function handleListTools(_req: IncomingMessage, res: ServerResponse): void {
  const tools = listTools()
  json(res, {
    success: true,
    tools,
    count: tools.length
  })
}

/**
 * GET /tools/:id - Obtiene una tool por id
 */
export function handleGetTool(_req: IncomingMessage, res: ServerResponse, id: string): void {
  if (!id || id.trim().length === 0) {
    badRequest(res, 'Tool id is required')
    return
  }

  const tool = getTool(id)
  if (!tool) {
    notFound(res, `Tool with id "${id}" not found`)
    return
  }

  json(res, {
    success: true,
    tool: {
      id: tool.id,
      name: tool.name,
      description: tool.description
    }
  })
}
