/**
 * Routes de Tenants
 * Admin only - filtra por tenant del usuario
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { ok, unauthorized } from '../../shared/response'
import { getTenantById } from './service'
import type { AuthContext } from '../auth'

export function handleTenants(_req: IncomingMessage, res: ServerResponse, context: AuthContext | null): void {
  // Rutas protegidas requieren contexto
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  // Solo devolver el tenant del usuario actual
  const tenant = getTenantById(context.tenant.id)
  ok(res, tenant ? [tenant] : [])
}
