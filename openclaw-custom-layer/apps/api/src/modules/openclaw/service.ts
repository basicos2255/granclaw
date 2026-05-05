import type {
  OpenClawStatusResponse,
  OpenClawConnectionStatus,
  OpenClawWsStatusResponse,
  WebhookTestRequest,
  WebhookTestResponse,
  WsRpcStatusResponse,
  ToolsRpcStatusResponse
} from './types'
import { OpenClawWsClient } from '@granclaw/openclaw-adapter'
import { getOpenClawToolsStatus } from '../orchestrator'

/**
 * Lee variables de entorno de OpenClaw
 */
function getEnvConfig() {
  return {
    baseUrl: process.env.OPENCLAW_BASE_URL || null,
    wsUrl: process.env.OPENCLAW_WS_URL || null,
    apiKey: process.env.OPENCLAW_API_KEY || null,
    webhookUrl: process.env.OPENCLAW_WEBHOOK_URL || null
  }
}

/**
 * Obtiene el estado de configuración de OpenClaw
 * No hace llamada real si no está configurado
 */
export function getOpenClawStatus(): OpenClawStatusResponse {
  const config = getEnvConfig()

  if (!config.baseUrl) {
    return {
      configured: false,
      baseUrl: null,
      wsUrl: null,
      status: 'not_configured'
    }
  }

  // Configuración presente
  let status: OpenClawConnectionStatus = 'configured'
  let error: string | undefined

  // Validación básica de URL
  try {
    new URL(config.baseUrl)
  } catch {
    status = 'error'
    error = 'Invalid OPENCLAW_BASE_URL format'
  }

  return {
    configured: true,
    baseUrl: config.baseUrl,
    wsUrl: config.wsUrl,
    status,
    error
  }
}

/**
 * Obtiene el estado de configuración de WebSocket
 * NO conecta automáticamente
 */
export function getOpenClawWsStatus(): OpenClawWsStatusResponse {
  const config = getEnvConfig()

  if (!config.wsUrl) {
    return {
      configured: false,
      connected: false,
      wsUrl: null
    }
  }

  // WS configurado pero no conectado (no conectamos automáticamente)
  return {
    configured: true,
    connected: false, // No conectamos automáticamente desde el endpoint
    wsUrl: config.wsUrl
  }
}

/**
 * Simula test de webhook
 * NO envía webhook real, solo simula
 */
export function testWebhook(request: WebhookTestRequest): WebhookTestResponse {
  const config = getEnvConfig()

  if (!config.webhookUrl) {
    return {
      status: 'not_configured',
      webhookUrl: null,
      message: 'OPENCLAW_WEBHOOK_URL not configured'
    }
  }

  // Simulación - no enviamos webhook real
  return {
    status: 'simulated',
    webhookUrl: config.webhookUrl,
    endpoint: request.endpoint || '/',
    payload: request.payload || {},
    message: 'Webhook simulated (not sent). Configure real integration for actual delivery.'
  }
}

/**
 * Singleton WS client para diagnóstico RPC
 */
let wsRpcClient: OpenClawWsClient | null = null

/**
 * Obtiene estado de conexión WS RPC
 */
export function getWsRpcStatus(): WsRpcStatusResponse {
  const config = getEnvConfig()

  if (!config.wsUrl) {
    return {
      configured: false,
      connected: false,
      handshakeComplete: false,
      protocol: 'openclaw-gateway-rpc',
      handshake: 'required',
      methodsKnown: OpenClawWsClient.KNOWN_METHODS,
      connectResult: null
    }
  }

  // Obtener o crear cliente para diagnóstico
  if (!wsRpcClient) {
    wsRpcClient = new OpenClawWsClient({
      wsUrl: config.wsUrl,
      apiKey: config.apiKey ?? undefined
    })
  }

  return {
    configured: true,
    connected: wsRpcClient.isConnected(),
    handshakeComplete: wsRpcClient.isHandshakeComplete(),
    protocol: 'openclaw-gateway-rpc',
    handshake: 'required',
    methodsKnown: OpenClawWsClient.KNOWN_METHODS,
    connectResult: wsRpcClient.getConnectResult()
  }
}

/**
 * Obtiene estado de Tools RPC
 */
export function getToolsRpcStatus(): ToolsRpcStatusResponse {
  const config = getEnvConfig()
  const toolsStatus = getOpenClawToolsStatus()

  return {
    configured: Boolean(config.baseUrl),
    wsConnected: toolsStatus.wsConnected,
    rpcReady: toolsStatus.rpcReady,
    toolsMode: toolsStatus.toolsMode,
    methodTentative: 'tools.execute',
    note: '/tools/invoke HTTP documentado. tools.execute RPC no confirmado y deshabilitado por defecto.'
  }
}
