/**
 * Frontend Output Normalizer
 * FIX 111: Complete OS Tools UI Confirmation & Human Output
 *
 * Converts orchestrator responses to human-readable format.
 * Hides raw JSON from users, shows only in advanced mode.
 */

/**
 * Normalized output type
 */
export type NormalizedOutputType =
  | 'text'
  | 'document'
  | 'action'
  | 'confirmation_required'
  | 'json'
  | 'empty'
  | 'unknown'

/**
 * Confirmation info for OS tools
 */
export interface OSToolConfirmation {
  confirmationId: string
  capabilityKey: string
  actionLabel: string
  riskLevel?: 'low' | 'medium' | 'high'
  message: string
}

/**
 * Normalized output for UI display
 */
export interface NormalizedOutput {
  type: NormalizedOutputType
  title?: string
  content: string
  raw: unknown
  isTechnicalRaw: boolean
  actionLabel?: string
  fileName?: string
  filePath?: string
  editable?: boolean
  confirmation?: OSToolConfirmation
}

/**
 * Check if value is a plain object
 */
function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

/**
 * Check if value is a chat completion response
 */
function isChatCompletion(val: unknown): val is { choices: Array<{ message: { content: string } }> } {
  if (!isPlainObject(val)) return false
  const choices = val.choices
  if (!Array.isArray(choices) || choices.length === 0) return false
  const first = choices[0]
  if (!isPlainObject(first)) return false
  const message = first.message
  if (!isPlainObject(message)) return false
  return typeof message.content === 'string'
}

/**
 * Check if value is a document output
 */
function isDocumentOutput(val: unknown): val is {
  type: 'document'
  title?: string
  content: string
  format?: string
  editable?: boolean
  filePath?: string
} {
  if (!isPlainObject(val)) return false
  return val.type === 'document' && typeof val.content === 'string'
}

/**
 * Check if value is an action output
 */
function isActionOutput(val: unknown): val is {
  type: 'action'
  title?: string
  message?: string
  description?: string
  osToolKey?: string
} {
  if (!isPlainObject(val)) return false
  return val.type === 'action'
}

/**
 * Check if value is a confirmation required output
 */
function isConfirmationRequired(val: unknown): val is {
  type: 'confirmation_required'
  confirmationId: string
  capabilityKey: string
  displayName: string
  description?: string
  riskLevel?: 'low' | 'medium' | 'high'
  message?: string
} {
  if (!isPlainObject(val)) return false
  return val.type === 'confirmation_required' && typeof val.confirmationId === 'string'
}

/**
 * Check if value is an info output
 */
function isInfoOutput(val: unknown): val is {
  type: 'info'
  title?: string
  message: string
  description?: string
} {
  if (!isPlainObject(val)) return false
  return val.type === 'info' && typeof val.message === 'string'
}

/**
 * Extract filename from path
 */
function extractFilename(filePath?: string): string | undefined {
  if (!filePath) return undefined
  const parts = filePath.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || undefined
}

/**
 * Normalize any orchestrator response to human-readable format
 */
