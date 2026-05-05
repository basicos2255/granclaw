/**
 * Capabilities Types
 * FEATURE 091: Approved Capabilities v1
 * FIX 104: Añadido capabilityKey para normalización y deduplicación
 */

export type RiskLevel = 'low' | 'medium' | 'high'

export interface ApprovedCapability {
  id: string
  tenantId: string
  proposalId: string
  toolName: string
  // FIX 104: Clave canónica normalizada para lookup
  capabilityKey: string
  description: string
  riskLevel: RiskLevel
  requiresOsAccess: boolean
  requiresNetworkAccess: boolean
  enabled: boolean
  // FIX 104: Flag de eliminación lógica
  deleted?: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateCapabilityInput {
  tenantId: string
  proposalId: string
  toolName: string
  // FIX 104: Clave canónica normalizada
  capabilityKey: string
  description: string
  riskLevel: RiskLevel
  requiresOsAccess: boolean
  requiresNetworkAccess: boolean
}
