/**
 * Tool Proposals Service
 * FEATURE 090: Tool Proposal System v1
 * FIX 104: Capability Key Normalization & Deduplication
 */

import { read, write, getById } from '../../storage/file-db'
import { normalizeCapabilityKey } from '../capabilities/capability-normalizer'
import type {
  ToolProposal,
  ToolProposalStatus,
  CreateToolProposalInput,
  ToolProposalFilters,
  MissingCapability
} from './types'

const ENTITY = 'tool-proposals'

function generateId(): string {
  return `tp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

/**
 * FIX 104: Migra proposals existentes añadiendo capabilityKey si falta
 */
export function migrateProposals(): void {
  const proposals = read<ToolProposal>(ENTITY)
  let migrated = false

  for (const p of proposals) {
    if (!p.capabilityKey) {
      p.capabilityKey = normalizeCapabilityKey(p.proposedToolName || p.detectedCapability)
      migrated = true
    }
  }

  if (migrated) {
    write(ENTITY, proposals)
    console.log('[ToolProposals] Migrated proposals with capabilityKey')
  }
}

/**
 * Lista propuestas de tools con filtros opcionales
 * FIX 104: Excluye archived por defecto
 */
export function listToolProposals(filters?: ToolProposalFilters): ToolProposal[] {
  migrateProposals() // Asegurar migración
  const proposals = read<ToolProposal>(ENTITY)

  return proposals
    .filter((p: ToolProposal) => {
      // FIX 104: Por defecto excluir archived
      if (!filters?.status && p.status === 'archived') return false
      if (filters?.tenantId && p.tenantId !== filters.tenantId) return false
      if (filters?.status && p.status !== filters.status) return false
      if (filters?.capabilityKey && p.capabilityKey !== filters.capabilityKey) return false
      return true
    })
    .sort((a: ToolProposal, b: ToolProposal) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

/**
 * Obtiene una propuesta por ID
 */
export function getToolProposal(id: string): ToolProposal | null {
  migrateProposals()
  return getById<ToolProposal>(ENTITY, id)
}

/**
 * Crea una nueva propuesta de tool
 * FIX 104: Usa capabilityKey normalizada
 */
export function createToolProposal(input: CreateToolProposalInput): ToolProposal {
  migrateProposals()
  const proposals = read<ToolProposal>(ENTITY)
  const now = new Date().toISOString()

  // FIX 104: Calcular capabilityKey normalizada
  const capabilityKey = input.capabilityKey || normalizeCapabilityKey(input.proposedToolName || input.detectedCapability)

  const proposal: ToolProposal = {
    id: generateId(),
    tenantId: input.tenantId,
    userId: input.userId,
    requestedAction: input.requestedAction,
    detectedCapability: input.detectedCapability,
    proposedToolName: input.proposedToolName,
    capabilityKey,
    description: input.description,
    riskLevel: input.riskLevel,
    requiresOsAccess: input.requiresOsAccess,
    requiresNetworkAccess: input.requiresNetworkAccess,
    suggestedImplementation: input.suggestedImplementation,
    status: 'pending',
    createdAt: now,
    updatedAt: now
  }

  proposals.push(proposal)
  write(ENTITY, proposals)

  console.log(`[ToolProposals] Created proposal ${proposal.id} for capabilityKey: ${capabilityKey}`)

  return proposal
}

/**
 * Actualiza el status de una propuesta
 */
function updateProposalStatus(id: string, status: ToolProposalStatus): ToolProposal | null {
  const proposals = read<ToolProposal>(ENTITY)
  const index = proposals.findIndex((p: ToolProposal) => p.id === id)

  if (index === -1) {
    return null
  }

  proposals[index].status = status
  proposals[index].updatedAt = new Date().toISOString()

  write(ENTITY, proposals)

  console.log(`[ToolProposals] Updated proposal ${id} status to: ${status}`)

  return proposals[index]
}

/**
 * Aprueba una propuesta (solo cambia status, NO activa tool)
 */
export function approveToolProposal(id: string): ToolProposal | null {
  return updateProposalStatus(id, 'approved')
}

/**
 * Rechaza una propuesta
 */
export function rejectToolProposal(id: string): ToolProposal | null {
  return updateProposalStatus(id, 'rejected')
}

/**
 * FIX 102 + FIX 104: Busca proposal existente por capabilityKey normalizada
 */
export function findExistingProposal(
  tenantId: string,
  capabilityKeyOrToolName: string,
  status?: ToolProposalStatus
): ToolProposal | null {
  migrateProposals()
  const proposals = read<ToolProposal>(ENTITY)
  // FIX 104: Normalizar la clave de búsqueda
  const normalizedKey = normalizeCapabilityKey(capabilityKeyOrToolName)

  return proposals.find((p: ToolProposal) =>
    p.tenantId === tenantId &&
    p.capabilityKey === normalizedKey &&
    (status ? p.status === status : p.status === 'pending')
  ) || null
}

/**
 * FIX 104: Busca todas las proposals para una capabilityKey
 */
export function findProposalsByCapabilityKey(
  tenantId: string,
  capabilityKey: string
): ToolProposal[] {
  migrateProposals()
  const proposals = read<ToolProposal>(ENTITY)
  const normalizedKey = normalizeCapabilityKey(capabilityKey)

  return proposals
    .filter((p: ToolProposal) =>
      p.tenantId === tenantId &&
      p.capabilityKey === normalizedKey &&
      p.status !== 'archived'
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

/**
 * FIX 104: Archiva una propuesta
 */
export function archiveToolProposal(id: string): ToolProposal | null {
  return updateProposalStatus(id, 'archived')
}

/**
 * FIX 104: Cuenta duplicados por capabilityKey
 */
export function countDuplicateProposals(tenantId: string, capabilityKey: string): number {
  const proposals = findProposalsByCapabilityKey(tenantId, capabilityKey)
  return proposals.length
}

/**
 * FIX 105: Deduplica proposals por tenantId + capabilityKey
 * Si hay capability activa para esa key, archiva todas las proposals
 * Si no, mantiene la más reciente pending/approved, archiva el resto
 */
export function deduplicateProposals(
  tenantId: string | undefined,
  hasCapabilityForKey: (tid: string, key: string) => boolean
): { archived: number; kept: number } {
  migrateProposals()
  const proposals = read<ToolProposal>(ENTITY)

  // Agrupar por tenantId + capabilityKey
  const groups: Record<string, ToolProposal[]> = {}

  for (const p of proposals) {
    if (tenantId && p.tenantId !== tenantId) continue
    if (p.status === 'archived') continue

    const key = `${p.tenantId}:${p.capabilityKey}`
    if (!groups[key]) groups[key] = []
    groups[key].push(p)
  }

  let archivedCount = 0
  let keptCount = 0

  for (const key of Object.keys(groups)) {
    const group = groups[key]
    const [tid, capKey] = key.split(':')

    // Si ya hay capability activa para esta key, archivar todas las proposals
    if (hasCapabilityForKey(tid, capKey)) {
      for (const p of group) {
        if (p.status !== 'approved') {
          const idx = proposals.findIndex(pr => pr.id === p.id)
          if (idx !== -1 && proposals[idx].status === 'pending') {
            proposals[idx].status = 'archived'
            proposals[idx].updatedAt = new Date().toISOString()
            archivedCount++
          } else {
            keptCount++
          }
        } else {
          keptCount++
        }
      }
      continue
    }

    if (group.length <= 1) {
      keptCount += group.length
      continue
    }

    // Ordenar: approved > pending > rejected, luego por fecha
    group.sort((a, b) => {
      const statusOrder = { approved: 0, pending: 1, rejected: 2 }
      const aOrder = statusOrder[a.status as keyof typeof statusOrder] ?? 3
      const bOrder = statusOrder[b.status as keyof typeof statusOrder] ?? 3
      if (aOrder !== bOrder) return aOrder - bOrder
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    // Mantener el primero, archivar el resto
    keptCount++
    for (let i = 1; i < group.length; i++) {
      const idx = proposals.findIndex(pr => pr.id === group[i].id)
      if (idx !== -1 && proposals[idx].status !== 'approved') {
        proposals[idx].status = 'archived'
        proposals[idx].updatedAt = new Date().toISOString()
        archivedCount++
      } else {
        keptCount++
      }
    }
  }

  if (archivedCount > 0) {
    write(ENTITY, proposals)
    console.log(`[ToolProposals] Deduplicated: archived=${archivedCount}, kept=${keptCount}`)
  }

  return { archived: archivedCount, kept: keptCount }
}

/**
 * FIX 102 + FIX 104: Detector ampliado de capacidad faltante
 * FIX 121: Guard against install/download false positives
 *
 * Se ejecuta ANTES del orchestrator/OpenClaw
 * Cubre: editor, navegador, calculadora, aplicaciones, comandos, archivos
 * FIX 104: Incluye capabilityKey normalizada
 *
 * IMPORTANT: This detector only provides SIGNALS, not decisions.
 * The execution-router makes the final call.
 */
export function detectMissingCapability(message: string): MissingCapability | null {
  const lowerMessage = message.toLowerCase()

  // FIX 121: Check for install/download/complex patterns FIRST
  // If these patterns exist, we should NOT return simple tool proposals
  // because these actions require agent orchestration
  const hasInstallDownloadSignals = (
    /\b(descarga|descargar|baja|bajar)\b/.test(lowerMessage) ||
    /\b(instala|instalar|instalador|installer)\b/.test(lowerMessage) ||
    /\b(setup|install|download)\b/.test(lowerMessage) ||
    /\b(actualiza|actualizar|update|upgrade)\b/.test(lowerMessage) ||
    /\b(npm\s+install|yarn\s+add|pip\s+install|brew\s+install)\b/.test(lowerMessage) ||
    /\b(e\s+instala|y\s+configura|y\s+ejecuta)\b/.test(lowerMessage)
  )

  // FIX 121: If install/download signals present, return null
  // These should go to OpenClaw, not create local tool proposals
  if (hasInstallDownloadSignals) {
    console.log('[detectMissingCapability] Install/download signals detected - returning null to let intent classifier handle')
    return null
  }

  // ==========================================
  // EDITOR DE TEXTO
  // FIX 121: More restrictive patterns to avoid false positives
  // ==========================================
  const isEditorAction = (
    // Exact patterns for opening editor
    /^abre\s+(el\s+)?editor/.test(lowerMessage) ||
    /^abrir\s+(el\s+)?editor/.test(lowerMessage) ||
    lowerMessage === 'abre notas' ||
    lowerMessage === 'abre el bloc de notas' ||
    /^abre\s+bloc\s+de\s+notas/.test(lowerMessage) ||
    // Specific editor names at start
    /^(abre|abrir)\s+(notepad|textedit|vscode|sublime)/.test(lowerMessage) ||
    // "editor de texto" or "editor de notas" as main action
    /^(abre|abrir)\s+.*(editor\s+de\s+(texto|notas))/.test(lowerMessage) ||
    // "crea una nota" as main action (but NOT "descarga las notas")
    (/^crea\s+una?\s+nota/.test(lowerMessage) && !hasInstallDownloadSignals)
  )

  if (isEditorAction) {
    return {
      detectedCapability: 'open_text_editor',
      proposedToolName: 'open_text_editor',
      capabilityKey: 'open_text_editor',
      description: 'Abrir un editor de texto local o preparar un documento editable',
      riskLevel: 'high',
      requiresOsAccess: true,
      requiresNetworkAccess: false
    }
  }

  // ==========================================
  // NAVEGADOR WEB
  // ==========================================
  if (
    lowerMessage.includes('abre navegador') ||
    lowerMessage.includes('abrir navegador') ||
    lowerMessage.includes('abre el navegador') ||
    lowerMessage.includes('abrir el navegador') ||
    lowerMessage.includes('abre chrome') ||
    lowerMessage.includes('abrir chrome') ||
    lowerMessage.includes('abre safari') ||
    lowerMessage.includes('abrir safari') ||
    lowerMessage.includes('abre firefox') ||
    lowerMessage.includes('abrir firefox') ||
    lowerMessage.includes('abre edge') ||
    lowerMessage.includes('abrir edge') ||
    lowerMessage.includes('abre una web') ||
    lowerMessage.includes('abrir una web') ||
    lowerMessage.includes('abre google') ||
    lowerMessage.includes('abrir google') ||
    lowerMessage.includes('abre la web') ||
    lowerMessage.includes('abrir la web') ||
    lowerMessage.includes('abre internet') ||
    lowerMessage.includes('abrir internet')
  ) {
    return {
      detectedCapability: 'open_web_browser',
      proposedToolName: 'open_web_browser',
      capabilityKey: 'open_web_browser',
      description: 'Abrir un navegador web o acceder a URLs',
      riskLevel: 'high',
      requiresOsAccess: true,
      requiresNetworkAccess: true
    }
  }

  // ==========================================
  // CALCULADORA
  // ==========================================
  if (
    lowerMessage.includes('abre calculadora') ||
    lowerMessage.includes('abrir calculadora') ||
    lowerMessage.includes('abre la calculadora') ||
    lowerMessage.includes('abrir la calculadora') ||
    lowerMessage.includes('calculadora del sistema') ||
    lowerMessage.includes('abre calc') ||
    lowerMessage.includes('abrir calc')
  ) {
    return {
      detectedCapability: 'open_calculator',
      proposedToolName: 'open_calculator',
      capabilityKey: 'open_calculator',
      description: 'Abrir la calculadora del sistema operativo',
      riskLevel: 'high',
      requiresOsAccess: true,
      requiresNetworkAccess: false
    }
  }

  // ==========================================
  // APLICACIONES ESPECÍFICAS
  // ==========================================
  if (
    lowerMessage.includes('abre photoshop') ||
    lowerMessage.includes('abrir photoshop') ||
    lowerMessage.includes('abre word') ||
    lowerMessage.includes('abrir word') ||
    lowerMessage.includes('abre excel') ||
    lowerMessage.includes('abrir excel') ||
    lowerMessage.includes('abre powerpoint') ||
    lowerMessage.includes('abrir powerpoint') ||
    lowerMessage.includes('abre finder') ||
    lowerMessage.includes('abrir finder') ||
    lowerMessage.includes('abre explorador') ||
    lowerMessage.includes('abrir explorador') ||
    lowerMessage.includes('abre spotify') ||
    lowerMessage.includes('abrir spotify') ||
    lowerMessage.includes('abre slack') ||
    lowerMessage.includes('abrir slack') ||
    lowerMessage.includes('abre discord') ||
    lowerMessage.includes('abrir discord') ||
    lowerMessage.includes('abre zoom') ||
    lowerMessage.includes('abrir zoom') ||
    lowerMessage.includes('abre teams') ||
    lowerMessage.includes('abrir teams') ||
    lowerMessage.includes('abre la aplicacion') ||
    lowerMessage.includes('abrir la aplicacion') ||
    lowerMessage.includes('abre aplicacion') ||
    lowerMessage.includes('abrir aplicacion') ||
    lowerMessage.includes('lanzar aplicacion') ||
    lowerMessage.includes('ejecutar aplicacion')
  ) {
    return {
      detectedCapability: 'launch_application',
      proposedToolName: 'open_local_application',
      capabilityKey: 'open_local_application',
      description: 'Abrir o ejecutar aplicaciones del sistema',
      riskLevel: 'high',
      requiresOsAccess: true,
      requiresNetworkAccess: false
    }
  }

  // ==========================================
  // TERMINAL / COMANDOS DEL SISTEMA
  // ==========================================
  if (
    lowerMessage.includes('abre terminal') ||
    lowerMessage.includes('abrir terminal') ||
    lowerMessage.includes('abre la terminal') ||
    lowerMessage.includes('abrir la terminal') ||
    lowerMessage.includes('ejecutar comando') ||
    lowerMessage.includes('ejecuta comando') ||
    lowerMessage.includes('ejecutar script') ||
    lowerMessage.includes('ejecuta script') ||
    lowerMessage.includes('run command') ||
    (lowerMessage.includes('consola') && lowerMessage.includes('abre')) ||
    (lowerMessage.includes('shell') && lowerMessage.includes('abre')) ||
    (lowerMessage.includes('cmd') && lowerMessage.includes('abre')) ||
    (lowerMessage.includes('powershell') && lowerMessage.includes('abre'))
  ) {
    return {
      detectedCapability: 'run_system_command',
      proposedToolName: 'run_system_command',
      capabilityKey: 'run_system_command',
      description: 'Ejecutar comandos o scripts del sistema operativo',
      riskLevel: 'high',
      requiresOsAccess: true,
      requiresNetworkAccess: false
    }
  }

  // ==========================================
  // ESCRITURA DE ARCHIVOS
  // ==========================================
  if (
    lowerMessage.includes('crear archivo') ||
    lowerMessage.includes('crea archivo') ||
    lowerMessage.includes('guardar archivo') ||
    lowerMessage.includes('guarda archivo') ||
    lowerMessage.includes('escribir archivo') ||
    lowerMessage.includes('escribe archivo') ||
    lowerMessage.includes('crear un archivo') ||
    lowerMessage.includes('guardar un archivo') ||
    lowerMessage.includes('escribir en un archivo')
  ) {
    return {
      detectedCapability: 'file_write',
      proposedToolName: 'write_local_file',
      capabilityKey: 'write_local_file',
      description: 'Crear o escribir archivos locales',
      riskLevel: 'high',
      requiresOsAccess: true,
      requiresNetworkAccess: false
    }
  }

  // ==========================================
  // LECTURA DE ARCHIVOS
  // ==========================================
  if (
    lowerMessage.includes('leer archivo') ||
    lowerMessage.includes('lee archivo') ||
    lowerMessage.includes('abrir archivo') ||
    lowerMessage.includes('abre archivo') ||
    lowerMessage.includes('leer el archivo') ||
    lowerMessage.includes('abrir el archivo')
  ) {
    return {
      detectedCapability: 'file_read',
      proposedToolName: 'read_local_file',
      capabilityKey: 'read_local_file',
      description: 'Leer contenido de archivos locales',
      riskLevel: 'medium',
      requiresOsAccess: true,
      requiresNetworkAccess: false
    }
  }

  // No se detecta capacidad faltante
  return null
}
