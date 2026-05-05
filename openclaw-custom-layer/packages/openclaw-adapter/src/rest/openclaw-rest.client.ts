/**
 * OpenClaw REST Client
 * Cliente REST mínimo usando fetch nativo
 * Sin axios, sin dependencias externas
 */

import type {
  OpenClawAdapterConfig,
  OpenClawResponse,
  ChatCompletionRequest,
  ChatCompletionResponse
} from '../types'

const DEFAULT_TIMEOUT_MS = 30000

export class OpenClawRestClient {
  private readonly baseUrl: string
  private readonly apiKey?: string
  private readonly timeoutMs: number

  constructor(config: OpenClawAdapterConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.apiKey = config.apiKey
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  /**
   * GET request con timeout usando AbortController
   */
  private async get<T>(path: string): Promise<OpenClawResponse<T>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return {
          success: false,
          data: null,
          error: `HTTP ${response.status}: ${response.statusText}`
        }
      }

      const data = await response.json() as T
      return {
        success: true,
        data,
        error: null
      }
    } catch (err) {
      clearTimeout(timeoutId)
      return this.handleError<T>(err)
    }
  }

  /**
   * POST request con timeout usando AbortController
   */
  private async post<TReq, TRes>(path: string, body: TReq): Promise<OpenClawResponse<TRes>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return {
          success: false,
          data: null,
          error: `HTTP ${response.status}: ${response.statusText}`
        }
      }

      const data = await response.json() as TRes
      return {
        success: true,
        data,
        error: null
      }
    } catch (err) {
      clearTimeout(timeoutId)
      return this.handleError<TRes>(err)
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    return headers
  }

  private handleError<T>(err: unknown): OpenClawResponse<T> {
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        return {
          success: false,
          data: null,
          error: `Request timeout after ${this.timeoutMs}ms`
        }
      }
      return {
        success: false,
        data: null,
        error: err.message
      }
    }
    return {
      success: false,
      data: null,
      error: 'Unknown error'
    }
  }

  /**
   * Health check
   * TODO: Endpoint de health no confirmado para OpenClaw.
   * Usar ruta configurable o verificar documentación oficial.
   * Por ahora usa /health como placeholder.
   */
  async getHealth(): Promise<OpenClawResponse<unknown>> {
    // TODO: Verificar endpoint real de health en OpenClaw
    return this.get<unknown>('/health')
  }

  /**
   * Chat Completion - Compatibilidad OpenAI
   * NOTA: /v1/chat/completions es endpoint de compatibilidad OpenAI.
   * Usar solo si OpenClaw expone este endpoint.
   * Requiere model obligatorio en el body.
   */
  async postChatCompletion(
    payload: ChatCompletionRequest
  ): Promise<OpenClawResponse<ChatCompletionResponse>> {
    // Validar que hay messages
    if (!payload.messages || payload.messages.length === 0) {
      return {
        success: false,
        data: null,
        error: 'Invalid payload: messages array is required and cannot be empty'
      }
    }

    // Asegurar que model está presente (requerido por OpenAI API)
    const requestBody: ChatCompletionRequest = {
      ...payload,
      model: payload.model || 'openclaw/default'
    }

    // Endpoint de compatibilidad OpenAI
    return this.post<ChatCompletionRequest, ChatCompletionResponse>(
      '/v1/chat/completions',
      requestBody
    )
  }

  /**
   * Verifica si el cliente está configurado correctamente
   */
  isConfigured(): boolean {
    return Boolean(this.baseUrl)
  }

  /**
   * Obtiene la URL base configurada
   */
  getBaseUrl(): string {
    return this.baseUrl
  }
}
