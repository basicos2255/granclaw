/**
 * OpenClaw Tools HTTP Client
 * Cliente HTTP documentado para invocación de tools via /tools/invoke
 *
 * ⚠️ SEGURIDAD CRÍTICA ⚠️
 * /tools/invoke es superficie de operador completo.
 * - Debe usarse solo en loopback o red privada.
 * - Nunca exponer públicamente.
 * - NO exponer en UI pública - superficie sensible de seguridad.
 *
 * IMPORTANTE: Esta es la vía documentada para ejecutar tools en OpenClaw.
 */

import type { OpenClawAdapterConfig, OpenClawResponse } from '../types'

const DEFAULT_TIMEOUT_MS = 30000

/**
 * Input para invocación de tool
 */
export interface ToolInvokeInput {
  tool: string
  action?: string
  args?: unknown
  sessionKey?: string
}

/**
 * Response de invocación de tool
 * Protocolo documentado OpenClaw: { ok: boolean, result?: unknown, error?: unknown }
 */
export interface ToolInvokeResponse {
  ok: boolean
  result?: unknown
  error?: unknown
}

/**
 * OpenClaw Tools HTTP Client
 * Usa endpoint documentado POST /tools/invoke
 */
export class OpenClawToolsHttpClient {
  private readonly baseUrl: string
  private readonly apiKey?: string
  private readonly timeoutMs: number

  constructor(config: OpenClawAdapterConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.apiKey = config.apiKey
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  /**
   * Verifica si el cliente está configurado
   */
  isConfigured(): boolean {
    return Boolean(this.baseUrl)
  }

  /**
   * Invoca una tool via HTTP POST /tools/invoke
   *
   * Body documentado:
   * {
   *   tool: string,
   *   action: string (default "json"),
   *   args: object (default {}),
   *   sessionKey: string (default "main")
   * }
   *
   * SEGURIDAD: No exponer este método a UI pública.
   */
  async invokeTool(input: ToolInvokeInput): Promise<OpenClawResponse<ToolInvokeResponse>> {
    // Validación de entrada
    if (!input.tool || typeof input.tool !== 'string') {
      return {
        success: false,
        data: null,
        error: 'Invalid input: tool name is required'
      }
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

    const body = {
      tool: input.tool,
      action: input.action || 'json',
      args: input.args || {},
      sessionKey: input.sessionKey || 'main'
    }

    try {
      const response = await fetch(`${this.baseUrl}/tools/invoke`, {
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

      const data = await response.json() as ToolInvokeResponse
      return {
        success: true,
        data,
        error: null
      }
    } catch (err) {
      clearTimeout(timeoutId)
      return this.handleError(err)
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

  private handleError(err: unknown): OpenClawResponse<ToolInvokeResponse> {
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
}
