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

// ============================================================================
// P6.18: REAL READINESS MODEL WITH EVIDENCE
// ============================================================================

/**
 * P6.18C: Evidence-based readiness state (replaces hardcoded boolean)
 */
export type ReadinessState =
  | 'ready'                  // Actually working - probed successfully with evidence
  | 'unavailable'            // Not available at all (not implemented or not approved)
  | 'not_installed'          // Software/plugin not installed
  | 'not_configured'         // Missing env vars or settings
  | 'not_authorized'         // Missing API key or permissions
  | 'gateway_unreachable'    // OpenClaw gateway not responding
  | 'cli_unavailable'        // CLI not found or not running
  | 'plugin_missing'         // Required plugin not installed
  | 'tool_missing'           // Specific tool not available in gateway
  | 'policy_blocked'         // Blocked by execution policy
  | 'sandbox_blocked'        // Blocked by sandbox restrictions
  | 'auth_expired'           // OAuth/API key expired
  | 'rate_limited'           // Temporarily unavailable
  | 'unknown'                // Gateway alive but capability not verified

/**
 * P6.18: Probe evidence - what we actually checked
 */
export interface ProbeEvidence {
  /** When the probe was executed */
  probedAt: string
  /** How long the probe took (ms) */
  latencyMs: number
  /** What we probed (url, endpoint, etc) */
  target: string
  /** HTTP status code if applicable */
  httpStatus?: number
  /** Raw response summary */
  responseSummary?: string
  /** Error message if probe failed */
  error?: string
}

/**
 * P6.18: Real capability readiness with evidence
 */
export interface RealCapabilityReadiness {
  /** Capability identifier */
  capability: SystemCapabilityType | string
  /** Display name for UI */
  displayName: string
  /** Evidence-based readiness state */
  state: ReadinessState
  /** Probe evidence (if probed) */
  evidence?: ProbeEvidence
  /** Whether this is a core/required capability */
  isCore: boolean
  /** Provider chain: openclaw -> gateway -> cli -> plugin */
  providerChain: string[]
  /** What provider is currently active */
  activeProvider?: string
  /** User-facing status message */
  statusMessage: string
  /** Recovery actions if not ready */
  recoveryActions?: RecoveryAction[]
  /** Last successful probe timestamp */
  lastSuccessfulProbe?: string
}

/**
 * P6.18: Recovery action for blocked capability
 */
export interface RecoveryAction {
  /** Action identifier */
  id: string
  /** Button label */
  label: string
  /** Action type */
  type: 'navigate' | 'retry' | 'external' | 'approve'
  /** Target (route for navigate, url for external) */
  target?: string
  /** Whether this action requires confirmation */
  requiresConfirmation?: boolean
}

/**
 * P6.18: OpenClaw system probe result
 */
export interface OpenClawProbeResult {
  /** Overall system state */
  state: ReadinessState
  /** Gateway status */
  gateway: {
    configured: boolean
    reachable: boolean
    latencyMs?: number
    version?: string
    error?: string
  }
  /** WebSocket status */
  websocket: {
    configured: boolean
    connected: boolean
    handshakeComplete: boolean
    error?: string
  }
  /** CLI/Local status (if applicable) */
  cli?: {
    detected: boolean
    running: boolean
    version?: string
    error?: string
  }
  /** Overall probe timestamp */
  probedAt: string
}

/**
 * P6.18: Full system readiness snapshot
 */
export interface SystemReadinessSnapshot {
  /** OpenClaw system probe */
  openclaw: OpenClawProbeResult
  /** All capability readiness states */
  capabilities: RealCapabilityReadiness[]
  /** Summary counts */
  summary: {
    total: number
    ready: number
    unavailable: number
    notConfigured: number
    degraded: number
    unknown: number  // P6.18D: Count of unverified capabilities
  }
  /** Snapshot timestamp */
  snapshotAt: string
}

// ============================================================================
// P6.18D: EXTENDED EVIDENCE TYPES FOR CLI/PLUGIN/TOOL PROBING
// ============================================================================

/**
 * P6.18D: Evidence source type - where the readiness info came from
 */
