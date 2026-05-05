/**
 * OpenClaw Webhooks Client
 * Cliente para disparar y consultar flujos via webhooks
 * Sin lógica de negocio - solo transporte
 */

import type { WebhookClientConfig, WebhookTriggerResponse, WebhookStatusResponse } from '../types'

export class OpenClawWebhooksClient {
  private readonly baseUrl: string | null
  private readonly apiKey?: string
  private readonly timeoutMs: number

  constructor(config?: WebhookClientConfig) {
    this.baseUrl = config?.webhookUrl || null
    this.apiKey = config?.apiKey
    this.timeoutMs = config?.timeoutMs || 10000
  }

  /**
   * Verifica si el cliente está configurado
   */
  isConfigured(): boolean {
    return this.baseUrl !== null
  }

  /**
   * Dispara un flujo via webhook
   * @param endpoint - Endpoint relativo o absoluto
   * @param payload - Payload a enviar
   */
  async triggerFlow(endpoint: string, payload: unknown): Promise<WebhookTriggerResponse> {
    if (!this.baseUrl) {
      return {
        success: false,
        status: 'not_configured',
        error: 'OPENCLAW_WEBHOOK_URL not configured'
      }
    }

    const url = this.buildUrl(endpoint)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(payload),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return {
          success: false,
          status: 'error',
          statusCode: response.status,
          error: `HTTP ${response.status}: ${response.statusText}`
        }
      }

      const data = await response.json()
      return {
        success: true,
        status: 'triggered',
        statusCode: response.status,
        data
      }
    } catch (err) {
      clearTimeout(timeoutId)
      const error = err instanceof Error ? err.message : 'Unknown error'
      return {
        success: false,
        status: 'error',
        error
      }
    }
  }

  /**
   * Consulta el estado de un flujo
   * @param endpoint - Endpoint de status
   */
  async getFlowStatus(endpoint: string): Promise<WebhookStatusResponse> {
    if (!this.baseUrl) {
      return {
        success: false,
        status: 'not_configured',
        error: 'OPENCLAW_WEBHOOK_URL not configured'
      }
    }

    const url = this.buildUrl(endpoint)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.buildHeaders(),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return {
          success: false,
          status: 'error',
          statusCode: response.status,
          error: `HTTP ${response.status}: ${response.statusText}`
        }
      }

      const data = await response.json()
      return {
        success: true,
        status: 'ok',
        statusCode: response.status,
        data
      }
    } catch (err) {
      clearTimeout(timeoutId)
      const error = err instanceof Error ? err.message : 'Unknown error'
      return {
        success: false,
        status: 'error',
        error
      }
    }
  }

  private buildUrl(endpoint: string): string {
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return endpoint
    }
    const base = this.baseUrl!.replace(/\/$/, '')
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    return `${base}${path}`
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }
    return headers
  }
}
