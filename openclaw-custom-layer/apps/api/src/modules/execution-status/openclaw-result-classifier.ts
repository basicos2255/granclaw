/**
 * OpenClaw Result Classifier
 * FIX 124.3: OpenClaw Negative Response Overrides Execution Success
 *
 * Analyzes OpenClaw response content to detect semantic failures
 * even when HTTP status is 200 and executionConfirmed is true.
 *
 * The text content of OpenClaw's response takes precedence over
 * wrapper success flags when determining actual execution status.
 */

/**
 * Classification result for OpenClaw response
 */
export interface OpenClawExecutionClassification {
  /** Whether execution ACTUALLY succeeded (content analysis) */
  executionActuallySucceeded: boolean
  /** Whether response indicates reauth is needed */
  requiresReauth: boolean
  /** Whether response indicates setup is needed */
  requiresSetup: boolean
  /** Whether execution failed */
  failed: boolean
  /** Human-readable reason */
  reason: string
  /** Evidence strings that triggered this classification */
  evidence: string[]
}

/**
 * Input for classification
 */
export interface ClassifierInput {
  /** Result object from OpenClaw */
  result?: unknown
  /** Raw response */
  raw?: unknown
  /** Error message if any */
  error?: string
  /** Response meta */
  meta?: unknown
  /** Provider (openclaw, tool, etc) */
  provider?: string
  /** Source (openclaw, mock, etc) */
  source?: string
  /** Debug snapshot */
  debugSnapshot?: unknown
  /** Execution trace */
  executionTrace?: unknown[]
}

/**
 * Patterns indicating the action could NOT be executed
 */
