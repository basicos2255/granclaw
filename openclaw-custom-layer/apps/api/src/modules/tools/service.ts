/**
 * Tools Service
 * Ejecución de tools y tools básicas
 */

import type { Tool, ToolExecutionResult, ToolExecutionContext } from './types'
import { registerTool, getTool, listTools, getTools } from './registry'

/**
 * URLs bloqueadas por seguridad
 * Incluye hosts internos, redes privadas y direcciones especiales
 */
const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  // Redes privadas clase A
  '10.',
  // Redes privadas clase B (172.16.0.0 - 172.31.255.255)
  '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.',
  '172.24.', '172.25.', '172.26.', '172.27.',
  '172.28.', '172.29.', '172.30.', '172.31.',
  // Redes privadas clase C
  '192.168.',
  // Link-local
  '169.254.',
  // IPv6 privadas
  'fc00:', 'fd00:',  // Unique local
  'fe80:',           // Link-local
  '::ffff:127.',     // IPv4-mapped loopback
  '::ffff:10.',      // IPv4-mapped private A
  '::ffff:192.168.', // IPv4-mapped private C
  '::ffff:169.254.'  // IPv4-mapped link-local
]

/**
 * Sufijos de dominio bloqueados
 */
const BLOCKED_SUFFIXES = ['.local', '.internal', '.localhost', '.lan', '.home', '.corp']

/**
 * Timeout para HTTP requests (ms)
 */
const HTTP_TIMEOUT = 10000

/**
 * Echo Tool
 * Devuelve el input recibido
 */
const echoTool: Tool = {
  id: 'echo',
  name: 'Echo',
  description: 'Returns the input as-is',
  execute: async (input: unknown): Promise<unknown> => {
    return {
      echo: input,
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * Time Tool
 * Devuelve el timestamp actual
 */
const timeTool: Tool = {
  id: 'time',
  name: 'Time',
  description: 'Returns the current timestamp',
  execute: async (): Promise<unknown> => {
    const now = new Date()
    return {
      timestamp: now.toISOString(),
      unix: now.getTime(),
      formatted: now.toLocaleString()
    }
  }
}

/**
 * Input para HTTP Tool
 */
interface HttpToolInput {
  url: string
  method?: 'GET' | 'POST'
  body?: unknown
}

/**
 * Valida que la URL no sea interna
 */
function isBlockedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()

    // Verificar hosts exactos o que empiecen con IPs privadas
    const isBlockedHost = BLOCKED_HOSTS.some(host =>
      hostname === host || hostname.startsWith(host)
    )
    if (isBlockedHost) return true

    // Verificar sufijos de dominio bloqueados
    const isBlockedSuffix = BLOCKED_SUFFIXES.some(suffix =>
      hostname.endsWith(suffix)
    )
    if (isBlockedSuffix) return true

    return false
  } catch {
    return true // URL inválida = bloqueada
  }
}

/**
 * HTTP Tool
 * Ejecuta HTTP requests a URLs externas
 */
const httpTool: Tool = {
  id: 'http',
  name: 'HTTP Request',
  description: 'Executes HTTP requests to external URLs',
  execute: async (input: unknown, _context?: ToolExecutionContext): Promise<unknown> => {
    // Validar input
    if (!input || typeof input !== 'object') {
      throw new Error('Invalid input: expected object with url')
    }

    const httpInput = input as HttpToolInput

    if (!httpInput.url || typeof httpInput.url !== 'string') {
      throw new Error('Invalid input: url is required')
    }

    // Seguridad: bloquear URLs internas
    if (isBlockedUrl(httpInput.url)) {
      throw new Error('Blocked: internal URLs not allowed')
    }

    const method = httpInput.method || 'GET'
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), HTTP_TIMEOUT)

    try {
      const options: RequestInit = {
        method,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json'
        }
      }

      if (method === 'POST' && httpInput.body) {
        options.body = JSON.stringify(httpInput.body)
      }

      const response = await fetch(httpInput.url, options)
      clearTimeout(timeoutId)

      let data: unknown
      const contentType = response.headers.get('content-type') || ''

      if (contentType.includes('application/json')) {
        data = await response.json()
      } else {
        data = await response.text()
      }

      return {
        status: response.status,
        ok: response.ok,
        data
      }
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`HTTP request timeout (${HTTP_TIMEOUT}ms)`)
      }
      throw err
    }
  }
}

/**
 * Registrar tools básicas
 */
export function initializeBuiltinTools(): void {
  registerTool(echoTool)
  registerTool(timeTool)
  registerTool(httpTool)
}

/**
 * Ejecutar una tool con contexto opcional
 */
export async function executeTool(
  toolId: string,
  input: unknown,
  context?: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const tool = getTool(toolId)

  if (!tool) {
    return {
      success: false,
      toolId,
      result: null,
      error: `Tool "${toolId}" not found`
    }
  }

  try {
    const result = await tool.execute(input, context)
    return {
      success: true,
      toolId,
      result
    }
  } catch (err) {
    return {
      success: false,
      toolId,
      result: null,
      error: err instanceof Error ? err.message : 'Unknown error'
    }
  }
}

/**
 * Detectar tool a usar basado en mensaje
 * Detección simple por keywords
 */
export function detectToolFromMessage(message: string, availableToolIds: string[]): string | null {
  const lowerMessage = message.toLowerCase()

  // Verificar cada tool disponible
  for (const toolId of availableToolIds) {
    if (toolId === 'time' && lowerMessage.includes('time')) {
      return 'time'
    }
    if (toolId === 'echo' && lowerMessage.includes('echo')) {
      return 'echo'
    }
    if (toolId === 'http' && (lowerMessage.includes('http') || lowerMessage.includes('fetch') || lowerMessage.includes('api'))) {
      return 'http'
    }
  }

  return null
}

/**
 * Parsear input de HTTP desde mensaje
 */
function parseHttpInputFromMessage(message: string): HttpToolInput | null {
  // Buscar URL en el mensaje
  const urlMatch = message.match(/https?:\/\/[^\s]+/)
  if (!urlMatch) {
    return null
  }

  const url = urlMatch[0]
  const method = message.toLowerCase().includes('post') ? 'POST' : 'GET'

  return { url, method }
}

/**
 * Ejecutar tool si detectada
 */
export async function executeToolIfDetected(
  message: string,
  availableToolIds: string[],
  context?: ToolExecutionContext
): Promise<ToolExecutionResult | null> {
  const toolId = detectToolFromMessage(message, availableToolIds)

  if (!toolId) {
    return null
  }

  // Construir input según la tool
  let input: unknown

  if (toolId === 'echo') {
    input = message
  } else if (toolId === 'http') {
    input = parseHttpInputFromMessage(message)
    if (!input) {
      return {
        success: false,
        toolId,
        result: null,
        error: 'No valid URL found in message'
      }
    }
  }

  return executeTool(toolId, input, context)
}

// Re-exportar funciones del registry
export { getTool, listTools, getTools }
