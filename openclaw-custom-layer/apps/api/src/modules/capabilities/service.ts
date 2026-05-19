/**
 * Capabilities Service
 * FEATURE 091: Approved Capabilities v1
 * FIX 104: Capability Key Normalization & Deduplication
 * P6.13: Capability Readiness
 */

import { read, write, getById } from '../../storage/file-db'
import { normalizeCapabilityKey } from './capability-normalizer'
import type { ApprovedCapability, CreateCapabilityInput, CapabilityReadiness } from './types'
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

// ============================================================================
// P6.13: CAPABILITY READINESS
// ============================================================================

/**
 * P6.18C: System capability implementation status
 * Maps which capabilities are actually implemented vs stubs
 * CRITICAL: OpenClaw-dependent capabilities should NOT be marked implemented=true
 * unless we have actual evidence of tool/plugin availability.
 */
const CAPABILITY_IMPLEMENTATION_STATUS: Record<string, {
  implemented: boolean
  provider?: string
  requiresApproval: boolean
  requiresOpenClaw: boolean  // P6.18C: Whether this needs OpenClaw gateway
  limitations?: string[]
  missingSetup?: string[]
}> = {
  browser: {
    implemented: false, // Stub - requires Playwright
    provider: 'playwright',
    requiresApproval: true,
    requiresOpenClaw: true,
    limitations: ['Requires Playwright installation', 'Only works on server with display'],
    missingSetup: ['Playwright not installed', 'Browser automation not configured']
  },
  download: {
    implemented: false, // P6.18C: NOT implemented until we have proof of tool
    provider: 'openclaw',
    requiresApproval: true,
    requiresOpenClaw: true,
    limitations: ['Requires OpenClaw download tool', 'File storage not configured'],
    missingSetup: ['Download tool not verified', 'OpenClaw plugin required']
  },
  filesystem: {
    implemented: true,  // Actually implemented locally
    provider: 'node',
    requiresApproval: true,
    requiresOpenClaw: false,
    limitations: ['Sandboxed to allowed paths']
  },
  install_app: {
    implemented: false, // Very dangerous - not implemented
    provider: 'os',
    requiresApproval: true,
    requiresOpenClaw: false,
    limitations: ['Requires explicit approval', 'Windows only'],
    missingSetup: ['OS tools capability not enabled', 'Requires admin approval']
  },
  web_search: {
    implemented: false, // P6.18C: NOT implemented - needs OpenClaw tool verification
    provider: 'openclaw',
    requiresApproval: false,
    requiresOpenClaw: true,
    limitations: ['Depends on OpenClaw web_search tool'],
    missingSetup: ['OpenClaw web_search tool not verified']
  },
  ftp: {
    implemented: false, // Stub
    provider: 'ftp-client',
    requiresApproval: true,
    requiresOpenClaw: false,
    limitations: ['Requires FTP client configuration'],
    missingSetup: ['FTP credentials not configured']
  },
  email: {
    implemented: false, // Stub
    provider: 'smtp',
    requiresApproval: true,
    requiresOpenClaw: false,
    limitations: ['Requires email provider configuration'],
    missingSetup: ['SMTP settings not configured', 'Email account not connected']
  },
  whatsapp: {
    implemented: false, // Stub
    provider: 'whatsapp-business',
    requiresApproval: true,
    requiresOpenClaw: false,
    limitations: ['Requires WhatsApp Business API'],
    missingSetup: ['WhatsApp Business API not configured']
  },
  calendar: {
    implemented: false, // Stub
    provider: 'google-calendar',
    requiresApproval: true,
    requiresOpenClaw: false,
    limitations: ['Requires calendar provider OAuth'],
    missingSetup: ['Calendar provider not connected']
  },
  screenshot: {
    implemented: false, // Requires browser
    provider: 'browser',
    requiresApproval: false,
    requiresOpenClaw: true,
    limitations: ['Requires browser capability'],
    missingSetup: ['Browser capability required']
  },
  clipboard: {
    implemented: false, // Requires OS access
    provider: 'os',
    requiresApproval: true,
    requiresOpenClaw: false,
    limitations: ['Requires OS tools capability'],
    missingSetup: ['OS tools capability not enabled']
  }
}

