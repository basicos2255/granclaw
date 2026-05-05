/**
 * Reauthorization Detector
 * FIX 122: OpenClaw Reauthorization Handling
 * FIX 123: OpenClaw Persistent Setup & Pairing Flow
 * FIX 123.1: OpenClaw Setup Hardening & Scoped Reauthorization
 *
 * Detects when OpenClaw responses indicate permission/authorization errors
 * that require the user to reauthorize the device or request more scopes.
 *
 * FIX 123.1: Now creates granular setup requirements by scope/capability.
 */

import {
  addSetupRequirement,
  storePendingAction,
  recordSuccessfulExecution,
  shouldBlockExecution,
  getActiveRequirements,
  type PendingAction,
  type OpenClawScopeKey,
  type OpenClawSetupRequirement
} from '../system-state'

/**
 * Patterns that indicate reauthorization is required
 */
const REAUTH_PATTERNS = [
  /pairing required/i,
  /authorization required/i,
  /more scopes/i,
  /device is asking for more scopes/i,
  /reauthorize/i,
  /permission denied/i,
  /not authorized/i,
  /requires authorization/i,
  /access denied/i,
  /insufficient permissions/i,
  /token expired/i,
  /session expired/i,
  /auth.*required/i,
  /need.*permission/i,
  /grant.*access/i,
  /oauth.*error/i,
  /scope.*required/i,
  /unauthorized/i,
]

/**
 * Result of reauth detection
 */
export interface ReauthDetectionResult {
  /** Whether reauth is required */
  requiresReauth: boolean
  /** The pattern that matched */
  matchedPattern?: string
  /** Source of the match (message, error, trace, etc.) */
  matchSource?: 'message' | 'error' | 'trace' | 'result' | 'debugSnapshot'
  /** Original matched text */
  matchedText?: string
  /** FIX 123.1: Detected scope key */
  scopeKey?: OpenClawScopeKey
  /** FIX 123.1: Setup requirement created */
  setupRequirement?: OpenClawSetupRequirement
}

/**
 * FIX 123.1: Capability to scope mapping
 */
const CAPABILITY_SCOPE_MAP: Record<string, OpenClawScopeKey> = {
  // OS open app scopes
  'open_calculator': 'os:open_app',
  'open_web_browser': 'os:open_app',
  'open_local_application': 'os:open_app',
  'open_file_explorer': 'os:open_app',
  'open_text_editor': 'os:open_app',
  'open_terminal': 'os:open_app',
  'open_vscode': 'os:open_app',
  'launch_app': 'os:open_app',
  // Install scopes
  'install_application': 'os:install',
  'install_download_action': 'os:install',
  'download_file': 'os:install',
  // Filesystem scopes
  'read_file': 'os:filesystem',
  'write_file': 'os:filesystem',
  'create_directory': 'os:filesystem',
  'delete_file': 'os:filesystem',
  'list_directory': 'os:filesystem',
  // Browser scopes
  'browse_url': 'os:browser',
  'open_url': 'os:browser',
  'web_search': 'os:browser',
  // System scopes
  'run_command': 'os:system',
  'execute_script': 'os:system',
  'system_settings': 'os:system'
}

/**
 * FIX 123.1: Detect scope from error text
 */
function detectScopeFromError(errorText: string): OpenClawScopeKey {
  const lower = errorText.toLowerCase()

  if (lower.includes('open') || lower.includes('launch') || lower.includes('application')) {
    return 'os:open_app'
  }
  if (lower.includes('install') || lower.includes('download')) {
    return 'os:install'
  }
  if (lower.includes('file') || lower.includes('directory') || lower.includes('folder')) {
    return 'os:filesystem'
  }
  if (lower.includes('browser') || lower.includes('url') || lower.includes('web')) {
    return 'os:browser'
  }
  if (lower.includes('command') || lower.includes('script') || lower.includes('system')) {
    return 'os:system'
  }

  return 'openclaw:unknown_scope'
}

/**
 * FIX 123.1: Get scope from capabilityKey
 */
export function getScopeFromCapability(capabilityKey?: string): OpenClawScopeKey {
  if (!capabilityKey) return 'openclaw:unknown_scope'
  return CAPABILITY_SCOPE_MAP[capabilityKey] || 'openclaw:unknown_scope'
}

/**
 * Check if a string contains reauth patterns
 */
function checkForReauthPatterns(text: string): { matched: boolean; pattern?: string; matchedText?: string } {
  if (!text || typeof text !== 'string') {
    return { matched: false }
  }

  for (const pattern of REAUTH_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      return {
        matched: true,
        pattern: pattern.source,
        matchedText: match[0]
      }
    }
  }

  return { matched: false }
}

