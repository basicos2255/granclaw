/**
 * OS Tools Types
 * FEATURE 110: Controlled OS Tools v1
 */

/**
 * Supported capability keys for OS tools
 */
export type OSCapabilityKey =
  | 'open_calculator'
  | 'open_web_browser'
  | 'open_text_editor_os'
  | 'open_file_explorer'
  | 'open_terminal'

/**
 * Platform detection
 */
export type Platform = 'darwin' | 'win32' | 'linux'

/**
 * OS Tool execution modes
 * - strict: Requires user confirmation before execution
 * - passthrough: Executes directly without confirmation (for approved capabilities)
 */
export type OSToolMode = 'strict' | 'passthrough'

/**
 * Configuration for an OS tool
 */
export interface OSToolConfig {
  capabilityKey: OSCapabilityKey
  displayName: string
  description: string
  riskLevel: 'low' | 'medium' | 'high'
  requiresConfirmation: boolean
  platforms: {
    darwin?: OSToolCommand
    win32?: OSToolCommand
    linux?: OSToolCommand
  }
}

/**
 * Platform-specific command configuration
 */
export interface OSToolCommand {
  command: string
  args: string[]
  /** Optional: specific executable path */
  executablePath?: string
}

/**
 * Result of OS tool execution
 */
export interface OSExecutionResult {
  success: boolean
  capabilityKey: OSCapabilityKey
  platform: Platform
  command: string
  args: string[]
  exitCode?: number
  stdout?: string
  stderr?: string
  error?: string
  executedAt: string
  durationMs: number
}

/**
 * Pending OS tool confirmation request
 */
export interface OSToolPendingConfirmation {
  id: string
  tenantId: string
  sessionId: string
  capabilityKey: OSCapabilityKey
  displayName: string
  description: string
  platform: Platform
  command: string
  args: string[]
  riskLevel: 'low' | 'medium' | 'high'
  createdAt: string
  expiresAt: string
  status: 'pending' | 'confirmed' | 'rejected' | 'expired'
}

/**
 * Request body for confirming OS tool execution
 */
export interface OSToolConfirmRequest {
  confirmationId: string
  action: 'confirm' | 'reject'
}

/**
 * Response after confirming OS tool
 */
export interface OSToolConfirmResponse {
  success: boolean
  result?: OSExecutionResult
  error?: string
}