/**
 * P6.18C: Get readiness status for a specific capability
 * CRITICAL: OpenClaw-dependent capabilities should NOT be available=true
 * without actual evidence of tool/plugin availability.
 */
export function getCapabilityReadiness(
  tenantId: string,
  capabilityType: string
): CapabilityReadiness {
  const normalizedType = capabilityType.toLowerCase()
  const implStatus = CAPABILITY_IMPLEMENTATION_STATUS[normalizedType]

  // Check if capability is approved/configured for tenant
  const approvedCapability = getEnabledCapabilityByKey(tenantId, normalizedType)
  const configured = approvedCapability !== null

  // Default for unknown capabilities
  if (!implStatus) {
    return {
      capability: normalizedType,
      available: false,
      configured,
      implemented: false,
      requiresApproval: true,
      missingSetup: ['Esta capacidad no está reconocida por GranClaw'],
      health: 'unknown',
      statusMessage: `La capacidad "${normalizedType}" no es reconocida por GranClaw.`
    }
  }

  const { implemented, provider, requiresApproval, requiresOpenClaw, limitations, missingSetup } = implStatus

  // P6.18C: OpenClaw-dependent capabilities need gateway + tool verification
  // Without actual evidence, they are NOT available
  let available: boolean
  let health: 'healthy' | 'degraded' | 'unavailable' | 'unknown' = 'unknown'
  let statusMessage: string

  if (!implemented) {
    available = false
    health = 'unavailable'
    if (requiresOpenClaw) {
      statusMessage = `La capacidad "${normalizedType}" depende de OpenClaw pero no esta verificada. ${missingSetup?.[0] || ''}`
    } else {
      statusMessage = `La capacidad "${normalizedType}" aún no está implementada en GranClaw. ${missingSetup?.[0] || ''}`
    }
  } else if (requiresOpenClaw) {
    // P6.18C: Even if "implemented", OpenClaw capabilities need runtime verification
    // Mark as unavailable unless we have evidence (which requires async probe)
    available = false
    health = 'degraded'
    statusMessage = `La capacidad "${normalizedType}" depende de OpenClaw. Verifica estado del sistema en /control/tools.`
  } else if (!configured && requiresApproval) {
    available = false
    health = 'degraded'
    statusMessage = `La capacidad "${normalizedType}" está implementada pero requiere aprobación.`
  } else {
    // Local capability that's implemented and (configured OR doesn't require approval)
    available = true
    health = 'healthy'
    statusMessage = `La capacidad "${normalizedType}" está disponible y configurada.`
  }

  return {
    capability: normalizedType,
    available,
    configured,
    implemented,
    provider,
    requiresApproval,
    missingSetup: !available ? missingSetup : undefined,
    limitations,
    health,
    statusMessage
  }
}

/**
 * P6.13: Get readiness status for all system capabilities
 */
export function getAllCapabilitiesReadiness(tenantId: string): CapabilityReadiness[] {
  const capabilities = Object.keys(CAPABILITY_IMPLEMENTATION_STATUS)
  return capabilities.map(cap => getCapabilityReadiness(tenantId, cap))
}

/**
 * P6.13: Check if capabilities required for a task are ready
 */
export function checkTaskCapabilities(
  tenantId: string,
  requiredCapabilities: string[]
): { allReady: boolean; results: CapabilityReadiness[]; blocking: CapabilityReadiness[] } {
  const results = requiredCapabilities.map(cap => getCapabilityReadiness(tenantId, cap))
  const blocking = results.filter(r => !r.available)

  return {
    allReady: blocking.length === 0,
    results,
    blocking
  }
}
