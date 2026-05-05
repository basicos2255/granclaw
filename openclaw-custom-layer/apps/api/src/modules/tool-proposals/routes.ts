/**
 * Tool Proposals Routes
 * FEATURE 090: Tool Proposal System v1
 * FEATURE 091: Integración con capabilities
 * FIX 105: Canonical capability lookup
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { ok, unauthorized, notFound } from '../../shared/response'
import type { AuthContext } from '../auth'
import {
  listToolProposals,
  getToolProposal,
  approveToolProposal,
  rejectToolProposal,
  archiveToolProposal,
  deduplicateProposals
} from './service'
import {
  createCapabilityFromProposal,
  getCapabilityByProposalId,
  getCapabilityByKey,
  normalizeCapabilityKey,
  deduplicateCapabilities
} from '../capabilities'

/**
 * GET /tool-proposals - Lista propuestas del tenant
 */
export function handleGetToolProposals(
  _req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const proposals = listToolProposals({ tenantId: context.tenant.id })
  ok(res, proposals)
}

/**
 * GET /tool-proposals/:id - Obtiene una propuesta por ID
 */
export function handleGetToolProposalById(
  _req: IncomingMessage,
  res: ServerResponse,
  proposalId: string,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const proposal = getToolProposal(proposalId)

  if (!proposal) {
    notFound(res, 'Tool proposal not found')
    return
  }

  // Verificar que la propuesta pertenece al tenant
  if (proposal.tenantId !== context.tenant.id) {
    notFound(res, 'Tool proposal not found')
    return
  }

  ok(res, proposal)
}

/**
 * POST /tool-proposals/:id/approve - Aprueba una propuesta
 * FEATURE 091: Crea ApprovedCapability al aprobar
 * FIX 103: Idempotente - si ya está aprobada, devuelve éxito con datos existentes
 * IMPORTANTE: Solo cambia status y crea capability, NO ejecuta tool real
 */
export function handleApproveToolProposal(
  _req: IncomingMessage,
  res: ServerResponse,
  proposalId: string,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const proposal = getToolProposal(proposalId)

  if (!proposal) {
    notFound(res, 'Tool proposal not found')
    return
  }

  if (proposal.tenantId !== context.tenant.id) {
    notFound(res, 'Tool proposal not found')
    return
  }

  // FIX 105: Normalizar capabilityKey para lookup
  const capabilityKey = proposal.capabilityKey || normalizeCapabilityKey(proposal.proposedToolName)

  // FIX 105: Buscar capability existente por capabilityKey (no proposalId)
  let existingCapability = getCapabilityByKey(context.tenant.id, capabilityKey)

  // FIX 103: Si ya está aprobada, devolver éxito con datos existentes (idempotente)
  if (proposal.status === 'approved') {
    if (existingCapability) {
      console.log(`[ToolProposals] Proposal ${proposalId} already approved, returning existing capability by key`)
      ok(res, {
        proposal,
        capability: existingCapability,
        message: 'Propuesta ya estaba aprobada.'
      })
      return
    }
    // Fallback: buscar por proposalId (legacy)
    existingCapability = getCapabilityByProposalId(proposalId)
    if (existingCapability) {
      console.log(`[ToolProposals] Proposal ${proposalId} already approved, returning existing capability by proposalId`)
      ok(res, {
        proposal,
        capability: existingCapability,
        message: 'Propuesta ya estaba aprobada.'
      })
      return
    }
    // Si por algún motivo no hay capability, crearla
    const newCapability = createCapabilityFromProposal(proposal)
    ok(res, {
      proposal,
      capability: newCapability,
      message: 'Propuesta ya aprobada. Capability creada.'
    })
    return
  }

  // FIX 103: Si está rechazada, no permitir aprobar
  if (proposal.status === 'rejected') {
    notFound(res, 'No se puede aprobar una propuesta rechazada')
    return
  }

  // FIX 105: Si ya existe capability para esta key, solo marcar proposal como aprobada
  if (existingCapability) {
    console.log(`[ToolProposals] Capability already exists for key ${capabilityKey}, marking proposal as approved`)
    const updated = approveToolProposal(proposalId)
    ok(res, {
      proposal: updated || proposal,
      capability: existingCapability,
      message: 'Capability ya existia. Propuesta marcada como aprobada.'
    })
    return
  }

  const updated = approveToolProposal(proposalId)

  if (!updated) {
    notFound(res, 'Failed to approve proposal')
    return
  }

  // FEATURE 091 + FIX 105: Crear capability (createCapabilityFromProposal es idempotente por key)
  const capability = createCapabilityFromProposal(updated)
  console.log(`[ToolProposals] Created/reused capability ${capability.id} for key ${capabilityKey}`)

  ok(res, {
    proposal: updated,
    capability,
    message: 'Tool aprobada. Capability creada y lista para uso controlado.'
  })
}

/**
 * POST /tool-proposals/:id/reject - Rechaza una propuesta
 */
export function handleRejectToolProposal(
  _req: IncomingMessage,
  res: ServerResponse,
  proposalId: string,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const proposal = getToolProposal(proposalId)

  if (!proposal) {
    notFound(res, 'Tool proposal not found')
    return
  }

  if (proposal.tenantId !== context.tenant.id) {
    notFound(res, 'Tool proposal not found')
    return
  }

  const updated = rejectToolProposal(proposalId)

  if (!updated) {
    notFound(res, 'Failed to reject proposal')
    return
  }

  ok(res, updated)
}

/**
 * POST /tool-proposals/:id/archive - Archiva una propuesta
 * FIX 104: Permite archivar propuestas para limpiar la lista
 */
export function handleArchiveToolProposal(
  _req: IncomingMessage,
  res: ServerResponse,
  proposalId: string,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  const proposal = getToolProposal(proposalId)

  if (!proposal) {
    notFound(res, 'Tool proposal not found')
    return
  }

  if (proposal.tenantId !== context.tenant.id) {
    notFound(res, 'Tool proposal not found')
    return
  }

  const updated = archiveToolProposal(proposalId)

  if (!updated) {
    notFound(res, 'Failed to archive proposal')
    return
  }

  ok(res, {
    ...updated,
    message: 'Propuesta archivada'
  })
}

/**
 * POST /tool-proposals/cleanup - Limpia duplicados
 * FIX 105: Deduplica proposals y capabilities por capabilityKey
 */
export function handleCleanupToolProposals(
  _req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null
): void {
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  console.log(`[ToolProposals] Running cleanup for tenant ${context.tenant.id}`)

  // Helper para verificar si existe capability
  const hasCapabilityForKey = (tid: string, key: string): boolean => {
    const cap = getCapabilityByKey(tid, key)
    return cap !== null && cap.enabled
  }

  // Deduplicate capabilities primero
  const capResult = deduplicateCapabilities(context.tenant.id)

  // Deduplicate proposals
  const propResult = deduplicateProposals(context.tenant.id, hasCapabilityForKey)

  console.log(`[ToolProposals] Cleanup complete: capabilities deleted=${capResult.deleted}, proposals archived=${propResult.archived}`)

  ok(res, {
    success: true,
    archivedProposals: propResult.archived,
    deletedCapabilities: capResult.deleted,
    keptCapabilities: capResult.kept,
    keptProposals: propResult.kept,
    message: 'Duplicados limpiados'
  })
}
