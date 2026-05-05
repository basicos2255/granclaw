/**
 * OpenClaw Chat RPC Wrapper
 * Métodos específicos de chat/sessions sobre el cliente WS RPC
 */

import type { OpenClawWsClient } from './openclaw-ws.client'

/**
 * Params para chat.send
 * TODO: Validar schema exacto contra documentación OpenClaw
 */
export interface ChatSendParams {
  message: string
  sessionId?: string
  // TODO: Añadir otros campos si OpenClaw los requiere
}

/**
 * Resultado de chat.send
 * IMPORTANTE: chat.send NO devuelve la respuesta del LLM.
 * Solo devuelve status: "ack" indicando que el mensaje fue recibido.
 * La respuesta real llega via eventos de streaming.
 */
export interface ChatSendResult {
  status: 'ack' | 'error'
  sessionId?: string
  error?: string
}

/**
 * Params para chat.history
 * TODO: Validar schema exacto
 */
export interface ChatHistoryParams {
  sessionId?: string
  limit?: number
}

/**
 * Params para chat.inject
 * TODO: Validar schema exacto
 */
export interface ChatInjectParams {
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
}

/**
 * Params para sessions.patch
 * TODO: Validar schema exacto
 */
export interface SessionsPatchParams {
  sessionId: string
  patch: Record<string, unknown>
}

/**
 * Wrapper RPC para métodos de Chat y Sessions
 */
export class OpenClawChatRpc {
  constructor(private readonly client: OpenClawWsClient) {}

  /**
   * Verifica si el cliente está conectado
   */
  isReady(): boolean {
    return this.client.isConnected()
  }

  /**
   * chat.history - Obtener historial de chat
   * TODO: Validar payload exacto contra OpenClaw
   */
  async chatHistory(params?: ChatHistoryParams): Promise<unknown> {
    return this.client.request('chat.history', params)
  }

  /**
   * chat.send - Enviar mensaje de chat
   *
   * IMPORTANTE: chat.send NO devuelve la respuesta del LLM.
   * Solo devuelve status: "ack" indicando recepción.
   * La respuesta real llega via eventos:
   * - chat.chunk: fragmentos de respuesta
   * - chat.done: fin de respuesta
   * - chat.error: error en generación
   *
   * Para implementar streaming real:
   * 1. Suscribirse a eventos ANTES de llamar chatSend()
   * 2. Usar wsClient.onEvent('chat.chunk', handler)
   * 3. Acumular chunks hasta recibir 'chat.done'
   *
   * TODO: Validar eventos exactos contra OpenClaw real
   */
  async chatSend(params: ChatSendParams): Promise<ChatSendResult> {
    const result = await this.client.request('chat.send', params)
    // Server devuelve ack, no respuesta final
    return {
      status: 'ack',
      sessionId: (result as { sessionId?: string })?.sessionId
    }
  }

  /**
   * chat.abort - Abortar generación en curso
   * TODO: Validar payload exacto contra OpenClaw
   */
  async chatAbort(params?: { sessionId?: string }): Promise<unknown> {
    return this.client.request('chat.abort', params)
  }

  /**
   * chat.inject - Inyectar mensaje en historial
   * TODO: Validar payload exacto contra OpenClaw
   */
  async chatInject(params: ChatInjectParams): Promise<unknown> {
    return this.client.request('chat.inject', params)
  }

  /**
   * sessions.list - Listar sesiones
   * TODO: Validar payload exacto contra OpenClaw
   */
  async sessionsList(params?: unknown): Promise<unknown> {
    return this.client.request('sessions.list', params)
  }

  /**
   * sessions.patch - Actualizar sesión
   * TODO: Validar payload exacto contra OpenClaw
   */
  async sessionsPatch(params: SessionsPatchParams): Promise<unknown> {
    return this.client.request('sessions.patch', params)
  }

  /**
   * channels.status - Estado de canales
   * TODO: Validar payload exacto contra OpenClaw
   */
  async channelsStatus(params?: unknown): Promise<unknown> {
    return this.client.request('channels.status', params)
  }

  /**
   * config.patch - Actualizar configuración
   * TODO: Validar payload exacto contra OpenClaw
   */
  async configPatch(params: Record<string, unknown>): Promise<unknown> {
    return this.client.request('config.patch', params)
  }
}