/**
 * Recursively search an object for reauth patterns
 */
function searchObjectForReauth(obj: unknown, depth: number = 0): { matched: boolean; pattern?: string; matchedText?: string; path?: string } {
  // Limit depth to prevent infinite recursion
  if (depth > 5) {
    return { matched: false }
  }

  if (typeof obj === 'string') {
    return checkForReauthPatterns(obj)
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const result = searchObjectForReauth(obj[i], depth + 1)
      if (result.matched) {
        return { ...result, path: `[${i}]${result.path ? '.' + result.path : ''}` }
      }
    }
    return { matched: false }
  }

  if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      const result = searchObjectForReauth(value, depth + 1)
      if (result.matched) {
        return { ...result, path: `${key}${result.path ? '.' + result.path : ''}` }
      }
    }
    return { matched: false }
  }

  return { matched: false }
}

/**
 * Detect if an OpenClaw response indicates reauthorization is required
 */
export function detectReauthRequired(response: {
  success?: boolean
  error?: string
  message?: string
  result?: unknown
  response?: string
  meta?: {
    debugSnapshot?: unknown
    executionTrace?: unknown[]
  }
}): ReauthDetectionResult {
  // Check error field
  if (response.error) {
    const result = checkForReauthPatterns(response.error)
    if (result.matched) {
      console.log(`[Reauth Detector] Found in error: "${result.matchedText}" (pattern: ${result.pattern})`)
      return {
        requiresReauth: true,
        matchedPattern: result.pattern,
        matchSource: 'error',
        matchedText: result.matchedText
      }
    }
  }

  // Check message field
  if (response.message) {
    const result = checkForReauthPatterns(response.message)
    if (result.matched) {
      console.log(`[Reauth Detector] Found in message: "${result.matchedText}" (pattern: ${result.pattern})`)
      return {
        requiresReauth: true,
        matchedPattern: result.pattern,
        matchSource: 'message',
        matchedText: result.matchedText
      }
    }
  }

  // Check response field (direct text response)
  if (response.response) {
    const result = checkForReauthPatterns(response.response)
    if (result.matched) {
      console.log(`[Reauth Detector] Found in response: "${result.matchedText}" (pattern: ${result.pattern})`)
      return {
        requiresReauth: true,
        matchedPattern: result.pattern,
        matchSource: 'message',
        matchedText: result.matchedText
      }
    }
  }

  // Check result object recursively
  if (response.result) {
    const result = searchObjectForReauth(response.result)
    if (result.matched) {
      console.log(`[Reauth Detector] Found in result.${result.path}: "${result.matchedText}"`)
      return {
        requiresReauth: true,
        matchedPattern: result.pattern,
        matchSource: 'result',
        matchedText: result.matchedText
      }
    }
  }

  // Check execution trace
  if (response.meta?.executionTrace && Array.isArray(response.meta.executionTrace)) {
    for (const step of response.meta.executionTrace) {
      const result = searchObjectForReauth(step)
      if (result.matched) {
        console.log(`[Reauth Detector] Found in executionTrace: "${result.matchedText}"`)
        return {
          requiresReauth: true,
          matchedPattern: result.pattern,
          matchSource: 'trace',
          matchedText: result.matchedText
        }
      }
    }
  }

  // Check debug snapshot
  if (response.meta?.debugSnapshot) {
    const result = searchObjectForReauth(response.meta.debugSnapshot)
    if (result.matched) {
      console.log(`[Reauth Detector] Found in debugSnapshot.${result.path}: "${result.matchedText}"`)
      return {
        requiresReauth: true,
        matchedPattern: result.pattern,
        matchSource: 'debugSnapshot',
        matchedText: result.matchedText
      }
    }
  }

  return { requiresReauth: false }
}

/**
 * FIX 123.1: Detect reauth AND update system state with granular scope
 */
export function detectAndMarkReauthRequired(
  response: Parameters<typeof detectReauthRequired>[0],
  pendingAction?: Omit<PendingAction, 'timestamp' | 'scopeKey'>
): ReauthDetectionResult {
  const result = detectReauthRequired(response)

  if (result.requiresReauth) {
    // Determine scope from capabilityKey or error text
    let scopeKey: OpenClawScopeKey = 'openclaw:unknown_scope'

    if (pendingAction?.capabilityKey) {
      scopeKey = getScopeFromCapability(pendingAction.capabilityKey)
    }

    // If still unknown, try to detect from error text
    if (scopeKey === 'openclaw:unknown_scope' && result.matchedText) {
      scopeKey = detectScopeFromError(result.matchedText)
    }

    result.scopeKey = scopeKey

    // Create granular setup requirement
    const requirement = addSetupRequirement({
      scopeKey,
      capabilityKey: pendingAction?.capabilityKey,
      reason: result.matchedText || 'Authorization required',
      originalError: result.matchedText
    })

    result.setupRequirement = requirement

    // Store pending action if provided
    if (pendingAction) {
      storePendingAction({
        ...pendingAction,
        scopeKey,
        timestamp: Date.now()
      })
    }

    console.log(`[Reauth Detector] Created requirement: scope=${scopeKey} capability=${pendingAction?.capabilityKey}`)
  }

  return result
}