export type EvidenceSource =
  | 'openclaw_gateway'   // From gateway HTTP endpoints
  | 'openclaw_cli'       // From CLI commands
  | 'granclaw_adapter'   // From local GranClaw adapter
  | 'static_policy'      // From hardcoded policy (fallback)
  | 'probe_cache'        // From cached probe result
  | 'unknown'            // No evidence available

/**
 * P6.18D: CLI probe result
 */
export interface CLIProbeResult {
  /** Whether CLI binary was detected */
  detected: boolean
  /** Whether CLI is running/responding */
  running: boolean
  /** CLI version if detected */
  version?: string
  /** Command output summary (redacted) */
  outputSummary?: string
  /** Error message if failed */
  error?: string
  /** Which commands were tried */
  commandsTried?: string[]
  /** Probe timestamp */
  probedAt: string
}

/**
 * P6.18D: Plugin info from gateway/CLI
 */
export interface PluginInfo {
  /** Plugin identifier */
  id: string
  /** Plugin name */
  name: string
  /** Plugin version */
  version?: string
  /** Whether plugin is enabled */
  enabled: boolean
  /** Capabilities provided by this plugin */
  capabilities?: string[]
}

/**
 * P6.18D: Tool info from gateway/CLI
 */
export interface ToolInfo {
  /** Tool identifier */
  id: string
  /** Tool name */
  name: string
  /** Tool description */
  description?: string
  /** Whether tool is available for use */
  available: boolean
  /** Which capability this tool provides */
  capability?: string
}

/**
 * P6.18D: Security audit summary (read-only)
 */
export interface SecurityAuditSummary {
  /** Audit timestamp */
  auditedAt: string
  /** Audit status */
  status: 'passed' | 'warnings' | 'failed' | 'not_available'
  /** Number of warnings */
  warningCount?: number
  /** Summary message (no sensitive data) */
  message?: string
}

/**
 * P6.18D: Extended OpenClaw probe result with CLI/plugin/tool/security info
 */
export interface ExtendedOpenClawProbeResult extends OpenClawProbeResult {
  /** CLI probe result (if applicable) */
  cli?: CLIProbeResult
  /** Available plugins (if retrieved) */
  plugins?: {
    available: boolean
    list?: PluginInfo[]
    error?: string
    probedAt: string
  }
  /** Available tools (if retrieved) */
  tools?: {
    available: boolean
    list?: ToolInfo[]
    error?: string
    probedAt: string
  }
  /** Security audit summary (read-only) */
  security?: SecurityAuditSummary
}

/**
 * P6.18D: Extended capability readiness with all required fields
 */
export interface ExtendedCapabilityReadiness extends RealCapabilityReadiness {
  /** Normalized capability key */
  capabilityKey: string
  /** Category for grouping */
  category: 'core' | 'communication' | 'integration' | 'system' | 'external'
  /** Whether capability can be used right now */
  canUseNow: boolean
  /** Whether capability can be configured by user */
  canConfigure: boolean
  /** Whether capability requires explicit approval */
  requiresApproval: boolean
  /** Source of readiness information */
  source: EvidenceSource
  /** Multiple evidence items if available */
  evidenceList?: ProbeEvidence[]
  /** What's missing for this capability to work */
  missing?: string[]
  /** Next actions for user */
  nextActions?: RecoveryAction[]
  /** When last checked */
  lastCheckedAt: string
  /** Documentation URL if available */
  docsUrl?: string
  /** Required tool name for this capability (if any) */
  requiredTool?: string
  /** Required plugin for this capability (if any) */
  requiredPlugin?: string
}

/**
 * P6.18D: Capability gate check result
 */
export interface CapabilityGateCheckResult {
  /** Whether the capability can be used now */
  canProceed: boolean
  /** Readiness state */
  state: ReadinessState
  /** Source of this determination */
  source: EvidenceSource
  /** Human-readable message */
  message: string
  /** Blocking capabilities if any */
  blockingCapabilities?: ExtendedCapabilityReadiness[]
  /** Recovery actions */
  recoveryActions?: RecoveryAction[]
  /** When this check was performed */
  checkedAt: string
  /** Cache age in ms (0 if fresh probe) */
  cacheAgeMs: number
}
