/**
 * Orchestrator service - Primera capa de orquestación
 * Ejecuta tareas via RPC/REST (OpenClaw) o mock
 * Soporta configuración dinámica via agents, presets y sessions
 */

import type { RunTaskInput, RunTaskResult, StreamTaskInput, StreamTaskResult } from './types'
// P6.9: Import intent classifier for multistep guard
import { classifyIntent, classifyExecutionMode } from '../execution-policy'
import { getAgentById, getAgentByIdForTenant } from '../agents/service'
import type { ToolsConfig, ToolMode } from '../agents/types'
import { getPresetById, getPresetByIdForTenant } from '../presets/service'
import { getSession, getSessionForTenant, addMessage, getSessionMessages } from '../sessions/service'
import { executeToolIfDetected, initializeBuiltinTools, executeTool } from '../tools'
import type { ToolExecutionContext } from '../tools'
import { OpenClawWsClient, OpenClawChatRpc, OpenClawRestClient } from '@granclaw/openclaw-adapter'
import { OpenClawRuntimeAdapter } from '@granclaw/openclaw-adapter'

// Inicializar tools al cargar el módulo
initializeBuiltinTools()

/**
 * Obtiene configuración de OpenClaw
 */
function getOpenClawConfig() {
  return {
    baseUrl: process.env.OPENCLAW_BASE_URL || null,
    apiKey: process.env.OPENCLAW_API_KEY || null
  }
}

/**
 * Configuración del agent
 */
interface AgentConfig {
  systemPrompt?: string
  agentId?: string
  presetId?: string
  tools?: string[]
  toolsConfig?: ToolsConfig
  error?: string
}

/**
 * Singleton runtime adapter para OpenClaw tools
 */
let runtimeAdapter: OpenClawRuntimeAdapter | null = null

type ToolsHttpAwareRuntimeAdapter = OpenClawRuntimeAdapter & {
  isToolsHttpConfigured?: () => boolean
}

/**
 * Obtiene o crea runtime adapter para OpenClaw
 */
function getOpenClawRuntimeAdapter(): OpenClawRuntimeAdapter | null {
  const baseUrl = process.env.OPENCLAW_BASE_URL
  const wsUrl = process.env.OPENCLAW_WS_URL
  if (!baseUrl && !wsUrl) {
    return null
  }

  if (!runtimeAdapter) {
    runtimeAdapter = new OpenClawRuntimeAdapter({
      baseUrl: baseUrl || '',
      wsUrl,
      apiKey: process.env.OPENCLAW_API_KEY
    })
  }

  return runtimeAdapter
}

function isToolsHttpConfigured(adapter: OpenClawRuntimeAdapter | null): boolean {
  return (adapter as ToolsHttpAwareRuntimeAdapter | null)?.isToolsHttpConfigured?.() ?? false
}

/**
 * Obtiene el modo de ejecución de una tool
 */
function getToolMode(toolId: string, toolsConfig?: ToolsConfig): ToolMode {
  if (!toolsConfig || !toolsConfig[toolId]) {
    return 'internal' // Default: internal
  }
  return toolsConfig[toolId].mode
}

/**
 * Verifica si OpenClaw tools está disponible
 */
export function isOpenClawToolsAvailable(): boolean {
  const adapter = getOpenClawRuntimeAdapter()
  return isToolsHttpConfigured(adapter) || adapter?.isToolsRpcReady() || false
}

/**
 * Obtiene estado de OpenClaw tools
 */
export function getOpenClawToolsStatus(): {
  wsConnected: boolean
  rpcReady: boolean
  toolsMode: 'internal' | 'hybrid'
} {
  const adapter = getOpenClawRuntimeAdapter()
  const wsConnected = adapter?.isWsConnected() ?? false
  const rpcReady = adapter?.isToolsRpcReady() ?? false
  const httpReady = isToolsHttpConfigured(adapter)

  return {
    wsConnected,
    rpcReady,
    toolsMode: httpReady || rpcReady ? 'hybrid' : 'internal'
  }
}

/**
 * FEATURE 074: Obtiene estado del adaptador para diagnostico
 */
