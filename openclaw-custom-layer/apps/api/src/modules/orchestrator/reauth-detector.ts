/**
 * Reauthorization Detector
 * FIX 122: OpenClaw Reauthorization Handling
 * FIX 123: OpenClaw Persistent Setup & Pairing Flow
 * FIX 123.1: OpenClaw Setup Hardening & Scoped Reauthorization
 * FIX 124.2: Consistent Setup Blocking & Requirement Synchronization
 *
 * Detects when OpenClaw responses indicate permission/authorization errors
 * that require the user to reauthorize the device or request more scopes.
 *
 * FIX 123.1: Now creates granular setup requirements by scope/capability.
 * FIX 124.2: Normalizes scope resolution and prevents inconsistent blocking.
 */

import {
  addSetupRequirement,
  storePendingAction,
  recordSuccessfulExecution,
  shouldBlockExecution,
  getActiveRequirements,
  reloadState,
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
 * FIX 124.2: Intent kind to scope mapping
 */
const INTENT_SCOPE_MAP: Record<string, OpenClawScopeKey> = {
  'os_action': 'os:open_app',
  'file_operation': 'os:filesystem',
  'web_navigation': 'os:browser',
  'app_install': 'os:install',
  'system_command': 'os:system'
}

/**
 * FIX 124.2: Message patterns to scope mapping
 * Used when capabilityKey is not available but message indicates OS action
 */
const MESSAGE_SCOPE_PATTERNS: Array<{ pattern: RegExp; scope: OpenClawScopeKey }> = [
  // Open app patterns - most common
  { pattern: /\b(abre|abrir|open|launch|ejecuta|ejecutar|inicia|iniciar|run)\b.*\b(app|aplicación|application|programa|program|vscode|code|visual studio|calculator|calculadora|notepad|chrome|firefox|edge|terminal|cmd|powershell|excel|word|slack|discord|spotify|teams|outlook|photoshop|illustrator)\b/i, scope: 'os:open_app' },
  { pattern: /\b(abre|abrir|open|launch|ejecuta|ejecutar)\b\s+(?:la\s+)?(?:aplicación|app)\b/i, scope: 'os:open_app' },
  { pattern: /\b(vscode|visual studio code|code)\b/i, scope: 'os:open_app' },
  { pattern: /\b(calculadora|calculator)\b/i, scope: 'os:open_app' },
  // Install patterns
  { pattern: /\b(instala|instalar|install|download|descarga|descargar)\b/i, scope: 'os:install' },
  // File patterns
  { pattern: /\b(archivo|file|carpeta|folder|directorio|directory|documento|document)\b.*\b(crear|create|leer|read|escribir|write|borrar|delete|eliminar|mover|move|copiar|copy)\b/i, scope: 'os:filesystem' },
  { pattern: /\b(crear|create|leer|read|escribir|write|borrar|delete|eliminar|mover|move|copiar|copy)\b.*\b(archivo|file|carpeta|folder)\b/i, scope: 'os:filesystem' },
  // Browser patterns
  { pattern: /\b(navega|navigate|browse|visita|visit|ir a|go to)\b.*\b(url|página|page|sitio|site|web)\b/i, scope: 'os:browser' },
  { pattern: /\b(busca|search|google)\b.*\b(en (?:la )?web|online|internet)\b/i, scope: 'os:browser' },
  // System patterns
  { pattern: /\b(ejecuta|execute|run|correr)\b.*\b(comando|command|script|terminal|shell|cmd|powershell)\b/i, scope: 'os:system' }
]

/**
 * FIX 124.2: Resolve execution scope from multiple sources
 *
 * This function provides CONSISTENT scope resolution for:
 * - "abre vscode"
 * - "abre la aplicación vscode"
 * - "abre Visual Studio Code"
 *
 * All should return the same scope: os:open_app
 */
export interface ScopeResolution {
  scopeKey: OpenClawScopeKey
  capabilityKey?: string
  reason: string
  source: 'capability' | 'intent' | 'message' | 'error' | 'default'
}

export function resolveExecutionScope(params: {
  intent?: { kind: string }
  capabilityKey?: string
  provider?: string
  message?: string
  errorText?: string
}): ScopeResolution {
  // Priority 1: capabilityKey (most specific)
  if (params.capabilityKey) {
    const scope = getScopeFromCapability(params.capabilityKey)
    if (scope !== 'openclaw:unknown_scope') {
      return {
        scopeKey: scope,
        capabilityKey: params.capabilityKey,
        reason: `Scope from capability: ${params.capabilityKey}`,
        source: 'capability'
      }
    }
  }

  // Priority 2: Intent kind
  if (params.intent?.kind && params.intent.kind in INTENT_SCOPE_MAP) {
    const scope = INTENT_SCOPE_MAP[params.intent.kind]
    return {
      scopeKey: scope,
      capabilityKey: params.capabilityKey,
      reason: `Scope from intent: ${params.intent.kind}`,
      source: 'intent'
    }
  }

  // Priority 3: Message patterns (for consistent resolution)
  if (params.message) {
    for (const { pattern, scope } of MESSAGE_SCOPE_PATTERNS) {
      if (pattern.test(params.message)) {
        return {
          scopeKey: scope,
          capabilityKey: params.capabilityKey,
          reason: `Scope from message pattern: ${pattern.source.substring(0, 30)}...`,
          source: 'message'
        }
      }
    }
  }

  // Priority 4: Error text (for reauth cases)
  if (params.errorText) {
    const scope = detectScopeFromError(params.errorText)
    if (scope !== 'openclaw:unknown_scope') {
      return {
        scopeKey: scope,
        capabilityKey: params.capabilityKey,
        reason: `Scope from error: ${params.errorText.substring(0, 30)}...`,
        source: 'error'
      }
    }
  }

  // Default: unknown scope
  return {
    scopeKey: 'openclaw:unknown_scope',
    capabilityKey: params.capabilityKey,
    reason: 'Could not determine specific scope',
    source: 'default'
  }
}

/**
 * FIX 124.2: Check setup block BEFORE execution
 *
 * This function:
 * 1. Reloads systemState from disk (ensures fresh data)
 * 2. Resolves execution scope consistently
 * 3. Checks for active requirement that applies
 * 4. Returns block decision with details
 */
export interface SetupBlockResult {
  blocked: boolean
  requirement?: OpenClawSetupRequirement
  scopeKey: OpenClawScopeKey
  reason: string
  source: 'capability' | 'intent' | 'message' | 'error' | 'default'
}

export function checkSetupBlockBeforeExecution(params: {
  tenantId: string
  userId?: string
  intent?: { kind: string }
  capabilityKey?: string
  provider?: string
  message?: string
  isSimpleQuery?: boolean
}): SetupBlockResult {
  // Never block simple queries
  if (params.isSimpleQuery) {
    return {
      blocked: false,
      scopeKey: 'openclaw:unknown_scope',
      reason: 'Simple query - not blocked',
      source: 'default'
    }
  }

  // FIX 124.2: Force reload state from disk to ensure fresh data
  reloadState()

  // Resolve scope consistently
  const resolution = resolveExecutionScope({
    intent: params.intent,
    capabilityKey: params.capabilityKey,
    provider: params.provider,
    message: params.message
  })

  console.log(`[Setup Block Check] tenantId=${params.tenantId} scope=${resolution.scopeKey} source=${resolution.source}`)
  console.log(`[Setup Block Check] reason="${resolution.reason}"`)

  // Check for blocking requirement
  const { blocked, requirement } = shouldBlockExecution({
    scopeKey: resolution.scopeKey,
    capabilityKey: params.capabilityKey
  })

  if (blocked && requirement) {
    console.log(`[Setup Block Check] BLOCKED by requirement: ${requirement.id} scope=${requirement.scopeKey}`)
    return {
      blocked: true,
      requirement,
      scopeKey: resolution.scopeKey,
      reason: requirement.reason || 'Setup required',
      source: resolution.source
    }
  }

  // Also check for matching scope even if capabilityKey differs
  // This handles cases like "open_local_application" vs message saying "abre vscode"
  if (!blocked && resolution.scopeKey !== 'openclaw:unknown_scope') {
    const activeReqs = getActiveRequirements()
    const matchingReq = activeReqs.find(r =>
      r.status === 'active' && r.scopeKey === resolution.scopeKey
    )
    if (matchingReq) {
      console.log(`[Setup Block Check] BLOCKED by scope match: ${matchingReq.id} scope=${matchingReq.scopeKey}`)
      return {
        blocked: true,
        requirement: matchingReq,
        scopeKey: resolution.scopeKey,
        reason: matchingReq.reason || 'Setup required for scope',
        source: resolution.source
      }
    }
  }

  console.log(`[Setup Block Check] NOT BLOCKED - no active requirement for scope=${resolution.scopeKey}`)
  return {
    blocked: false,
    scopeKey: resolution.scopeKey,
    reason: 'No active setup requirement',
    source: resolution.source
  }
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
