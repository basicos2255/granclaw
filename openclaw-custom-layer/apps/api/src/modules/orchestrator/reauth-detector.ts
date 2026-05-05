/**
 * Reauthorization Detector
 * FIX 122: OpenClaw Reauthorization Handling
 *
 * Detects when OpenClaw responses indicate permission/authorization errors
 * that require the user to reauthorize the device or request more scopes.
 */

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
