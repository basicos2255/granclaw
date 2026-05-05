import type {
  AgentRuntimeAdapter,
  AgentMessage,
  Session
} from '@granclaw/core'
import type { OpenClawAdapterConfig, WsConnectionState } from '../types'
import { OpenClawRestClient } from '../rest'
import { OpenClawWsClient, type ConnectResult } from '../ws'
import { OpenClawChatRpc, type ChatSendParams, type ChatSendResult } from '../ws/openclaw-chat.rpc'
import { OpenClawToolsRpc } from '../tools/openclaw-tools.rpc'
import { OpenClawToolsHttpClient } from '../tools/openclaw-tools-http.client'

/**
 * OpenClaw Runtime Adapter
 * Implementación del contrato AgentRuntimeAdapter
 * Recibe config en constructor, no conecta automáticamente
 * Soporta REST (fallback) y WebSocket RPC (principal)
 */
export class OpenClawRuntimeAdapter implements AgentRuntimeAdapter {
  private readonly config: OpenClawAdapterConfig | null
  private readonly restClient: OpenClawRestClient | null
  private readonly toolsHttpClient: OpenClawToolsHttpClient | null
  private wsClient: OpenClawWsClient | null = null
  private chatRpc: OpenClawChatRpc | null = null
  private toolsRpc: OpenClawToolsRpc | null = null

  constructor(config?: OpenClawAdapterConfig) {
    this.config = config ?? null
    this.restClient = config ? new OpenClawRestClient(config) : null
    this.toolsHttpClient = config?.baseUrl ? new OpenClawToolsHttpClient(config) : null

    // Crear WS client solo si wsUrl está configurada
    if (config?.wsUrl) {
      this.wsClient = new OpenClawWsClient({
        wsUrl: config.wsUrl,
        apiKey: config.apiKey
      })
      this.chatRpc = new OpenClawChatRpc(this.wsClient)
      this.toolsRpc = new OpenClawToolsRpc(this.wsClient)
    }
  }

  /**
   * Verifica si el adapter está configurado
   */
  isConfigured(): boolean {
    return this.config !== null && Boolean(this.config.baseUrl)
  }

  /**
   * Verifica si WebSocket está configurado
   */
  isWsConfigured(): boolean {
    return this.wsClient !== null
  }

  /**
   * Obtiene la URL base REST configurada
   */
  getBaseUrl(): string | null {
    return this.config?.baseUrl ?? null
  }

  /**
   * Obtiene la URL WebSocket configurada
   */
  getWsUrl(): string | null {
    return this.config?.wsUrl ?? null
  }

  /**
   * Estado actual de la conexión WebSocket
   */
  getWsState(): WsConnectionState {
    return this.wsClient?.getState() ?? 'disconnected'
  }

  /**
   * Verifica si WebSocket está conectado (con handshake completo)
   */
  isWsConnected(): boolean {
    return this.wsClient?.isConnected() ?? false
  }

  /**
   * Verifica si handshake RPC está completo
   */
  isHandshakeComplete(): boolean {
    return this.wsClient?.isHandshakeComplete() ?? false
  }

  /**
   * Obtiene resultado del connect RPC
   */
  getConnectResult(): ConnectResult | null {
    return this.wsClient?.getConnectResult() ?? null
  }

  /**
   * Obtiene el wrapper de Chat RPC
   */
  getChatRpc(): OpenClawChatRpc | null {
    return this.chatRpc
  }

  /**
   * Obtiene el wrapper de Tools RPC
   */
  getToolsRpc(): OpenClawToolsRpc | null {
    return this.toolsRpc
  }

  /**
   * Verifica si Tools RPC está listo
   */
  isToolsRpcReady(): boolean {
    return this.isToolsRpcExperimentalEnabled() && (this.toolsRpc?.isReady() ?? false)
  }

  isToolsHttpConfigured(): boolean {
    return this.toolsHttpClient?.isConfigured() ?? false
  }

  private isToolsRpcExperimentalEnabled(): boolean {
    return process.env.OPENCLAW_TOOLS_RPC_EXPERIMENTAL === 'true'
  }

  /**
   * Conectar al runtime via WebSocket
   * Realiza handshake RPC obligatorio (connect)
   */
  async connectRuntime(): Promise<void> {
    if (!this.wsClient) {
      throw new Error('WebSocket not configured')
    }
    await this.wsClient.connect()
  }

  /**
   * Desconectar del runtime WebSocket
   */
  disconnectRuntime(): void {
    this.wsClient?.disconnect()
  }

