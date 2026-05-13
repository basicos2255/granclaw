/**
 * Capabilities Types
 * FEATURE 091: Approved Capabilities v1
 * FIX 104: Añadido capabilityKey para normalización y deduplicación
 * P6.13: Capability Readiness
 */

export type RiskLevel = 'low' | 'medium' | 'high'

/**
 * P6.13: System capability types (core capabilities that may or may not be implemented)
 */
export type SystemCapabilityType =
  | 'browser'
  | 'download'
  | 'filesystem'
  | 'install_app'
  | 'web_search'
  | 'ftp'
  | 'email'
  | 'whatsapp'
  | 'calendar'
  | 'screenshot'
  | 'clipboard'

/**
 * P6.13: Capability readiness status
 */
export interface CapabilityReadiness {
  /** Capability identifier */
  capability: SystemCapabilityType | string
  /** Whether the capability is available in this GranClaw instance */
  available: boolean
  /** Whether the capability is configured (has necessary settings) */
  configured: boolean
  /** Whether the capability is actually implemented (not a stub) */
  implemented: boolean
  /** Provider that handles this capability */
  provider?: string
  /** Whether this capability requires explicit approval before use */
  requiresApproval: boolean
  /** What setup is missing (if not configured) */
  missingSetup?: string[]
  /** Known limitations of this capability */
  limitations?: string[]
  /** Last health check result */
  health?: 'healthy' | 'degraded' | 'unavailable' | 'unknown'
  /** Human-readable status message */
  statusMessage: string
}

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