export function getAdapterStatus(): {
  openclawConfigured: boolean
  restConfigured: boolean
  wsConfigured: boolean
} {
  const config = getOpenClawConfig()
  return {
    openclawConfigured: !!config.baseUrl || !!process.env.OPENCLAW_WS_URL,
    restConfigured: !!config.baseUrl,
    wsConfigured: !!process.env.OPENCLAW_WS_URL
  }
}

/**
 * Ejecuta tool con modo híbrido (internal o OpenClaw según config)
 */
import { detectToolFromMessage } from '../tools'

async function executeToolWithHybridMode(
  message: string,
  availableToolIds: string[],
  toolsConfig: ToolsConfig | undefined,
  context: ToolExecutionContext
): Promise<{ success: boolean; toolId: string; result: unknown; error?: string } | null> {
  // Detectar qué tool usar
  const toolId = detectToolFromMessage(message, availableToolIds)
  if (!toolId) {
    return null
  }

  // Determinar modo de ejecución
  const mode = getToolMode(toolId, toolsConfig)

  if (mode === 'openclaw') {
    // Intentar ejecutar via OpenClaw
    const adapter = getOpenClawRuntimeAdapter()

    if (adapter && isOpenClawToolsAvailable()) {
      // Construir params según la tool
      const params = buildToolParams(message, toolId)

      const openclawResult = await adapter.executeToolViaOpenClaw(toolId, params)

      if (openclawResult.success) {
        return {
          success: true,
          toolId,
          result: openclawResult.result
        }
      }

      // Si falla OpenClaw, fallback a internal
      console.warn(`OpenClaw tool execution failed for ${toolId}, falling back to internal: ${openclawResult.error}`)
    }
  }

  // Modo internal o fallback
  return executeToolIfDetected(message, availableToolIds, context)
}

/**
 * Construye params para tool según el mensaje
 * Nota: toolId NO debe incluirse aquí - ya viene en la llamada
 */
function buildToolParams(message: string, _toolId: string): Record<string, unknown> {
  // Por ahora, pasamos el mensaje como param genérico
  // TODO: Parsear params específicos según cada tool
  return {
    message
  }
}

/**
 * Obtiene configuración del agent si existe
 * Si tenantId proporcionado, valida que agent/preset pertenezcan al tenant
 */
function getAgentConfig(agentId?: string, tenantId?: string): AgentConfig {
  if (!agentId) {
    return {}
  }

  // Si hay tenantId, usar funciones tenant-aware
  const agent = tenantId ? getAgentByIdForTenant(agentId, tenantId) : getAgentById(agentId)
  if (!agent) {
    return { error: `Agent with id "${agentId}" not found` }
  }

  if (!agent.active) {
    return { error: `Agent "${agent.name}" is not active` }
  }

  const preset = tenantId ? getPresetByIdForTenant(agent.presetId, tenantId) : getPresetById(agent.presetId)
  if (!preset) {
    return { error: `Preset with id "${agent.presetId}" not found for agent "${agent.name}"` }
  }

  if (!preset.enabled) {
    return { error: `Preset "${preset.name}" is not enabled` }
  }

  return {
    systemPrompt: preset.systemPrompt,
    agentId: agent.id,
    presetId: preset.id,
    tools: agent.tools || [],
    toolsConfig: agent.toolsConfig
  }
}

/**
 * Ejecuta tarea simple via REST adapter
 * Fallback a mock si no configurado
 * Soporta sessions para contexto conversacional
 */
