/**
 * OpenClaw Tools RPC Wrapper
 * Capa de abstracción para ejecución de tools via Gateway RPC
 *
 * ⚠️ DESHABILITADO POR DEFECTO ⚠️
 * tools.execute es método NO CONFIRMADO y está deshabilitado.
 * NO CONFIRMADO por documentación oficial. No usar salvo flag experimental.
 * Para habilitar, usar flag experimental: OPENCLAW_TOOLS_RPC_EXPERIMENTAL=true
 *
 * MÉTODO OFICIAL: POST /tools/invoke via OpenClawToolsHttpClient
 */

import type { OpenClawWsClient } from '../ws/openclaw-ws.client'

/**
 * Parámetros de ejecución de tool
 */
export interface ToolExecuteParams {
  toolName: string
  params: Record<string, unknown>
}

/**
 * Resultado de ejecución de tool via OpenClaw
 */
export interface ToolExecuteResult {
  success: boolean
  result: unknown
  error?: string
}

/**
 * Verifica si tools.execute RPC está habilitado (experimental)
 */
function isToolsRpcEnabled(): boolean {
  return process.env.OPENCLAW_TOOLS_RPC_EXPERIMENTAL === 'true'
}

/**
 * OpenClaw Tools RPC Wrapper
 * DESHABILITADO por defecto. Usar OpenClawToolsHttpClient.
 */
export class OpenClawToolsRpc {
  private readonly wsClient: OpenClawWsClient

  constructor(wsClient: OpenClawWsClient) {
    this.wsClient = wsClient
  }

  /**
   * Verifica si el cliente está listo para ejecutar tools
   */
  isReady(): boolean {
    return this.wsClient.isConnected() && this.wsClient.isHandshakeComplete()
  }

  /**
   * Ejecuta una tool via OpenClaw Gateway RPC
   *
   * ⚠️ DESHABILITADO POR DEFECTO ⚠️
   * Requiere: OPENCLAW_TOOLS_RPC_EXPERIMENTAL=true
   *
   * MÉTODO OFICIAL: Usar OpenClawToolsHttpClient con POST /tools/invoke
   */
  async executeTool(toolName: string, params: Record<string, unknown>): Promise<ToolExecuteResult> {
    // Verificar si está habilitado
    if (!isToolsRpcEnabled()) {
      return {
        success: false,
        result: null,
        error: 'tools.execute RPC está deshabilitado. Usar OpenClawToolsHttpClient con POST /tools/invoke. Para habilitar experimental: OPENCLAW_TOOLS_RPC_EXPERIMENTAL=true'
      }
    }

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

    if (!this.isReady()) {
      return {
        success: false,
        result: null,
        error: 'OpenClaw RPC not ready: WebSocket not connected or handshake incomplete'
      }
    }

    try {
      // NO CONFIRMADO por documentación oficial. No usar salvo flag experimental.
      const result = await this.wsClient.request('tools.execute', {
        tool: toolName,
        params
      })

      return {
        success: true,
        result
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown RPC error'
      return {
        success: false,
        result: null,
        error: `OpenClaw tools.execute failed: ${errorMsg}`
      }
    }
  }

  /**
   * Lista tools disponibles en OpenClaw
   *
   * TODO: Validar si existe método tools.list en Gateway
   */
  async listTools(): Promise<{ success: boolean; tools: string[]; error?: string }> {
    if (!this.isReady()) {
      return {
        success: false,
        tools: [],
        error: 'OpenClaw RPC not ready'
      }
    }

    try {
      // TODO: Método tentativo, validar contra docs
      const result = await this.wsClient.request('tools.list', {})
      return {
        success: true,
        tools: Array.isArray(result) ? result : []
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown RPC error'
      return {
        success: false,
        tools: [],
        error: `OpenClaw tools.list failed: ${errorMsg}`
      }
    }
  }
}
