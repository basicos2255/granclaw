/**
 * Capabilities Routes
 * FEATURE 091: Approved Capabilities v1
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { ok, unauthorized, notFound } from '../../shared/response'
import type { AuthContext } from '../auth'
import {
  listCapabilities,
  getCapability,
  enableCapability,
  disableCapability,
  deleteCapability
} from './service'

/**
 * GET /capabilities - Lista capacidades del tenant
 */
export function handleGetCapabilities(
  _req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const capabilities = listCapabilities(context.tenant.id)
  ok(res, capabilities)
}

/**
 * GET /capabilities/:id - Obtiene una capacidad por ID
 */
export function handleGetCapabilityById(
  _req: IncomingMessage,
  res: ServerResponse,
  capabilityId: string,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const capability = getCapability(capabilityId)

  if (!capability) {
    notFound(res, 'Capability not found')
    return
  }

  // Verificar que pertenece al tenant
  if (capability.tenantId !== context.tenant.id) {
    notFound(res, 'Capability not found')
    return
  }

  ok(res, capability)
}

/**
 * POST /capabilities/:id/enable - Habilita una capacidad
 */
export function handleEnableCapability(
  _req: IncomingMessage,
  res: ServerResponse,
  capabilityId: string,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const capability = getCapability(capabilityId)

  if (!capability) {
    notFound(res, 'Capability not found')
    return
  }

  if (capability.tenantId !== context.tenant.id) {
    notFound(res, 'Capability not found')
    return
  }

  const updated = enableCapability(capabilityId)

  if (!updated) {
    notFound(res, 'Failed to enable capability')
    return
  }

  ok(res, {
    ...updated,
    message: 'Capacidad habilitada'
  })
}

/**
 * POST /capabilities/:id/disable - Deshabilita una capacidad
 */
export function handleDisableCapability(
  _req: IncomingMessage,
  res: ServerResponse,
  capabilityId: string,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const capability = getCapability(capabilityId)

  if (!capability) {
    notFound(res, 'Capability not found')
    return
  }

  if (capability.tenantId !== context.tenant.id) {
    notFound(res, 'Capability not found')
    return
  }

  const updated = disableCapability(capabilityId)

  if (!updated) {
    notFound(res, 'Failed to disable capability')
    return
  }

  ok(res, {
    ...updated,
    message: 'Capacidad deshabilitada'
  })
}

/**
 * DELETE /capabilities/:id - Elimina una capacidad (soft delete)
 * FIX 104: Permite eliminar capabilities para que se vuelvan a proponer
 */
export function handleDeleteCapability(
  _req: IncomingMessage,
  res: ServerResponse,
  capabilityId: string,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const capability = getCapability(capabilityId)

  if (!capability) {
    notFound(res, 'Capability not found')
    return
  }

  if (capability.tenantId !== context.tenant.id) {
    notFound(res, 'Capability not found')
    return
  }

  const deleted = deleteCapability(capabilityId)

  if (!deleted) {
    notFound(res, 'Failed to delete capability')
    return
  }

  ok(res, {
    ...deleted,
    message: 'Capacidad eliminada. La proxima peticion la volvera a proponer.'
  })
}