export async function runSimpleAgentTask(input: RunTaskInput): Promise<RunTaskResult> {
  // Validación
  if (!input.message || typeof input.message !== 'string') {
    return {
      success: false,
      result: null,
      source: 'mock',
      error: 'Invalid input: message is required'
    }
  }

  if (input.message.trim().length === 0) {
    return {
      success: false,
      result: null,
      source: 'mock',
      error: 'Invalid input: message cannot be empty'
    }
  }

  // P6.9: Guard against multistep tasks - these MUST use queue system
  // This is a safety net in case routing enforcement is bypassed
  const intent = classifyIntent(input.message)
  const executionMode = classifyExecutionMode(intent)

  if (executionMode.useQueue) {
    console.log(`[runSimpleAgentTask P6.9] GUARD TRIGGERED: Multistep task blocked`)
    console.log(`[runSimpleAgentTask P6.9] Intent: ${intent.kind}, Mode: ${executionMode.mode}`)
    return {
      success: false,
      result: {
        executionMode: executionMode.mode,
        intentKind: intent.kind,
        isMultiStep: intent.isMultiStep,
        requiresEvidence: executionMode.requiresEvidence,
        reason: executionMode.reason
      },
      source: 'guard',
      error: 'Multistep tasks must use queue/workflow system. This task requires queued execution with progress tracking.'
    }
  }

  // Validar session si se proporciona
  if (input.sessionId) {
    // Si hay tenantId, usar validación tenant-aware
    const session = input.tenantId
      ? getSessionForTenant(input.sessionId, input.tenantId)
      : getSession(input.sessionId)

    if (!session) {
      return {
        success: false,
        result: null,
        source: 'mock',
        error: `Session with id "${input.sessionId}" not found`
      }
    }

    // Añadir mensaje del usuario a la sesión
    addMessage(input.sessionId, { role: 'user', content: input.message })
  }

  // Obtener configuración de agent/preset si existe (tenant-aware si tenantId proporcionado)
  const agentConfig = getAgentConfig(input.agentId, input.tenantId)
  if (agentConfig.error) {
    return {
      success: false,
      result: null,
      source: 'mock',
      error: agentConfig.error
    }
  }

  // Si el agent tiene tools, intentar ejecutar una
  if (agentConfig.tools && agentConfig.tools.length > 0) {
    // Construir contexto de ejecución
    const toolContext: ToolExecutionContext = {
      tenantId: input.tenantId,
      sessionId: input.sessionId
    }

    // Intentar detectar y ejecutar tool con modo híbrido
    const toolResult = await executeToolWithHybridMode(
      input.message,
      agentConfig.tools,
      agentConfig.toolsConfig,
      toolContext
    )

    if (toolResult) {
      const result: RunTaskResult = {
        success: toolResult.success,
        result: toolResult.result,
        source: 'tool',
        agentId: agentConfig.agentId,
        presetId: agentConfig.presetId,
        toolId: toolResult.toolId,
        error: toolResult.error
      }

      // Si hay session y éxito, añadir respuesta
      if (input.sessionId && result.success) {
        const responseContent = JSON.stringify(toolResult.result)
        addMessage(input.sessionId, { role: 'assistant', content: responseContent })
        result.sessionId = input.sessionId
      }

      return result
    }
  }

  const config = getOpenClawConfig()

  let result: RunTaskResult

  // Sin configuración → mock
  if (!config.baseUrl) {
    result = runMockTask(input, agentConfig.systemPrompt, agentConfig.agentId, agentConfig.presetId)
  } else {
    // Con configuración → intentar REST
    result = await runOpenClawTask(input, agentConfig.systemPrompt, agentConfig.agentId, agentConfig.presetId)
  }

  // Si hay session y la ejecución fue exitosa, añadir respuesta
  if (input.sessionId && result.success) {
    const responseContent = extractResponseContent(result.result)
    if (responseContent) {
      addMessage(input.sessionId, { role: 'assistant', content: responseContent })
    }
    result.sessionId = input.sessionId
  }

  return result
}

/**
 * P6.9R: Execute provider task WITHOUT the multistep guard.
 * This is for INTERNAL USE by queue executors, composite executors, and DAG executors.
 *
 * IMPORTANT: Do NOT call this from entry points (routes, handlers).
 * Entry points should use runSimpleAgentTask() which has the guard.
 *
 * This function executes a single step/node via OpenClaw without re-classifying intent.
 */
