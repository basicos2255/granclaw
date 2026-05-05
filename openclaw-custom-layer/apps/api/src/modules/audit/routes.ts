/**
 * Routes de Audit
 * Con tenant isolation via auth context
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { ok, unauthorized } from '../../shared/response'
import { getAuditEntriesByTenant } from './service'
import type { AuthContext } from '../auth'

export function handleAudit(_req: IncomingMessage, res: ServerResponse, context: AuthContext | null): void {
  // Rutas protegidas requieren contexto
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  ok(res, getAuditEntriesByTenant(context.tenant.id))
}
