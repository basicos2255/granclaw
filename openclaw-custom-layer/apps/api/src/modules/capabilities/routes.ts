/**
 * Capabilities Routes
 * FEATURE 091: Approved Capabilities v1
 * P6.13: Capability Readiness
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { ok, unauthorized, notFound } from '../../shared/response'
import type { AuthContext } from '../auth'
import {
  listCapabilities,
  getCapability,
  enableCapability,
  disableCapability,
  deleteCapability,
  getCapabilityReadiness,
  getAllCapabilitiesReadiness
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

// ============================================================================
// P6.13: CAPABILITY READINESS ENDPOINTS
// ============================================================================

/**
 * P6.13: GET /capabilities/readiness - Get readiness for all system capabilities
 */
export function handleGetAllCapabilitiesReadiness(
  _req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const readiness = getAllCapabilitiesReadiness(context.tenant.id)

  // Group by availability for easier consumption
  const available = readiness.filter(r => r.available)
  const notAvailable = readiness.filter(r => !r.available)

  ok(res, {
    success: true,
    summary: {
      total: readiness.length,
      available: available.length,
      notAvailable: notAvailable.length
    },
    capabilities: readiness,
    available,
    notAvailable
  })
}

/**
 * P6.13: GET /capabilities/:capability/readiness - Get readiness for specific capability
 */
export function handleGetCapabilityReadiness(
  _req: IncomingMessage,
  res: ServerResponse,
  capabilityType: string,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const readiness = getCapabilityReadiness(context.tenant.id, capabilityType)

  ok(res, {
    success: true,
    ...readiness
  })
}

/**
 * P6.13: POST /capabilities/:capability/test - Test a capability
 * Returns a diagnostic result (not real execution)
 */
export function handleTestCapability(
  _req: IncomingMessage,
  res: ServerResponse,
  capabilityType: string,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const readiness = getCapabilityReadiness(context.tenant.id, capabilityType)

  // If not implemented, can't test
  if (!readiness.implemented) {
    ok(res, {
      success: false,
      testPassed: false,
      capability: capabilityType,
      reason: 'capability_not_implemented',
      message: `La capacidad "${capabilityType}" no está implementada en GranClaw.`,
      readiness
    })
    return
  }

  // If not configured, suggest configuration
  if (!readiness.configured) {
    ok(res, {
      success: false,
      testPassed: false,
      capability: capabilityType,
      reason: 'capability_not_configured',
      message: `La capacidad "${capabilityType}" no está configurada para tu cuenta.`,
      suggestedAction: 'configure',
      readiness
    })
    return
  }

  // For now, we just return a simulated test result
  // In a real implementation, this would actually test the capability
  ok(res, {
    success: true,
    testPassed: true,
    capability: capabilityType,
    message: `La capacidad "${capabilityType}" está lista para usar.`,
    readiness,
    note: 'Este es un test básico de configuración. La ejecución real puede variar según la tarea.'
  })
}

// ============================================================================
// P6.18: REAL PROBE ENDPOINTS
// ============================================================================

import {
  probeOpenClawGateway,
  probeCapabilityReadiness,
  probeAllCapabilities
} from './probe'

/**
 * P6.18C: GET /capabilities/probe/gateway - Probe OpenClaw gateway connectivity
 * Returns OpenClawProbeResult directly in data (no extra wrapper)
 */
export function handleProbeGateway(
  _req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  // P6.18C: Return data directly, not wrapped in { success, probe }
  probeOpenClawGateway(true).then(result => {
    ok(res, result)
  }).catch(err => {
    // On error, return a valid OpenClawProbeResult with error state
    const errorResult: import('./types').OpenClawProbeResult = {
      state: 'unknown',
      gateway: { configured: false, reachable: false, error: err.message || 'Probe failed' },
      websocket: { configured: false, connected: false, handshakeComplete: false },
      probedAt: new Date().toISOString()
    }
    ok(res, errorResult)
  })
}

/**
 * P6.18C: GET /capabilities/probe/:capability - Probe specific capability readiness
 * Returns RealCapabilityReadiness directly in data (no extra wrapper)
 */
export function handleProbeCapability(
  _req: IncomingMessage,
  res: ServerResponse,
  capabilityKey: string,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  // P6.18C: Return data directly, not wrapped in { success, readiness }
  probeCapabilityReadiness(context.tenant.id, capabilityKey).then(readiness => {
    ok(res, readiness)
  }).catch(err => {
    // On error, return a valid RealCapabilityReadiness with error state
    const errorReadiness: import('./types').RealCapabilityReadiness = {
      capability: capabilityKey,
      displayName: capabilityKey,
      state: 'unknown',
      isCore: false,
      providerChain: ['unknown'],
      statusMessage: `Error al probar ${capabilityKey}: ${err.message || 'Error desconocido'}`
    }
    ok(res, errorReadiness)
  })
}

/**
 * P6.18C: GET /capabilities/probe/all - Full system readiness snapshot
 * Returns SystemReadinessSnapshot directly in data (no extra wrapper)
 */
export function handleProbeAllCapabilities(
  req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  // Check for refresh query param
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  const forceRefresh = url.searchParams.get('refresh') === 'true'

  // P6.18C: Return data directly, not wrapped in { success, snapshot }
  probeAllCapabilities(context.tenant.id, forceRefresh).then(snapshot => {
    ok(res, snapshot)
  }).catch(err => {
    // On error, return a valid SystemReadinessSnapshot with error state
    const errorSnapshot: import('./types').SystemReadinessSnapshot = {
      openclaw: {
        state: 'unknown',
        gateway: { configured: false, reachable: false, error: err.message || 'Probe failed' },
        websocket: { configured: false, connected: false, handshakeComplete: false },
        probedAt: new Date().toISOString()
      },
      capabilities: [],
      summary: { total: 0, ready: 0, unavailable: 0, notConfigured: 0, degraded: 0, unknown: 0 },
      snapshotAt: new Date().toISOString()
    }
    ok(res, errorSnapshot)
  })
}
