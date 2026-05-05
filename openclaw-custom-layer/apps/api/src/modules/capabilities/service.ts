/**
 * Capabilities Service
 * FEATURE 091: Approved Capabilities v1
 * FIX 104: Capability Key Normalization & Deduplication
 */

import { read, write, getById } from '../../storage/file-db'
import { normalizeCapabilityKey } from './capability-normalizer'
import type { ApprovedCapability, CreateCapabilityInput } from './types'
import type { ToolProposal } from '../tool-proposals/types'

const ENTITY = 'capabilities'

function generateId(): string {
  return `cap_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

/**
 * FIX 104: Migra capabilities existentes añadiendo capabilityKey si falta
 */
export function migrateCapabilities(): void {
  const capabilities = read<ApprovedCapability>(ENTITY)
  let migrated = false

  for (const c of capabilities) {
    if (!c.capabilityKey) {
      c.capabilityKey = normalizeCapabilityKey(c.toolName)
      migrated = true
    }
  }

  if (migrated) {
    write(ENTITY, capabilities)
    console.log('[Capabilities] Migrated capabilities with capabilityKey')
  }
}

/**
 * Lista capacidades aprobadas (filtrado opcional por tenant)
 * FIX 104: Excluye deleted por defecto
 */
export function listCapabilities(tenantId?: string): ApprovedCapability[] {
  migrateCapabilities()
  const capabilities = read<ApprovedCapability>(ENTITY)

  return capabilities
    .filter((c: ApprovedCapability) => {
      // FIX 104: Excluir deleted
      if (c.deleted) return false
      if (tenantId && c.tenantId !== tenantId) return false
      return true
    })
    .sort((a: ApprovedCapability, b: ApprovedCapability) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
}

/**
 * Obtiene una capacidad por ID
 */
export function getCapability(id: string): ApprovedCapability | null {
  migrateCapabilities()
  return getById<ApprovedCapability>(ENTITY, id)
}

/**
 * Busca capacidad por proposalId
 */
export function getCapabilityByProposalId(proposalId: string): ApprovedCapability | null {
  migrateCapabilities()
  const capabilities = read<ApprovedCapability>(ENTITY)
  return capabilities.find((c: ApprovedCapability) =>
    c.proposalId === proposalId && !c.deleted
  ) || null
}

/**
 * FIX 104: Busca capacidad por capabilityKey y tenantId (método principal)
 */
export function getCapabilityByKey(tenantId: string, capabilityKey: string): ApprovedCapability | null {
  migrateCapabilities()
  const capabilities = read<ApprovedCapability>(ENTITY)
  const normalizedKey = normalizeCapabilityKey(capabilityKey)

  return capabilities.find((c: ApprovedCapability) =>
    c.tenantId === tenantId &&
    c.capabilityKey === normalizedKey &&
    !c.deleted
  ) || null
}

/**
 * FIX 104: Busca capacidad habilitada por capabilityKey y tenantId
 */
export function getEnabledCapabilityByKey(tenantId: string, capabilityKey: string): ApprovedCapability | null {
  const capability = getCapabilityByKey(tenantId, capabilityKey)
  return capability?.enabled ? capability : null
}

/**
 * Busca capacidad por toolName y tenantId (legacy, usa capabilityKey)
 * FIX 104: Normaliza a capabilityKey
 */
export function getCapabilityByToolName(tenantId: string, toolName: string): ApprovedCapability | null {
  return getCapabilityByKey(tenantId, toolName)
}

/**
 * Crea una capacidad desde una propuesta aprobada
 * FIX 104: Idempotente por capabilityKey, evita duplicados
 */
export function createCapabilityFromProposal(proposal: ToolProposal): ApprovedCapability {
  migrateCapabilities()

  // FIX 104: Normalizar capabilityKey
  const capabilityKey = proposal.capabilityKey || normalizeCapabilityKey(proposal.proposedToolName)

  // FIX 104: Verificar si ya existe por capabilityKey (evita duplicados)
  const existingByKey = getCapabilityByKey(proposal.tenantId, capabilityKey)
  if (existingByKey) {
    console.log(`[Capabilities] Capability already exists for capabilityKey ${capabilityKey}, returning existing`)
    return existingByKey
  }

  // Verificar si ya existe por proposalId (compatibilidad)
  const existingByProposal = getCapabilityByProposalId(proposal.id)
  if (existingByProposal) {
    console.log(`[Capabilities] Capability already exists for proposal ${proposal.id}`)
    return existingByProposal
  }

  const capabilities = read<ApprovedCapability>(ENTITY)
  const now = new Date().toISOString()

  const capability: ApprovedCapability = {
    id: generateId(),
    tenantId: proposal.tenantId,
    proposalId: proposal.id,
    toolName: proposal.proposedToolName,
    capabilityKey,
    description: proposal.description,
    riskLevel: proposal.riskLevel,
    requiresOsAccess: proposal.requiresOsAccess,
    requiresNetworkAccess: proposal.requiresNetworkAccess,
    enabled: true, // Enabled by default on approval
    createdAt: now,
    updatedAt: now
  }

  capabilities.push(capability)
  write(ENTITY, capabilities)

  console.log(`[Capabilities] Created capability ${capability.id} for capabilityKey: ${capabilityKey}`)

  return capability
}

/**
 * Habilita una capacidad
 */
export function enableCapability(id: string): ApprovedCapability | null {
  const capabilities = read<ApprovedCapability>(ENTITY)
  const index = capabilities.findIndex((c: ApprovedCapability) => c.id === id)

  if (index === -1) {
    return null
  }

  capabilities[index].enabled = true
  capabilities[index].updatedAt = new Date().toISOString()

  write(ENTITY, capabilities)

  console.log(`[Capabilities] Enabled capability ${id}`)

  return capabilities[index]
}

/**
 * Deshabilita una capacidad
 */
export function disableCapability(id: string): ApprovedCapability | null {
  const capabilities = read<ApprovedCapability>(ENTITY)
  const index = capabilities.findIndex((c: ApprovedCapability) => c.id === id)

  if (index === -1) {
    return null
  }

  capabilities[index].enabled = false
  capabilities[index].updatedAt = new Date().toISOString()

  write(ENTITY, capabilities)

  console.log(`[Capabilities] Disabled capability ${id}`)

  return capabilities[index]
}

/**
 * Verifica si una capacidad está disponible y habilitada
 * FIX 104: Usa capabilityKey normalizada
 */
export function isCapabilityEnabled(tenantId: string, capabilityKeyOrToolName: string): boolean {
  const capability = getEnabledCapabilityByKey(tenantId, capabilityKeyOrToolName)
  return capability !== null
}

/**
 * FIX 104: Elimina (marca como deleted) una capability
 */
export function deleteCapability(id: string): ApprovedCapability | null {
  const capabilities = read<ApprovedCapability>(ENTITY)
  const index = capabilities.findIndex((c: ApprovedCapability) => c.id === id)

  if (index === -1) {
    return null
  }

  capabilities[index].deleted = true
  capabilities[index].enabled = false
  capabilities[index].updatedAt = new Date().toISOString()

  write(ENTITY, capabilities)

  console.log(`[Capabilities] Deleted capability ${id}`)

  return capabilities[index]
}

/**
 * FIX 104: Cuenta duplicados por capabilityKey
 */
export function countCapabilitiesByKey(tenantId: string, capabilityKey: string): number {
  migrateCapabilities()
  const capabilities = read<ApprovedCapability>(ENTITY)
  const normalizedKey = normalizeCapabilityKey(capabilityKey)

  return capabilities.filter((c: ApprovedCapability) =>
    c.tenantId === tenantId &&
    c.capabilityKey === normalizedKey &&
    !c.deleted
  ).length
}

/**
 * FIX 105: Deduplica capabilities por tenantId + capabilityKey
 * Mantiene la primera enabled o la más reciente, marca duplicadas como deleted
 */
export function deduplicateCapabilities(tenantId?: string): { deleted: number; kept: number } {
  migrateCapabilities()
  const capabilities = read<ApprovedCapability>(ENTITY)

  // Agrupar por tenantId + capabilityKey
  const groups: Record<string, ApprovedCapability[]> = {}

  for (const c of capabilities) {
    if (tenantId && c.tenantId !== tenantId) continue
    if (c.deleted) continue

    const key = `${c.tenantId}:${c.capabilityKey}`
    if (!groups[key]) groups[key] = []
    groups[key].push(c)
  }

  let deletedCount = 0
  let keptCount = 0

  for (const key of Object.keys(groups)) {
    const group = groups[key]
    if (group.length <= 1) {
      keptCount += group.length
      continue
    }

    // Ordenar: enabled primero, luego por fecha más reciente
    group.sort((a, b) => {
      if (a.enabled && !b.enabled) return -1
      if (!a.enabled && b.enabled) return 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    // Mantener el primero, marcar resto como deleted
    keptCount++
    for (let i = 1; i < group.length; i++) {
      const idx = capabilities.findIndex(c => c.id === group[i].id)
      if (idx !== -1) {
        capabilities[idx].deleted = true
        capabilities[idx].enabled = false
        capabilities[idx].updatedAt = new Date().toISOString()
        deletedCount++
      }
    }
  }

  if (deletedCount > 0) {
    write(ENTITY, capabilities)
    console.log(`[Capabilities] Deduplicated: deleted=${deletedCount}, kept=${keptCount}`)
  }

  return { deleted: deletedCount, kept: keptCount }
}