export async function executeProviderTask(input: RunTaskInput): Promise<RunTaskResult> {
  // Validación básica
  if (!input.message || typeof input.message !== 'string') {
    return {
      success: false,
      result: null,
      source: 'mock',
      error: 'Invalid input: message is required'
    }
  }

  if (input.message.trim().length === 0) {
    return {
      success: false,
      result: null,
      source: 'mock',
      error: 'Invalid input: message cannot be empty'
    }
  }

  // NO GUARD HERE - This is intentional for internal executor use
  // The guard is applied at entry points (runSimpleAgentTask)

  // Validar session si se proporciona
  if (input.sessionId) {
    const session = input.tenantId
      ? getSessionForTenant(input.sessionId, input.tenantId)
      : getSession(input.sessionId)

    if (!session) {
      return {
        success: false,
        result: null,
        source: 'mock',
        error: `Session with id "${input.sessionId}" not found`
      }
    }

    addMessage(input.sessionId, { role: 'user', content: input.message })
  }

  // Obtener configuración de agent/preset
  const agentConfig = getAgentConfig(input.agentId, input.tenantId)
  if (agentConfig.error) {
    return {
      success: false,
      result: null,
      source: 'mock',
      error: agentConfig.error
    }
  }

  // Si el agent tiene tools, intentar ejecutar una
  if (agentConfig.tools && agentConfig.tools.length > 0) {
    const toolContext: ToolExecutionContext = {
      tenantId: input.tenantId,
      sessionId: input.sessionId
    }

    const toolResult = await executeToolWithHybridMode(
      input.message,
      agentConfig.tools,
      agentConfig.toolsConfig,
      toolContext
    )

    if (toolResult) {
      const result: RunTaskResult = {
        success: toolResult.success,
        result: toolResult.result,
        source: 'tool',
        agentId: agentConfig.agentId,
        presetId: agentConfig.presetId,
        toolId: toolResult.toolId,
        error: toolResult.error
      }

      if (input.sessionId && result.success) {
        const responseContent = JSON.stringify(toolResult.result)
        addMessage(input.sessionId, { role: 'assistant', content: responseContent })
        result.sessionId = input.sessionId
      }

      return result
    }
  }

  const config = getOpenClawConfig()

  let result: RunTaskResult

  if (!config.baseUrl) {
    result = runMockTask(input, agentConfig.systemPrompt, agentConfig.agentId, agentConfig.presetId)
  } else {
    result = await runOpenClawTask(input, agentConfig.systemPrompt, agentConfig.agentId, agentConfig.presetId)
  }

  if (input.sessionId && result.success) {
    const responseContent = extractResponseContent(result.result)
    if (responseContent) {
      addMessage(input.sessionId, { role: 'assistant', content: responseContent })
    }
    result.sessionId = input.sessionId
  }

  return result
}

/**
 * Extrae el contenido de respuesta del resultado
 */
function extractResponseContent(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null

  const r = result as Record<string, unknown>

  // Mock response
  if (typeof r.response === 'string') {
    return r.response
  }

  // OpenAI-style response
  if (Array.isArray(r.choices) && r.choices.length > 0) {
    const choice = r.choices[0] as Record<string, unknown>
    if (choice.message && typeof choice.message === 'object') {
      const msg = choice.message as Record<string, unknown>
      if (typeof msg.content === 'string') {
        return msg.content
      }
    }
  }

  return null
}

/**
 * Ejecuta tarea mock (sin OpenClaw)
 */
function runMockTask(
  input: RunTaskInput,
  systemPrompt?: string,
  agentId?: string,
  presetId?: string
): RunTaskResult {
  return {
    success: true,
    result: {
      response: systemPrompt
        ? `[MOCK] System: "${systemPrompt}" | User: "${input.message}"`
        : `[MOCK] Processed: "${input.message}"`,
      timestamp: new Date().toISOString(),
      note: 'OpenClaw not configured. This is a mock response.'
    },
    source: 'mock',
    agentId,
    presetId,
    systemPrompt
  }
}

/**
 * Singleton REST client para OpenClaw
 */
let restClient: OpenClawRestClient | null = null

/**
 * Obtiene o crea cliente REST para OpenClaw
 */
function getRestClient(): OpenClawRestClient | null {
  const baseUrl = process.env.OPENCLAW_BASE_URL
  if (!baseUrl) {
    return null
  }

  if (!restClient) {
    restClient = new OpenClawRestClient({
      baseUrl,
      apiKey: process.env.OPENCLAW_API_KEY
    })
  }

  return restClient
}

/**
 * Ejecuta tarea via OpenClaw REST usando OpenClawRestClient
 */
