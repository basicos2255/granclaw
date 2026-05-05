export type OpenClawConnectionStatus = 'not_configured' | 'configured' | 'error'

export interface OpenClawStatusResponse {
  configured: boolean
  baseUrl: string | null
  wsUrl: string | null
  status: OpenClawConnectionStatus
  error?: string
}

export interface OpenClawWsStatusResponse {
  configured: boolean
  connected: boolean
  wsUrl: string | null
}

export type WebhookTestStatus = 'not_configured' | 'simulated' | 'error'

export interface WebhookTestRequest {
  endpoint?: string
  payload?: unknown
}

export interface WebhookTestResponse {
  status: WebhookTestStatus
  webhookUrl: string | null
  endpoint?: string
  payload?: unknown
  message: string
}

/**
 * RPC Status response
 */
export interface WsRpcStatusResponse {
  configured: boolean
  connected: boolean
  handshakeComplete: boolean
  protocol: 'openclaw-gateway-rpc'
  handshake: 'required'
  methodsKnown: string[]
  connectResult?: {
    sessionId?: string
    capabilities?: string[]
  } | null
}

/**
 * Tools RPC Status response
 */
export interface ToolsRpcStatusResponse {
  configured: boolean
  wsConnected: boolean
  rpcReady: boolean
  toolsMode: 'internal' | 'hybrid'
  methodTentative: string
  note: string
}