/**
 * FIX 123.1: Check if setup is required for specific scope/capability
 * Returns true ONLY if there's an active requirement that affects this action
 */
export function shouldBlockForSetup(context?: {
  scopeKey?: OpenClawScopeKey
  capabilityKey?: string
  isSimpleQuery?: boolean
}): boolean {
  // Never block simple queries
  if (context?.isSimpleQuery) {
    return false
  }

  const { blocked, requirement } = shouldBlockExecution({
    scopeKey: context?.scopeKey,
    capabilityKey: context?.capabilityKey
  })

  if (blocked && requirement) {
    console.log(`[Reauth Detector] Blocked by requirement: ${requirement.scopeKey} (${requirement.id})`)
  }

  return blocked
}

/**
 * FIX 123.1: Get current setup requirement if blocking
 */
export function getBlockingRequirement(context?: {
  scopeKey?: OpenClawScopeKey
  capabilityKey?: string
}): OpenClawSetupRequirement | undefined {
  const { requirement } = shouldBlockExecution({
    scopeKey: context?.scopeKey,
    capabilityKey: context?.capabilityKey
  })
  return requirement
}

/**
 * FIX 123.1: Record successful execution (resolves specific scope/capability)
 */
export function recordOpenClawSuccess(context?: {
  scopeKey?: OpenClawScopeKey
  capabilityKey?: string
}): void {
  recordSuccessfulExecution({
    scopeKey: context?.scopeKey,
    capabilityKey: context?.capabilityKey
  })
}

/**
 * FIX 123.1: Create setup required response with scope info
 */
export function createSetupRequiredResponse(
  requestId: string,
  taskId: string,
  context?: {
    pendingInput?: string
    scopeKey?: OpenClawScopeKey
    capabilityKey?: string
    requirement?: OpenClawSetupRequirement
  }
): {
  success: boolean
  executionStatus: 'setup_required'
  error: string
  message: string
  setupInfo: {
    scopeKey?: OpenClawScopeKey
    capabilityKey?: string
    requirementId?: string
    reason?: string
  }
  meta: {
    requestId: string
    taskId: string
    source: string
    hasPendingAction: boolean
  }
} {
  const requirement = context?.requirement || getBlockingRequirement({
    scopeKey: context?.scopeKey,
    capabilityKey: context?.capabilityKey
  })

  return {
    success: false,
    executionStatus: 'setup_required',
    error: 'OpenClaw requiere configuración',
    message: requirement
      ? `OpenClaw necesita autorización para: ${requirement.reason}`
      : 'OpenClaw necesita permisos adicionales para funcionar correctamente.',
    setupInfo: {
      scopeKey: requirement?.scopeKey || context?.scopeKey,
      capabilityKey: requirement?.capabilityKey || context?.capabilityKey,
      requirementId: requirement?.id,
      reason: requirement?.reason
    },
    meta: {
      requestId,
      taskId,
      source: 'setup-required',
      hasPendingAction: !!context?.pendingInput
    }
  }
}

/**
 * Create a standardized reauth required response
 */
export function createReauthRequiredResponse(
  originalResponse: unknown,
  detection: ReauthDetectionResult,
  requestId: string,
  taskId: string
): {
  success: boolean
  executionStatus: 'reauthorization_required'
  error: string
  message: string
  reauthInfo: {
    matchedPattern: string | undefined
    matchSource: string | undefined
    matchedText: string | undefined
  }
  meta: {
    requestId: string
    taskId: string
    source: string
    originalResponse: unknown
  }
} {
  return {
    success: false,
    executionStatus: 'reauthorization_required',
    error: 'OpenClaw requiere reautorización',
    message: 'El dispositivo o la acción solicitada requiere permisos adicionales. Por favor, reautoriza en OpenClaw.',
    reauthInfo: {
      matchedPattern: detection.matchedPattern,
      matchSource: detection.matchSource,
      matchedText: detection.matchedText
    },
    meta: {
      requestId,
      taskId,
      source: 'openclaw-reauth',
      originalResponse
    }
  }
}