export function normalizeOutput(response: unknown): NormalizedOutput {
  // Null/undefined
  if (response === null || response === undefined) {
    return {
      type: 'empty',
      content: 'No hay resultado.',
      raw: response,
      isTechnicalRaw: false
    }
  }

  // Simple string
  if (typeof response === 'string') {
    if (response.trim() === '') {
      return {
        type: 'empty',
        content: 'No hay resultado.',
        raw: response,
        isTechnicalRaw: false
      }
    }
    return {
      type: 'text',
      title: 'Respuesta',
      content: response,
      raw: response,
      isTechnicalRaw: false
    }
  }

  // Not an object
  if (!isPlainObject(response)) {
    return {
      type: 'unknown',
      content: 'Respuesta recibida.',
      raw: response,
      isTechnicalRaw: true
    }
  }

  // Chat completion (OpenAI format)
  if (isChatCompletion(response)) {
    const content = response.choices[0].message.content
    return {
      type: 'text',
      title: 'Respuesta',
      content,
      raw: response,
      isTechnicalRaw: true
    }
  }

  // Confirmation required
  if (isConfirmationRequired(response)) {
    return {
      type: 'confirmation_required',
      title: 'Confirmacion Requerida',
      content: response.message || `Se requiere confirmacion para ejecutar "${response.displayName}"`,
      raw: response,
      isTechnicalRaw: true,
      confirmation: {
        confirmationId: response.confirmationId,
        capabilityKey: response.capabilityKey,
        actionLabel: response.displayName,
        riskLevel: response.riskLevel,
        message: response.message || response.description || `Ejecutar ${response.displayName}`
      }
    }
  }

  // Document output
  if (isDocumentOutput(response)) {
    return {
      type: 'document',
      title: response.title || 'Documento generado',
      content: response.content,
      raw: response,
      isTechnicalRaw: true,
      fileName: extractFilename(response.filePath),
      filePath: response.filePath,
      editable: response.editable ?? false
    }
  }

  // Action output
  if (isActionOutput(response)) {
    const content = response.message || response.description || 'Accion ejecutada'
    return {
      type: 'action',
      title: response.title || 'Accion Ejecutada',
      content,
      raw: response,
      isTechnicalRaw: true,
      actionLabel: response.osToolKey || response.title
    }
  }

  // Info output
  if (isInfoOutput(response)) {
    let content = response.message
    if (response.description) {
      content += '\n\n' + response.description
    }
    return {
      type: 'text',
      title: response.title || 'Informacion',
      content,
      raw: response,
      isTechnicalRaw: true
    }
  }

  // Check for response field (common wrapper)
  if (typeof response.response === 'string') {
    return {
      type: 'text',
      title: 'Respuesta',
      content: response.response,
      raw: response,
      isTechnicalRaw: true
    }
  }

  // Check for message field
  if (typeof response.message === 'string' && response.message.trim()) {
    return {
      type: 'text',
      title: 'Mensaje',
      content: response.message,
      raw: response,
      isTechnicalRaw: true
    }
  }

  // Check for content field
  if (typeof response.content === 'string' && response.content.trim()) {
    return {
      type: 'text',
      title: 'Contenido',
      content: response.content,
      raw: response,
      isTechnicalRaw: true
    }
  }

  // Check for text field
  if (typeof response.text === 'string' && response.text.trim()) {
    return {
      type: 'text',
      title: 'Respuesta',
      content: response.text,
      raw: response,
      isTechnicalRaw: true
    }
  }

  // Check for result field (nested)
  if (isPlainObject(response.result)) {
    // Recurse into result
    const nested = normalizeOutput(response.result)
    // Preserve the full raw for debugging
    nested.raw = response
    return nested
  }

  // Unknown object - show as JSON
  return {
    type: 'json',
    title: 'Datos',
    content: 'La ejecucion devolvio datos tecnicos.',
    raw: response,
    isTechnicalRaw: true
  }
}

/**
 * Check if response needs OS confirmation
 */
export function needsOSConfirmation(response: unknown): boolean {
  if (!isPlainObject(response)) return false

  // Direct confirmation_required type
  if (response.type === 'confirmation_required') return true

  // Meta indicates pending confirmation
  if (isPlainObject(response.meta)) {
    if (response.meta.pendingConfirmation === true) return true
  }

  // Nested in result
  if (isPlainObject(response.result)) {
    if (response.result.type === 'confirmation_required') return true
  }

  return false
}

/**
 * Extract OS confirmation info from response
 */
export function extractOSConfirmation(response: unknown): OSToolConfirmation | null {
  if (!isPlainObject(response)) return null

  // Direct confirmation_required
  if (isConfirmationRequired(response)) {
    return {
      confirmationId: response.confirmationId,
      capabilityKey: response.capabilityKey,
      actionLabel: response.displayName,
      riskLevel: response.riskLevel,
      message: response.message || response.description || `Ejecutar ${response.displayName}`
    }
  }

  // Nested in result
  if (isPlainObject(response.result) && isConfirmationRequired(response.result)) {
    return {
      confirmationId: response.result.confirmationId,
      capabilityKey: response.result.capabilityKey,
      actionLabel: response.result.displayName,
      riskLevel: response.result.riskLevel,
      message: response.result.message || response.result.description || `Ejecutar ${response.result.displayName}`
    }
  }

  // From meta
  if (isPlainObject(response.meta) && response.meta.pendingConfirmation) {
    const meta = response.meta
    return {
      confirmationId: meta.confirmationId as string || '',
      capabilityKey: meta.capabilityKey as string || '',
      actionLabel: meta.displayName as string || 'Accion OS',
      riskLevel: meta.riskLevel as 'low' | 'medium' | 'high' | undefined,
      message: meta.message as string || 'Esta accion requiere confirmacion'
    }
  }

  return null
}
