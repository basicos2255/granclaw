/**
 * Tool Proposals Types
 * FEATURE 090: Tool Proposal System v1
 * FIX 104: Añadido capabilityKey para normalización y deduplicación
 */

export type ToolProposalStatus = 'pending' | 'approved' | 'rejected' | 'archived'

export type RiskLevel = 'low' | 'medium' | 'high'

export interface ToolProposal {
  id: string
  tenantId: string
  userId?: string
  requestedAction: string
  detectedCapability: string
  proposedToolName: string
  // FIX 104: Clave canónica normalizada para lookup y deduplicación
  capabilityKey: string
  description: string
  riskLevel: RiskLevel
  requiresOsAccess: boolean
  requiresNetworkAccess: boolean
  suggestedImplementation?: string
  status: ToolProposalStatus
  createdAt: string
  updatedAt: string
}

export interface CreateToolProposalInput {
  tenantId: string
  userId?: string
  requestedAction: string
  detectedCapability: string
  proposedToolName: string
  // FIX 104: Clave canónica normalizada
  capabilityKey?: string
  description: string
  riskLevel: RiskLevel
  requiresOsAccess: boolean
  requiresNetworkAccess: boolean
  suggestedImplementation?: string
}

export interface MissingCapability {
  detectedCapability: string
  proposedToolName: string
  // FIX 104: Clave canónica normalizada
  capabilityKey: string
  description: string
  riskLevel: RiskLevel
  requiresOsAccess: boolean
  requiresNetworkAccess: boolean
}

export interface ToolProposalFilters {
  tenantId?: string
  status?: ToolProposalStatus
  // FIX 104: Filtro por capabilityKey
  capabilityKey?: string
}