  /**
   * Enviar mensaje via RPC chat.send
   * NOTA: chat.send devuelve ack, NO la respuesta final.
   * La respuesta real llega via eventos de streaming.
   * TODO: Implementar suscripción a eventos chat.chunk/chat.done
   */
  async sendMessage(sessionId: string, message: AgentMessage): Promise<AgentMessage> {
    // Intentar via RPC si conectado
    if (this.chatRpc?.isReady()) {
      try {
        const result = await this.chatRpc.chatSend({
          message: message.content,
          sessionId
        })
        // NOTA: Solo recibimos ack, no respuesta real
        // TODO: Implementar streaming para obtener respuesta real
        return {
          role: 'assistant',
          content: result.status === 'ack' ? '[Mensaje enviado - streaming pendiente]' : '[Error]',
          timestamp: new Date()
        }
      } catch {
        // Fallback a REST/mock si RPC falla
      }
    }

    // Fallback/mock
    if (!this.restClient) {
      return {
        role: 'assistant',
        content: 'Adapter not configured',
        timestamp: new Date()
      }
    }

    return {
      role: 'assistant',
      content: '',
      timestamp: new Date()
    }
  }

  /**
   * Abortar via RPC chat.abort
   */
  async abort(sessionId: string): Promise<void> {
    if (this.chatRpc?.isReady()) {
      try {
        await this.chatRpc.chatAbort({ sessionId })
      } catch {
        // Ignorar errores de abort
      }
    }
  }

  /**
   * Listar sesiones via RPC sessions.list
   */
  async listSessions(agentId: string): Promise<Session[]> {
    if (this.chatRpc?.isReady()) {
      try {
        const result = await this.chatRpc.sessionsList({ agentId })
        // TODO: Mapear resultado a Session[] según schema real
        return result as Session[]
      } catch {
        // Fallback
      }
    }
    return []
  }

  async getSession(sessionId: string): Promise<Session | null> {
    // TODO: Implementar via RPC cuando método disponible
    return null
  }

  /**
   * Patch sesión via RPC sessions.patch
   */
  async patchSession(sessionId: string, patch: Partial<Session>): Promise<Session> {
    if (this.chatRpc?.isReady()) {
      try {
        const result = await this.chatRpc.sessionsPatch({
          sessionId,
          patch: patch as Record<string, unknown>
        })
        // TODO: Mapear resultado según schema real
        return result as Session
      } catch {
        // Fallback
      }
    }
    return {
      id: sessionId,
      agentId: '',
      tenantId: '',
      status: 'active',
      startedAt: new Date()
    }
  }

  async createSession(agentId: string): Promise<Session> {
    // TODO: Implementar via RPC cuando método disponible
    return {
      id: '',
      agentId,
      tenantId: '',
      status: 'active',
      startedAt: new Date()
    }
  }

  /**
   * Ejecutar tool via OpenClaw HTTP /tools/invoke
   *
   * Puente entre el sistema de tools interno de GranClaw
   * y el sistema de tools/plugins de OpenClaw.
   *
   * RPC tools.execute queda como fallback experimental.
   * NO CONFIRMADO por documentación oficial. No usar salvo flag experimental.
   *
   * @param toolName - Nombre de la tool en OpenClaw
   * @param params - Parámetros de ejecución
   * @returns Resultado de la tool
   */
  async executeToolViaOpenClaw(
    toolName: string,
    params: Record<string, unknown>
  ): Promise<{ success: boolean; result: unknown; error?: string }> {
    // Validación de entrada
    if (!toolName || typeof toolName !== 'string') {
      return {
        success: false,
        result: null,
        error: 'Invalid toolName: must be a non-empty string'
      }
    }

    if (!params || typeof params !== 'object') {
      return {
        success: false,
        result: null,
        error: 'Invalid params: must be an object'
      }
    }

    // Vía documentada por defecto: POST /tools/invoke
    if (this.toolsHttpClient?.isConfigured()) {
      const response = await this.toolsHttpClient.invokeTool({
        tool: toolName,
        args: params
      })

      if (!response.success || !response.data) {
        return {
          success: false,
          result: null,
          error: response.error || 'OpenClaw /tools/invoke failed'
        }
      }

      // OpenClaw usa { ok, result, error } - convertir a { success, result, error }
      return {
        success: response.data.ok,
        result: response.data.result ?? null,
        error: response.data.error ? String(response.data.error) : undefined
      }
    }

    if (this.toolsRpc && this.isToolsRpcExperimentalEnabled()) {
      // NO CONFIRMADO por documentación oficial. No usar salvo flag experimental.
      return this.toolsRpc.executeTool(toolName, params)
    }

    return {
      success: false,
      result: null,
      error: 'OpenClaw Tools HTTP not configured. Set OPENCLAW_BASE_URL to use POST /tools/invoke.'
    }
  }
}