async function runOpenClawTask(
  input: RunTaskInput,
  systemPrompt?: string,
  agentId?: string,
  presetId?: string
): Promise<RunTaskResult> {
  const client = getRestClient()
  if (!client) {
    return {
      success: false,
      result: null,
      source: 'openclaw',
      agentId,
      presetId,
      error: 'OpenClaw REST client not configured'
    }
  }

  // Construir mensajes
  let messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []

  // Si hay session, usar historial
  if (input.sessionId) {
    const sessionMessages = getSessionMessages(input.sessionId)
    if (sessionMessages) {
      messages = sessionMessages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
    }
  } else {
    // Sin session, solo mensaje actual
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }
    messages.push({ role: 'user', content: input.message })
  }

  // Añadir system prompt al inicio si hay session y no está ya
  if (input.sessionId && systemPrompt && messages.length > 0 && messages[0].role !== 'system') {
    messages.unshift({ role: 'system', content: systemPrompt })
  }

  // Usar OpenClawRestClient.postChatCompletion
  const response = await client.postChatCompletion({
    messages,
    model: process.env.OPENCLAW_MODEL || 'openclaw/default'
  })

  if (!response.success) {
    return {
      success: false,
      result: null,
      source: 'openclaw',
      agentId,
      presetId,
      error: `OpenClaw error: ${response.error}`
    }
  }

  return {
    success: true,
    result: response.data,
    source: 'openclaw',
    agentId,
    presetId,
    systemPrompt
  }
}

/**
 * Singleton WS client para RPC
 */
let wsClient: OpenClawWsClient | null = null
let chatRpc: OpenClawChatRpc | null = null

/**
 * Obtiene o crea cliente WS RPC
 */
function getWsClient(): OpenClawWsClient | null {
  const wsUrl = process.env.OPENCLAW_WS_URL
  if (!wsUrl) {
    return null
  }

  if (!wsClient) {
    wsClient = new OpenClawWsClient({
      wsUrl,
      apiKey: process.env.OPENCLAW_API_KEY
    })
    chatRpc = new OpenClawChatRpc(wsClient)
  }

  return wsClient
}

/**
 * Obtiene wrapper Chat RPC
 */
function getChatRpc(): OpenClawChatRpc | null {
  getWsClient() // Asegura inicialización
  return chatRpc
}

/**
 * Obtiene estado de conexión WS RPC
 */
function getWsConnectionState(): { connected: boolean; handshakeComplete: boolean; configured: boolean } {
  const client = getWsClient()
  if (!client) {
    return { connected: false, handshakeComplete: false, configured: false }
  }
  return {
    connected: client.isConnected(),
    handshakeComplete: client.isHandshakeComplete(),
    configured: true
  }
}

/**
 * Conecta al Gateway WS si no está conectado
 */
async function ensureWsConnected(): Promise<boolean> {
  const client = getWsClient()
  if (!client) {
    return false
  }

  if (client.isConnected()) {
    return true
  }

  try {
    await client.connect()
    return client.isConnected()
  } catch {
    return false
  }
}

/**
 * Ejecuta tarea con streaming via WebSocket
 * Fallback a REST/mock si WS no disponible
 */