const FAILURE_PATTERNS: Array<{ pattern: RegExp; type: 'reauth' | 'setup' | 'failed'; priority: number }> = [
  // Spanish - couldn't open/execute
  { pattern: /no puedo abrir/i, type: 'reauth', priority: 10 },
  { pattern: /no he podido abrir/i, type: 'reauth', priority: 10 },
  { pattern: /no pude abrir/i, type: 'reauth', priority: 10 },
  { pattern: /no puedo ejecut/i, type: 'reauth', priority: 10 },
  { pattern: /no se pudo/i, type: 'failed', priority: 8 },
  { pattern: /no pude/i, type: 'failed', priority: 8 },
  { pattern: /no es posible/i, type: 'failed', priority: 7 },
  { pattern: /no fue posible/i, type: 'failed', priority: 7 },
  { pattern: /no logr[eéo]/i, type: 'failed', priority: 7 },

  // Spanish - permission/auth issues
  { pattern: /requiere permisos/i, type: 'reauth', priority: 10 },
  { pattern: /permisos adicionales/i, type: 'reauth', priority: 10 },
  { pattern: /pide reemparejar/i, type: 'reauth', priority: 10 },
  { pattern: /emparejar/i, type: 'setup', priority: 9 },
  { pattern: /reemparejar/i, type: 'reauth', priority: 10 },
  { pattern: /bloqueado por emparejamiento/i, type: 'setup', priority: 10 },
  { pattern: /necesita autorización/i, type: 'reauth', priority: 9 },
  { pattern: /sin autorización/i, type: 'reauth', priority: 9 },
  { pattern: /sin permisos/i, type: 'reauth', priority: 9 },
  { pattern: /falta de permisos/i, type: 'reauth', priority: 9 },

  // English - couldn't open/execute
  { pattern: /could not open/i, type: 'failed', priority: 8 },
  { pattern: /couldn't open/i, type: 'failed', priority: 8 },
  { pattern: /failed to open/i, type: 'failed', priority: 8 },
  { pattern: /unable to open/i, type: 'failed', priority: 8 },
  { pattern: /can'?t open/i, type: 'failed', priority: 8 },
  { pattern: /cannot open/i, type: 'failed', priority: 8 },

  // English - pairing/auth
  { pattern: /pairing required/i, type: 'setup', priority: 10 },
  { pattern: /authorization required/i, type: 'reauth', priority: 10 },
  { pattern: /reauthorization/i, type: 'reauth', priority: 10 },
  { pattern: /more scopes/i, type: 'reauth', priority: 10 },
  { pattern: /device is asking for more scopes/i, type: 'reauth', priority: 10 },
  { pattern: /permission denied/i, type: 'reauth', priority: 10 },
  { pattern: /not authorized/i, type: 'reauth', priority: 9 },
  { pattern: /access denied/i, type: 'reauth', priority: 9 },
  { pattern: /requires authorization/i, type: 'reauth', priority: 9 },
  { pattern: /insufficient permissions/i, type: 'reauth', priority: 9 },
  { pattern: /unauthorized/i, type: 'reauth', priority: 8 },

  // Node/device issues
  { pattern: /nodo.*pide/i, type: 'reauth', priority: 9 },
  { pattern: /device.*pairing/i, type: 'setup', priority: 9 },
  { pattern: /node.*requires/i, type: 'reauth', priority: 9 },
]

/**
 * Patterns indicating SUCCESS (but failure patterns take precedence)
 */
const SUCCESS_PATTERNS: RegExp[] = [
  /\babierto\b/i,
  /\bse abrió\b/i,
  /\blisto\b/i,
  /\bcompletado\b/i,
  /\bejecutado\b/i,
  /\bacción ejecutada\b/i,
  /\bopened\b/i,
  /\blaunched\b/i,
  /\bstarted\b/i,
  /\bexecuted\b/i,
  /\bcompleted\b/i,
]

/**
 * Extract text content from various response shapes
 */
function extractTextContent(obj: unknown, depth: number = 0, maxDepth: number = 5): string[] {
  const texts: string[] = []

  if (depth > maxDepth) return texts

  if (typeof obj === 'string') {
    texts.push(obj)
  } else if (Array.isArray(obj)) {
    for (const item of obj) {
      texts.push(...extractTextContent(item, depth + 1, maxDepth))
    }
  } else if (obj && typeof obj === 'object') {
    const record = obj as Record<string, unknown>

    // Priority fields for content
    const priorityKeys = ['content', 'message', 'text', 'response', 'error', 'reason', 'detail']
    for (const key of priorityKeys) {
      if (key in record && record[key]) {
        texts.push(...extractTextContent(record[key], depth + 1, maxDepth))
      }
    }

    // Check choices[].message.content (OpenAI-style)
    if ('choices' in record && Array.isArray(record.choices)) {
      for (const choice of record.choices as unknown[]) {
        if (choice && typeof choice === 'object' && 'message' in (choice as Record<string, unknown>)) {
          const msg = (choice as Record<string, unknown>).message
          if (msg && typeof msg === 'object' && 'content' in (msg as Record<string, unknown>)) {
            texts.push(...extractTextContent((msg as Record<string, unknown>).content, depth + 1, maxDepth))
          }
        }
      }
    }

    // Check result field
    if ('result' in record && record.result) {
      texts.push(...extractTextContent(record.result, depth + 1, maxDepth))
    }
  }

  return texts.filter(t => t && t.length > 0)
}

/**
 * Classify OpenClaw execution result by analyzing content
 */
export function classifyOpenClawExecutionResult(input: ClassifierInput): OpenClawExecutionClassification {
  // Only classify openclaw/tool responses
  if (input.provider !== 'openclaw' && input.source !== 'openclaw' && input.source !== 'tool') {
    return {
      executionActuallySucceeded: true, // Assume success for non-openclaw
      requiresReauth: false,
      requiresSetup: false,
      failed: false,
      reason: 'Not an OpenClaw response',
      evidence: []
    }
  }

  // Extract all text content from response
  const allTexts: string[] = []

  if (input.result) {
    allTexts.push(...extractTextContent(input.result))
  }
  if (input.raw) {
    allTexts.push(...extractTextContent(input.raw))
  }
  if (input.error) {
    allTexts.push(input.error)
  }
  if (input.meta) {
    allTexts.push(...extractTextContent(input.meta))
  }
  if (input.debugSnapshot) {
    allTexts.push(...extractTextContent(input.debugSnapshot))
  }
  if (input.executionTrace) {
    allTexts.push(...extractTextContent(input.executionTrace))
  }

  // Combine and limit search
  const combinedText = allTexts.join('\n').substring(0, 10000)

  // Check for failure patterns (highest priority)
  const failureMatches: Array<{ match: string; type: 'reauth' | 'setup' | 'failed'; priority: number }> = []

  for (const { pattern, type, priority } of FAILURE_PATTERNS) {
    const match = combinedText.match(pattern)
    if (match) {
      failureMatches.push({ match: match[0], type, priority })
    }
  }

  // If any failure patterns found, return failure classification
  if (failureMatches.length > 0) {
    // Sort by priority (highest first)
    failureMatches.sort((a, b) => b.priority - a.priority)
    const primary = failureMatches[0]
    const evidence = failureMatches.map(m => m.match)

    const hasReauth = failureMatches.some(m => m.type === 'reauth')
    const hasSetup = failureMatches.some(m => m.type === 'setup')

    console.log(`[OpenClaw Classifier] FAILURE detected: ${primary.type} - "${primary.match}"`)
    console.log(`[OpenClaw Classifier] Evidence: ${evidence.slice(0, 5).join(', ')}`)

    return {
      executionActuallySucceeded: false,
      requiresReauth: hasReauth,
      requiresSetup: hasSetup && !hasReauth,
      failed: !hasReauth && !hasSetup,
      reason: `OpenClaw response indicates failure: ${primary.match}`,
      evidence
    }
  }

  // Check for explicit success patterns
  let hasSuccessPattern = false
  const successEvidence: string[] = []

  for (const pattern of SUCCESS_PATTERNS) {
    const match = combinedText.match(pattern)
    if (match) {
      hasSuccessPattern = true
      successEvidence.push(match[0])
    }
  }

  if (hasSuccessPattern) {
    console.log(`[OpenClaw Classifier] SUCCESS detected: ${successEvidence.join(', ')}`)
    return {
      executionActuallySucceeded: true,
      requiresReauth: false,
      requiresSetup: false,
      failed: false,
      reason: `OpenClaw response indicates success: ${successEvidence[0]}`,
      evidence: successEvidence
    }
  }

  // No clear indication - assume success if no failure patterns
  console.log(`[OpenClaw Classifier] No clear patterns - assuming success`)
  return {
    executionActuallySucceeded: true,
    requiresReauth: false,
    requiresSetup: false,
    failed: false,
    reason: 'No failure patterns detected in response',
    evidence: []
  }
}
