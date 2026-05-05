/**
 * Capability Dispatcher
 * FIX 111: Complete OS Tools UI Confirmation
 *
 * Centralizes capability execution logic.
 * Decides whether to execute sandbox tools, OS tools, or return confirmation required.
 */

import type { ApprovedCapability } from './types'
import {
  isOSToolCapability,
  getOSToolConfig,
  executeOSTool,
  createPendingConfirmation,
  type OSCapabilityKey
} from '../os-tools'
import { sandbox } from '../../storage'

/**
 * Execution mode
 */
export type ExecutionMode = 'strict' | 'passthrough'

/**
 * Dispatcher context
 */
export interface DispatcherContext {
  tenantId: string
  userId?: string
  sessionId: string
  mode: ExecutionMode
  requestedAction: string
}

/**
 * Dispatch result
 */
export interface DispatchResult {
  success: boolean
  executed: boolean
  result?: unknown
  mode: string
  source: string
  confirmationRequired?: boolean
  confirmationId?: string
  error?: string
  meta?: {
    osExecution?: boolean
    confirmationRequired?: boolean
    confirmationReceived?: boolean
    capabilityKey?: string
    source?: string
    executionConfirmed?: boolean
  }
}

/**
 * Generate filename from action
 */
function generateFilenameFromAction(action: string): string {
  const patterns = [
    /archivo\s+(?:llamado\s+)?["']?([a-zA-Z0-9_\-\.]+)["']?/i,
    /documento\s+(?:llamado\s+)?["']?([a-zA-Z0-9_\-\.]+)["']?/i,
    /crear\s+["']?([a-zA-Z0-9_\-\.]+\.[a-z]+)["']?/i
  ]

  for (const pattern of patterns) {
    const match = action.match(pattern)
    if (match && match[1]) {
      let filename = match[1]
      if (!filename.includes('.')) {
        filename += '.txt'
      }
      return filename
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `documento_${timestamp}.txt`
}

/**
 * Validate URL for web browser
 */
function isValidBrowserUrl(url: string): { valid: boolean; error?: string; sanitized?: string } {
  // Default URL if none provided
  if (!url || url.trim() === '') {
    return { valid: true, sanitized: 'https://www.google.com' }
  }

  const trimmed = url.trim().toLowerCase()

  // Block dangerous protocols
  const blockedProtocols = ['javascript:', 'data:', 'file:', 'shell:', 'vbscript:']
  for (const protocol of blockedProtocols) {
    if (trimmed.startsWith(protocol)) {
      return { valid: false, error: `Protocolo no permitido: ${protocol}` }
    }
  }

  // Block local paths
  if (trimmed.match(/^[a-z]:\\/) || trimmed.startsWith('/') || trimmed.startsWith('\\\\')) {
    return { valid: false, error: 'Rutas locales no permitidas' }
  }

  // Ensure http/https
  let finalUrl = url.trim()
  if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
    finalUrl = 'https://' + finalUrl
  }

  return { valid: true, sanitized: finalUrl }
}

/**
 * Extract URL from action text
 */
function extractUrlFromAction(action: string): string | null {
  const urlPatterns = [
    /(?:abre|abrir|ir a|visita|navega a|open)\s+(?:la\s+)?(?:pagina|web|url)?\s*["']?(https?:\/\/[^\s"']+)["']?/i,
    /(?:abre|abrir|ir a|visita|navega a|open)\s+["']?((?:www\.)?[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}[^\s"']*)["']?/i,
    /(https?:\/\/[^\s"']+)/i
  ]

  for (const pattern of urlPatterns) {
    const match = action.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  // Check for "google" without full URL
  if (action.toLowerCase().includes('google')) {
    return 'https://www.google.com'
  }

  return null
}

/**
 * Execute sandbox capability
 */
function executeSandboxCapability(
  capability: ApprovedCapability,
  action: string
): DispatchResult {
  console.log(`[Dispatcher] Executing sandbox capability: ${capability.toolName}`)

  switch (capability.toolName) {
    case 'open_text_editor': {
      const filename = generateFilenameFromAction(action)
      const initialContent = `# Nuevo Documento\n\nCreado desde GranClaw\nAccion: ${action}\n`
      const result = sandbox.writeFile(filename, initialContent)

      if (!result.success) {
        return {
          success: false,
          executed: true,
          mode: 'capability',
          source: 'granclaw-sandbox',
          error: result.error || 'No se pudo crear el archivo'
        }
      }

      return {
        success: true,
        executed: true,
        result: {
          type: 'document',
          title: 'Editor de Texto',
          content: result.data,
          format: 'markdown',
          editable: true,
          capabilityId: capability.id,
          filePath: result.filePath
        },
        mode: 'capability',
        source: 'granclaw-sandbox',
        meta: {
          executionConfirmed: true,
          capabilityKey: capability.capabilityKey,
          source: 'granclaw-sandbox'
        }
      }
    }

    case 'write_local_file': {
      const filename = generateFilenameFromAction(action)
      let content = ''
      const contentMatch = action.match(/contenido[:\s]+["']?(.+?)["']?$/i)
      if (contentMatch) {
        content = contentMatch[1]
      } else {
        content = `Archivo creado desde GranClaw\nAccion: ${action}\n`
      }

      const result = sandbox.writeFile(filename, content)

      if (!result.success) {
        return {
          success: false,
          executed: true,
          mode: 'capability',
          source: 'granclaw-sandbox',
          error: result.error || 'No se pudo escribir el archivo'
        }
      }

      return {
        success: true,
        executed: true,
        result: {
          type: 'document',
          title: 'Archivo Creado',
          content: result.data,
          format: 'text',
          editable: true,
          capabilityId: capability.id,
          filePath: result.filePath
        },
        mode: 'capability',
        source: 'granclaw-sandbox',
        meta: {
          executionConfirmed: true,
          capabilityKey: capability.capabilityKey,
          source: 'granclaw-sandbox'
        }
      }
    }

    case 'read_local_file': {
      const filename = generateFilenameFromAction(action)
      const result = sandbox.readFile(filename)

      if (!result.success) {
        const listResult = sandbox.listFiles()
        const availableFiles = listResult.success && listResult.files
          ? listResult.files.map(f => f.name).join(', ')
          : 'ninguno'

        return {
          success: true,
          executed: true,
          result: {
            type: 'info',
            title: 'Archivo no encontrado',
            message: `No se encontro el archivo "${filename}" en el sandbox.`,
            description: `Archivos disponibles: ${availableFiles}`,
            capabilityId: capability.id
          },
          mode: 'capability',
          source: 'granclaw-sandbox',
          meta: {
            executionConfirmed: true,
            capabilityKey: capability.capabilityKey,
            source: 'granclaw-sandbox'
          }
        }
      }

      return {
        success: true,
        executed: true,
        result: {
          type: 'document',
          title: `Contenido: ${result.filePath}`,
          content: result.data,
          format: 'text',
          editable: false,
          capabilityId: capability.id,
          filePath: result.filePath
        },
        mode: 'capability',
        source: 'granclaw-sandbox',
        meta: {
          executionConfirmed: true,
          capabilityKey: capability.capabilityKey,
          source: 'granclaw-sandbox'
        }
      }
    }

    default:
      return {
        success: true,
        executed: true,
        result: {
          type: 'info',
          title: capability.toolName,
          message: `Capacidad "${capability.toolName}" aprobada.`,
          description: capability.description,
          capabilityId: capability.id
        },
        mode: 'capability',
        source: 'granclaw-sandbox',
        meta: {
          executionConfirmed: true,
          capabilityKey: capability.capabilityKey,
          source: 'granclaw-sandbox'
        }
      }
  }
}

/**
 * Execute OS tool or return confirmation required
 */
async function executeOsCapability(
  capability: ApprovedCapability,
  context: DispatcherContext
): Promise<DispatchResult> {
  const capKey = capability.capabilityKey || capability.toolName
  console.log(`[Dispatcher] Processing OS capability: ${capKey}`)

  // Validate it's a known OS tool
  if (!isOSToolCapability(capKey)) {
    return {
      success: false,
      executed: false,
      mode: 'capability',
      source: 'granclaw-os-tool',
      error: `OS tool desconocida: ${capKey}`
    }
  }

  const osConfig = getOSToolConfig(capKey)
  if (!osConfig) {
    return {
      success: false,
      executed: false,
      mode: 'capability',
      source: 'granclaw-os-tool',
      error: `Configuracion no encontrada: ${capKey}`
    }
  }

  // Special handling for web browser - validate URL
  if (capKey === 'open_web_browser') {
    const extractedUrl = extractUrlFromAction(context.requestedAction)
    const urlValidation = isValidBrowserUrl(extractedUrl || '')

    if (!urlValidation.valid) {
      return {
        success: false,
        executed: false,
        mode: 'capability',
        source: 'granclaw-os-tool',
        error: urlValidation.error || 'URL no valida',
        meta: {
          osExecution: false,
          capabilityKey: capKey,
          source: 'granclaw-os-tool'
        }
      }
    }

    // URL is stored in context for when execution happens
    // For now we just validate it
  }

  // Check if confirmation is required
  const requiresConfirmation = osConfig.requiresConfirmation ||
    context.mode === 'strict' ||
    osConfig.riskLevel === 'high' ||
    osConfig.riskLevel === 'medium'

  if (requiresConfirmation) {
    // Create pending confirmation
    const confirmation = createPendingConfirmation(
      context.tenantId,
      context.sessionId,
      capKey as OSCapabilityKey
    )

    if (!confirmation) {
      return {
        success: false,
        executed: false,
        mode: 'capability',
        source: 'granclaw-os-tool',
        error: 'No se pudo crear confirmacion pendiente'
      }
    }

    console.log(`[Dispatcher] Confirmation required for ${capKey}: ${confirmation.id}`)

    return {
      success: true,
      executed: false,
      confirmationRequired: true,
      confirmationId: confirmation.id,
      result: {
        type: 'confirmation_required',
        confirmationId: confirmation.id,
        capabilityKey: capKey,
        displayName: osConfig.displayName,
        description: osConfig.description,
        riskLevel: osConfig.riskLevel,
        message: `Se requiere confirmacion para ejecutar "${osConfig.displayName}"`
      },
      mode: 'capability',
      source: 'granclaw-os-tool',
      meta: {
        osExecution: true,
        confirmationRequired: true,
        confirmationReceived: false,
        capabilityKey: capKey,
        source: 'granclaw-os-tool',
        executionConfirmed: false
      }
    }
  }

  // Direct execution (passthrough mode with low risk)
  console.log(`[Dispatcher] Direct execution of ${capKey}`)
  const execResult = await executeOSTool(capKey as OSCapabilityKey)

  if (execResult.success) {
    return {
      success: true,
      executed: true,
      result: {
        type: 'action',
        title: osConfig.displayName,
        message: `${osConfig.displayName} se ha abierto correctamente`,
        description: osConfig.description,
        capabilityId: capability.id,
        osToolKey: capKey
      },
      mode: 'capability',
      source: 'granclaw-os-tool',
      meta: {
        osExecution: true,
        confirmationRequired: false,
        confirmationReceived: false,
        capabilityKey: capKey,
        source: 'granclaw-os-tool',
        executionConfirmed: true
      }
    }
  }

  return {
    success: false,
    executed: true,
    mode: 'capability',
    source: 'granclaw-os-tool',
    error: execResult.error || 'Error al ejecutar OS tool',
    meta: {
      osExecution: true,
      capabilityKey: capKey,
      source: 'granclaw-os-tool',
      executionConfirmed: false
    }
  }
}

/**
 * Dispatch capability execution
 */
export async function dispatchCapabilityExecution(
  capability: ApprovedCapability,
  context: DispatcherContext
): Promise<DispatchResult> {
  const capKey = capability.capabilityKey || capability.toolName

  console.log(`[Dispatcher] Dispatching ${capKey} in ${context.mode} mode`)

  // Check if this is an OS tool
  if (isOSToolCapability(capKey)) {
    return executeOsCapability(capability, context)
  }

  // Otherwise execute as sandbox capability
  return executeSandboxCapability(capability, context.requestedAction)
}

/**
 * Check if capability requires OS access
 */
export function isOsCapability(capabilityKey: string): boolean {
  return isOSToolCapability(capabilityKey)
}
