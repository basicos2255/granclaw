/**
 * Task Result Formatter
 * P6.3: Operational UX, Result Visibility & Real Task Outcomes
 * P6.18D6: Simple task output visibility - ChatCompletionResponse support
 *
 * Transforms raw execution results into structured TaskResult.
 */

import type {
  TaskResult,
  TaskOutput,
  TaskArtifact,
  CreateTaskResultInput
} from './types'

/**
 * Extract summary from raw result
 * P6.17R5: Added capabilityGate handling for blocked tasks
 */
function extractSummary(rawResult: unknown, status: string, provider?: string): string {
  if (!rawResult) {
    if (status === 'success') return 'Tarea completada exitosamente'
    if (status === 'error') return 'La tarea fallo'
    if (status === 'blocked') return 'Tarea bloqueada'
    return 'Estado desconocido'
  }

  // Check if result has message field
  if (typeof rawResult === 'object' && rawResult !== null) {
    const obj = rawResult as Record<string, unknown>

    // P6.17R5: Capability gate blocked - generate semantic summary
    if (obj.capabilityGate === true) {
      const blockingCaps = obj.blockingCapabilities as Array<{ capability?: string; capabilityKey?: string }> | undefined
      if (blockingCaps && blockingCaps.length > 0) {
        const capNames = blockingCaps.map(c => c.capability || c.capabilityKey).filter(Boolean).join(', ')
        return `Bloqueado: capacidades no disponibles (${capNames})`
      }
      return 'Bloqueado por capability gate'
    }

    // P6.18D6: OpenClaw ChatCompletionResponse format
    // Structure: { choices: [{ message: { role: 'assistant', content: 'response' } }] }
    if (Array.isArray(obj.choices) && obj.choices.length > 0) {
      const firstChoice = obj.choices[0] as Record<string, unknown> | undefined
      if (firstChoice && typeof firstChoice === 'object') {
        const msg = firstChoice.message as Record<string, unknown> | undefined
        if (msg && typeof msg.content === 'string') {
          const content = msg.content
          // Truncate long responses
          return content.length > 300 ? content.substring(0, 297) + '...' : content
        }
      }
    }

    // Direct message
    if (typeof obj.message === 'string') {
      return obj.message
    }

    // Result object with message
    if (typeof obj.result === 'object' && obj.result !== null) {
      const result = obj.result as Record<string, unknown>
      if (typeof result.message === 'string') {
        return result.message
      }
    }

    // Summary field
    if (typeof obj.summary === 'string') {
      return obj.summary
    }

    // OpenClaw response
    if (typeof obj.response === 'string') {
      const response = obj.response
      // Truncate long responses
      return response.length > 200 ? response.substring(0, 197) + '...' : response
    }

    // Steps from task memory
    if (Array.isArray(obj.steps) && obj.fromPattern) {
      return `Ejecutado usando patron aprendido (${obj.steps.length} pasos)`
    }

    // Error
    if (typeof obj.error === 'string') {
      return `Error: ${obj.error}`
    }
  }

  // String result
  if (typeof rawResult === 'string') {
    return rawResult.length > 200 ? rawResult.substring(0, 197) + '...' : rawResult
  }

  // P6.17R5: For blocked status, don't say "Ejecutado via"
  if (status === 'blocked') {
    return 'Tarea bloqueada'
  }

  // Default based on provider
  if (provider) {
    return `Ejecutado via ${provider}`
  }

  return status === 'success' ? 'Tarea completada' : 'Tarea finalizada'
}

/**
 * Extract structured outputs from raw result
 */
