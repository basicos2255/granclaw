/**
 * Routes de Presets
 * Con tenant isolation via auth context
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { ok, badRequest, unauthorized } from '../../shared/response'
import { getAllPresets, createPreset } from './service'
import type { CreatePresetInput } from './types'
import type { AuthContext } from '../auth'

export function handlePresets(_req: IncomingMessage, res: ServerResponse, context: AuthContext | null): void {
  // Rutas protegidas requieren contexto
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  ok(res, getAllPresets(context.tenant.id))
}

export function handleCreatePreset(req: IncomingMessage, res: ServerResponse, context: AuthContext | null): void {
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

    let input: CreatePresetInput

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

    if (!input.systemPrompt || typeof input.systemPrompt !== 'string') {
      badRequest(res, 'Field "systemPrompt" is required')
      return
    }

    const preset = createPreset(input, context.tenant.id)
    ok(res, preset, 201)
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}
