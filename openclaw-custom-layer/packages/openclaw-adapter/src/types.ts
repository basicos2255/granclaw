/**
 * Tipos internos del adapter OpenClaw
 * No usar any - tipos específicos para comunicación futura
 */

/**
 * Configuración del adapter OpenClaw
 */
export interface OpenClawAdapterConfig {
  baseUrl: string
  apiKey?: string
  wsUrl?: string
  timeoutMs?: number
}

/** @deprecated Use OpenClawAdapterConfig */
export interface OpenClawConfig {
  baseUrl: string
  wsUrl: string
  apiKey: string
  timeout?: number
}

export interface OpenClawResponse<T> {
  success: boolean
  data: T | null
  error: string | null
}

export interface OpenClawError {
  code: string
  message: string
  details?: Record<string, unknown>
}

/**
 * Tipos para REST client - Compatibilidad OpenAI
 * NOTA: /v1/chat/completions es endpoint de compatibilidad OpenAI
 */
export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionRequest {
  model?: string
  messages: ChatCompletionMessage[]
  temperature?: number
  max_tokens?: number
}

export interface ChatCompletionChoice {
  index: number
  message: ChatCompletionMessage
  finish_reason: string
}

export interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: ChatCompletionChoice[]
}

/**
 * Tipos para WebSocket client
 */
export interface WsClientConfig {
  wsUrl: string
  apiKey?: string
  reconnectIntervalMs?: number
  // Configurable client identity (OpenClaw Gateway schema requirements)
  wsClientId?: string
  wsClientMode?: string
  // Opcional: variantes a probar formato "id:mode,id:mode"
  wsClientVariants?: string
}

export type WsConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface WsMessage {
  event: string
  payload: unknown
  id?: string
  timestamp?: number
}

export type WsMessageHandler = (message: WsMessage) => void

/**
 * Handler para eventos específicos
 */
export type WsEventHandler = (payload: unknown) => void

/**
 * Tipos para Webhooks client
 */
export interface WebhookClientConfig {
  webhookUrl: string
  apiKey?: string
  timeoutMs?: number
}

export type WebhookStatus = 'not_configured' | 'triggered' | 'ok' | 'error'

export interface WebhookTriggerResponse {
  success: boolean
  status: WebhookStatus
  statusCode?: number
  data?: unknown
  error?: string
}

export interface WebhookStatusResponse {
  success: boolean
  status: WebhookStatus
  statusCode?: number
  data?: unknown
  error?: string
}