function extractOutputs(rawResult: unknown): TaskOutput[] {
  const outputs: TaskOutput[] = []

  if (!rawResult || typeof rawResult !== 'object') {
    if (typeof rawResult === 'string' && rawResult.length > 0) {
      outputs.push({ type: 'text', value: rawResult })
    }
    return outputs
  }

  const obj = rawResult as Record<string, unknown>

  // P6.18D6: OpenClaw ChatCompletionResponse format
  if (Array.isArray(obj.choices) && obj.choices.length > 0) {
    const firstChoice = obj.choices[0] as Record<string, unknown> | undefined
    if (firstChoice && typeof firstChoice === 'object') {
      const msg = firstChoice.message as Record<string, unknown> | undefined
      if (msg && typeof msg.content === 'string') {
        outputs.push({
          type: 'text',
          label: 'Respuesta',
          value: msg.content
        })
      }
    }
  }

  // Response text
  if (typeof obj.response === 'string') {
    outputs.push({
      type: 'text',
      label: 'Respuesta',
      value: obj.response
    })
  }

  // Result object
  if (obj.result && typeof obj.result === 'object') {
    const result = obj.result as Record<string, unknown>

    // Links array
    if (Array.isArray(result.links)) {
      result.links.forEach((link: unknown, idx: number) => {
        if (typeof link === 'string') {
          outputs.push({
            type: 'link',
            label: `Enlace ${idx + 1}`,
            value: link
          })
        } else if (typeof link === 'object' && link !== null) {
          const linkObj = link as Record<string, unknown>
          outputs.push({
            type: 'link',
            label: (linkObj.title as string) || `Enlace ${idx + 1}`,
            value: linkObj.url || linkObj.href || link
          })
        }
      })
    }

    // Table/list data
    if (Array.isArray(result.data) || Array.isArray(result.items) || Array.isArray(result.results)) {
      const items = (result.data || result.items || result.results) as unknown[]
      if (items && items.length > 0) {
        outputs.push({
          type: 'table',
          label: 'Resultados',
          value: items
        })
      }
    }

    // Time data (common for time queries)
    if (result.time || result.datetime || result.currentTime) {
      outputs.push({
        type: 'text',
        label: 'Hora',
        value: result.time || result.datetime || result.currentTime
      })
    }

    // Generic message in result
    if (typeof result.message === 'string' && !outputs.some(o => o.value === result.message)) {
      outputs.push({
        type: 'text',
        label: 'Resultado',
        value: result.message
      })
    }
  }

  // Steps from task memory
  if (Array.isArray(obj.steps)) {
    outputs.push({
      type: 'list',
      label: 'Pasos ejecutados',
      value: obj.steps
    })
  }

  // Warning
  if (typeof obj.warning === 'string') {
    outputs.push({
      type: 'warning',
      label: 'Advertencia',
      value: obj.warning
    })
  }

  // Error details
  if (typeof obj.error === 'string') {
    outputs.push({
      type: 'warning',
      label: 'Error',
      value: obj.error
    })
  }

  // If no outputs extracted but we have an object, show as JSON
  if (outputs.length === 0 && Object.keys(obj).length > 0) {
    // Filter out meta/internal fields
    const displayFields = Object.entries(obj).filter(
      ([key]) => !['meta', 'requestId', 'taskId', 'trace', 'debug', 'success'].includes(key)
    )
    if (displayFields.length > 0) {
      outputs.push({
        type: 'json',
        label: 'Datos',
        value: Object.fromEntries(displayFields)
      })
    }
  }

  return outputs
}

/**
 * Extract artifacts from raw result
 */
function extractArtifacts(rawResult: unknown): TaskArtifact[] {
  const artifacts: TaskArtifact[] = []

  if (!rawResult || typeof rawResult !== 'object') {
    return artifacts
  }

  const obj = rawResult as Record<string, unknown>

  // Direct artifacts array
  if (Array.isArray(obj.artifacts)) {
    obj.artifacts.forEach((artifact: unknown) => {
      if (typeof artifact === 'object' && artifact !== null) {
        const a = artifact as Record<string, unknown>
        artifacts.push({
          type: (a.type as TaskArtifact['type']) || 'file',
          name: (a.name as string) || 'artifact',
          path: a.path as string | undefined,
          url: a.url as string | undefined,
          metadata: a.metadata as Record<string, unknown> | undefined
        })
      }
    })
  }

  // Files array
  if (Array.isArray(obj.files)) {
    obj.files.forEach((file: unknown) => {
      if (typeof file === 'string') {
        artifacts.push({
          type: 'file',
          name: file.split('/').pop() || file,
          path: file
        })
      } else if (typeof file === 'object' && file !== null) {
        const f = file as Record<string, unknown>
        artifacts.push({
          type: 'file',
          name: (f.name as string) || 'file',
          path: (f.path as string) || undefined,
          url: (f.url as string) || undefined
        })
      }
    })
  }

  // Screenshot
  if (obj.screenshot) {
    artifacts.push({
      type: 'screenshot',
      name: 'screenshot.png',
      path: typeof obj.screenshot === 'string' ? obj.screenshot : undefined,
      url: typeof obj.screenshot === 'object' ? ((obj.screenshot as Record<string, unknown>).url as string) : undefined
    })
  }

  // Download URL
  if (typeof obj.downloadUrl === 'string') {
    artifacts.push({
      type: 'download',
      name: 'download',
      url: obj.downloadUrl
    })
  }

  return artifacts
}

/**
 * Format raw result into structured TaskResult
 */
export function formatTaskResult(input: CreateTaskResultInput): TaskResult {
  const now = new Date().toISOString()

  const summary = extractSummary(input.rawResult, input.status, input.provider)
  const outputs = extractOutputs(input.rawResult)
  const artifacts = extractArtifacts(input.rawResult)

  // Extract details from raw result
  let details: string | undefined
  if (input.rawResult && typeof input.rawResult === 'object') {
    const obj = input.rawResult as Record<string, unknown>
    if (typeof obj.reason === 'string') {
      details = obj.reason
    } else if (typeof obj.details === 'string') {
      details = obj.details
    }
  }

  return {
    taskId: input.taskId,
    workflowId: input.workflowId,
    status: input.status,
    summary,
    details,
    outputs,
    artifacts,
    provider: input.provider,
    executionMode: input.executionMode,
    durationMs: input.durationMs,
    completedAt: now,
    rawResult: input.rawResult,
    createdAt: now
  }
}

/**
 * Generate error result
 */
export function formatErrorResult(
  taskId: string,
  error: string,
  provider?: string,
  durationMs?: number
): TaskResult {
  return {
    taskId,
    status: 'error',
    summary: `Error: ${error}`,
    details: error,
    outputs: [
      {
        type: 'warning',
        label: 'Error',
        value: error
      }
    ],
    artifacts: [],
    provider,
    durationMs,
    createdAt: new Date().toISOString()
  }
}
