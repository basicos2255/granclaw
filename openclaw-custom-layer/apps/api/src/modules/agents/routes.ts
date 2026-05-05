/**
 * Routes de Agents
 * Con tenant isolation via auth context
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { ok, badRequest, unauthorized } from '../../shared/response'
import { getAllAgents, createAgent } from './service'
import type { CreateAgentInput } from './types'
import type { AuthContext } from '../auth'

export function handleAgents(_req: IncomingMessage, res: ServerResponse, context: AuthContext | null): void {
  // Rutas protegidas requieren contexto
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  ok(res, getAllAgents(context.tenant.id))
}

export function handleCreateAgent(req: IncomingMessage, res: ServerResponse, context: AuthContext | null): void {
  // Rutas protegidas requieren contexto
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  let body = ''

  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', () => {
    if (!body) {
      badRequest(res, 'Request body is required')
      return
    }

    let input: CreateAgentInput

    try {
      input = JSON.parse(body)
    } catch {
      badRequest(res, 'Invalid JSON body')
      return
    }

    if (!input.name || typeof input.name !== 'string') {
      badRequest(res, 'Field "name" is required')
      return
    }

    if (!input.presetId || typeof input.presetId !== 'string') {
      badRequest(res, 'Field "presetId" is required')
      return
    }

    const result = createAgent(input, context.tenant.id)

    if (!result.success) {
      badRequest(res, result.error || 'Failed to create agent')
      return
    }

    ok(res, result.agent, 201)
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}