export async function runStreamingTask(input: StreamTaskInput): Promise<StreamTaskResult> {
  // Validación
  if (!input.message || typeof input.message !== 'string') {
    return {
      success: false,
      mode: 'fallback',
      result: null,
      error: 'Invalid input: message is required'
    }
  }

  if (input.message.trim().length === 0) {
    return {
      success: false,
      mode: 'fallback',
      result: null,
      error: 'Invalid input: message cannot be empty'
    }
  }

  // Validar session si se proporciona
  if (input.sessionId) {
    // Si hay tenantId, usar validación tenant-aware
    const session = input.tenantId
      ? getSessionForTenant(input.sessionId, input.tenantId)
      : getSession(input.sessionId)

    if (!session) {
      return {
        success: false,
        mode: 'fallback',
        result: null,
        error: `Session with id "${input.sessionId}" not found`
      }
    }

    // Añadir mensaje del usuario a la sesión
    addMessage(input.sessionId, { role: 'user', content: input.message })
  }

  // Obtener configuración de agent/preset si existe (tenant-aware si tenantId proporcionado)
  const agentConfig = getAgentConfig(input.agentId, input.tenantId)
  if (agentConfig.error) {
    return {
      success: false,
      mode: 'fallback',
      result: null,
      error: agentConfig.error
    }
  }

  // Si el agent tiene tools, intentar ejecutar una
  if (agentConfig.tools && agentConfig.tools.length > 0) {
    // Construir contexto de ejecución
    const toolContext: ToolExecutionContext = {
      tenantId: input.tenantId,
      sessionId: input.sessionId
    }

    // Intentar detectar y ejecutar tool con modo híbrido
    const toolResult = await executeToolWithHybridMode(
      input.message,
      agentConfig.tools,
      agentConfig.toolsConfig,
      toolContext
    )

    if (toolResult) {
      const result: StreamTaskResult = {
        success: toolResult.success,
        mode: 'tool',
        result: toolResult.result,
        toolId: toolResult.toolId,
        error: toolResult.error
      }

      // Si hay session y éxito, añadir respuesta
      if (input.sessionId && result.success) {
        const responseContent = JSON.stringify(toolResult.result)
        addMessage(input.sessionId, { role: 'assistant', content: responseContent })
        result.sessionId = input.sessionId
      }

      return result
    }
  }

  // Intentar conectar WS si disponible
  const wsConnected = await ensureWsConnected()
  const wsState = getWsConnectionState()

  // Si WS está conectado con handshake, usar RPC chat.send
  if (wsConnected && wsState.handshakeComplete) {
    const streamResult = await runRpcStreamingTask(input)

    // Si hay session y éxito, añadir respuesta
    if (input.sessionId && streamResult.success) {
      const responseContent = extractStreamContent(streamResult.result)
      if (responseContent) {
        addMessage(input.sessionId, { role: 'assistant', content: responseContent })
      }
      streamResult.sessionId = input.sessionId
    }

    return streamResult
  }

  // Fallback a REST/mock
  const fallbackResult = await runFallbackStreamingTask(input)

  // Si hay session y éxito, añadir respuesta
  if (input.sessionId && fallbackResult.success) {
    const responseContent = extractStreamContent(fallbackResult.result)
    if (responseContent) {
      addMessage(input.sessionId, { role: 'assistant', content: responseContent })
    }
    fallbackResult.sessionId = input.sessionId
  }

  return fallbackResult
}

/**
 * Extrae contenido de resultado de streaming
 */
function extractStreamContent(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null

  const r = result as Record<string, unknown>

  if (typeof r.response === 'string') {
    return r.response
  }

  if (typeof r.content === 'string') {
    return r.content
  }

  if (typeof r.accumulated === 'string') {
    return r.accumulated
  }

  return null
}

/**
 * Ejecuta tarea via RPC chat.send (modo ACK)
 *
 * IMPORTANTE: chat.send devuelve ACK inmediato, NO la respuesta final.
 * La respuesta real llega via eventos WebSocket:
 * - chat.chunk: fragmentos de texto
 * - chat.done: fin de respuesta
 * - chat.error: error en generación
 *
 * TODO: Implementar suscripción a eventos para streaming real
 */
async function runRpcStreamingTask(input: StreamTaskInput): Promise<StreamTaskResult> {
  const rpc = getChatRpc()
  if (!rpc || !rpc.isReady()) {
    return {
      success: false,
      mode: 'ack',
      result: null,
      error: 'RPC client not ready'
    }
  }

  try {
    // chat.send devuelve ACK, NO respuesta final
    // Eventos: chat.chunk, chat.done, chat.error (pendiente implementar)
    const result = await rpc.chatSend({
      message: input.message,
      sessionId: input.sessionId
    })

    return {
      success: true,
      mode: 'ack',
      result: {
        status: result.status,  // 'ack' indica mensaje recibido
        sessionId: result.sessionId,
        timestamp: new Date().toISOString(),
        note: 'ACK recibido. Streaming real via eventos pendiente de implementar.'
      }
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown RPC error'
    return {
      success: false,
      mode: 'ack',
      result: null,
      error: `RPC chat.send failed: ${error}`
    }
  }
}

/**
 * Ejecuta fallback cuando WS no disponible
 * Usa REST o mock
 */
async function runFallbackStreamingTask(input: StreamTaskInput): Promise<StreamTaskResult> {
  const config = getOpenClawConfig()

  if (!config.baseUrl) {
    // Mock fallback
    return {
      success: true,
      mode: 'fallback',
      result: {
        response: `[MOCK STREAM] Processed: "${input.message}"`,
        timestamp: new Date().toISOString(),
        note: 'WS not connected, OpenClaw not configured. Mock fallback.'
      }
    }
  }

  // REST fallback
  const restInput: RunTaskInput = { message: input.message }
  const restResult = await runOpenClawTask(restInput)

  return {
    success: restResult.success,
    mode: 'fallback',
    result: restResult.result,
    error: restResult.error
  }
}
