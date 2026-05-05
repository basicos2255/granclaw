/**
 * Output Normalizer
 * FEATURE 110: Controlled OS Tools v1 - Part B
 *
 * Converts orchestrator responses to human-readable format.
 * Extracts the readable content from structured responses.
 */

/**
 * Types of normalized output
 */
export type NormalizedOutputType = 'text' | 'action' | 'document' | 'info' | 'error' | 'approval_needed'

/**
 * Normalized output structure for human display
 */
export interface NormalizedOutput {
  type: NormalizedOutputType
  title: string
  message: string
  details?: string
  /** Original response for debug/advanced view */
  raw?: unknown
}

/**
 * Result types from orchestrator
 */
interface OrchestratorResult {
  type?: string
  title?: string
  message?: string
  content?: string
  description?: string
  error?: string
  capabilityId?: string
  osToolKey?: string
  format?: string
  filePath?: string
  proposalId?: string
  toolName?: string
  riskLevel?: string
}

interface OrchestratorResponse {
  success: boolean
  mode?: string
  result?: OrchestratorResult
  response?: string
  message?: string
  error?: string
  meta?: Record<string, unknown>
}

/**
 * Normalize orchestrator response to human-readable format
 */
export function normalizeOutput(response: OrchestratorResponse): NormalizedOutput {
  // Handle errors
  if (!response.success && response.error) {
    return {
      type: 'error',
      title: 'Error',
      message: response.error,
      details: response.message,
      raw: response
    }
  }

  // Handle approval needed responses
  if (response.mode === 'approval_needed' || response.result?.type === 'approval_needed') {
    const result = response.result || {}
    return {
      type: 'approval_needed',
      title: result.title || 'Aprobación Requerida',
      message: result.message || `Se requiere aprobar la acción "${result.toolName || 'desconocida'}"`,
      details: result.riskLevel ? `Nivel de riesgo: ${result.riskLevel}` : undefined,
      raw: response
    }
  }

  // Handle capability execution results
  if (response.mode === 'capability' && response.result) {
    const result = response.result

    switch (result.type) {
      case 'action':
        return {
          type: 'action',
          title: result.title || 'Acción Ejecutada',
          message: result.message || 'La acción se ha ejecutado correctamente.',
          details: result.description,
          raw: response
        }

      case 'document':
        return {
          type: 'document',
          title: result.title || 'Documento',
          message: result.content || result.message || '',
          details: result.filePath ? `Archivo: ${result.filePath}` : undefined,
          raw: response
        }

      case 'info':
        return {
          type: 'info',
          title: result.title || 'Información',
          message: result.message || '',
          details: result.description,
          raw: response
        }

      case 'error':
        return {
          type: 'error',
          title: result.title || 'Error',
          message: result.message || 'Ha ocurrido un error.',
          raw: response
        }

      default:
        return {
          type: 'text',
          title: result.title || 'Resultado',
          message: result.message || JSON.stringify(result),
          raw: response
        }
    }
  }

  // Handle direct text responses (from OpenClaw)
  if (response.response) {
    return {
      type: 'text',
      title: 'Respuesta',
      message: response.response,
      raw: response
    }
  }

  // Handle simple messages
  if (response.message) {
    return {
      type: response.success ? 'info' : 'error',
      title: response.success ? 'Información' : 'Error',
      message: response.message,
      raw: response
    }
  }

  // Fallback
  return {
    type: 'text',
    title: 'Resultado',
    message: JSON.stringify(response, null, 2),
    raw: response
  }
}

/**
 * Extract plain text from normalized output
 */
export function extractPlainText(normalized: NormalizedOutput): string {
  let text = normalized.message

  if (normalized.details) {
    text += `\n\n${normalized.details}`
  }

  return text
}

/**
 * Check if response needs user approval action
 */
export function needsApproval(response: OrchestratorResponse): boolean {
  return response.mode === 'approval_needed' ||
    response.result?.type === 'approval_needed' ||
    (response.meta?.proposalId !== undefined && response.meta?.status === 'pending')
}

/**
 * Get approval info from response
 */
export function getApprovalInfo(response: OrchestratorResponse): {
  proposalId?: string
  toolName?: string
  riskLevel?: string
  capabilityKey?: string
} | null {
  if (!needsApproval(response)) {
    return null
  }

  const result = response.result || {}
  const meta = response.meta || {}

  return {
    proposalId: (meta.proposalId as string) || result.proposalId,
    toolName: result.toolName,
    riskLevel: result.riskLevel,
    capabilityKey: (meta.capabilityKey as string)
  }
}
