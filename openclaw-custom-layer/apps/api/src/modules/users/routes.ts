/**
 * Routes de Users
 * Admin only - filtra por tenant del usuario
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { ok, unauthorized } from '../../shared/response'
import { getUsersByTenant } from './service'
import type { AuthContext } from '../auth'

export function handleUsers(_req: IncomingMessage, res: ServerResponse, context: AuthContext | null): void {
  // Rutas protegidas requieren contexto
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  // Solo devolver usuarios del mismo tenant
  ok(res, getUsersByTenant(context.tenant.id))
}
