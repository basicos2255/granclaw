/**
 * OpenClaw WebSocket Client
 * Cliente RPC compatible con OpenClaw Gateway protocol
 * Frames JSON, handshake connect obligatorio
 *
 * Protocolo documentado:
 * - Response: { type: "res", id, ok: boolean, payload?, error? }
 * - Event: { type: "event", event, payload? }
 *
 * FIX 040: Uses Node.js 'ws' package to support Authorization header in upgrade request
 * Endpoint: ws://localhost:18789/__openclaw__/ws (configurable via OPENCLAW_WS_URL)
 * Auth: Authorization: Bearer <token> in WebSocket upgrade headers
 *
 * FIX 041: CRITICAL - OpenClaw requires connect.challenge before connect
 * Flow: open -> wait for connect.challenge event -> send connect request -> hello-ok
 * Do NOT send connect immediately after open. This breaks WS completely.
 */

import WebSocket from 'ws'
import type { WsClientConfig, WsConnectionState } from '../types'

/**
 * RPC ID type
 */
export type RpcId = string

/**
 * RPC Request frame
 */
export interface RpcRequest {
  type: 'req'
  id: RpcId
  method: string
  params?: unknown
}

/**
 * RPC Response frame (protocolo documentado OpenClaw)
 * Usa ok + payload/error en lugar de result/error
 */
export interface RpcResponse {
  type: 'res'
  id: RpcId
  ok: boolean
  payload?: unknown
  error?: unknown
}

/**
 * RPC Event frame (server push)
 * Protocolo documentado: payload en lugar de data
 */
export interface RpcEvent {
  type: 'event'
  event: string
  payload?: unknown
}

/**
 * RPC Frame (union)
 */
export type RpcFrame = RpcRequest | RpcResponse | RpcEvent

/**
 * Client identification for handshake
 * Protocolo oficial OpenClaw Gateway
 */
export interface ClientInfo {
  id: string
  version: string
  platform?: string
  mode?: string
}

/**
 * Connect params for handshake
 * Protocolo documentado OpenClaw Gateway
 */
export interface ConnectParams {
  role: 'operator' | 'webchat' | 'agent'
  scopes?: string[]
  auth?: {
    token: string
  }
  // Protocolo versiones
  minProtocol?: number
  maxProtocol?: number
  // Identificación cliente
  client?: ClientInfo
  // Capabilities solicitadas
  caps?: string[]
  // Comandos permitidos (opcional)
  commands?: string[]
  // Permisos solicitados (opcional)
  permissions?: Record<string, unknown>
  // Locale preferido
  locale?: string
  // User agent
  userAgent?: string
}

/**
 * Connect result
 */
export interface ConnectResult {
  sessionId?: string
  capabilities?: string[]
}

/**
 * Pending request tracker
 */
interface PendingRequest {
  resolve: (result: unknown) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

/**
 * Event handler type
 */
export type RpcEventHandler = (payload: unknown) => void

/**
 * Cliente WebSocket RPC para OpenClaw Gateway
 */
export class OpenClawWsClient {
  private readonly wsUrl: string
  private readonly apiKey?: string
  private readonly wsClientId: string
  private readonly wsClientMode: string
  private readonly wsClientVariants: string | undefined
  private ws: WebSocket | null = null
  private state: WsConnectionState = 'disconnected'
  private socketOpen = false // FIX 033: track socket open state separately from handshake
  private handshakeComplete = false
  private pendingRequests: Map<RpcId, PendingRequest> = new Map()
  private eventHandlers: Map<string, RpcEventHandler[]> = new Map()
  private requestTimeoutMs: number
  private connectResult: ConnectResult | null = null
  private lastError: string | null = null
  private lastHandshakeResponse: unknown = null

  // FIX 041: connect.challenge state
  // CRITICAL: OpenClaw requires connect.challenge before connect.
  // Do not send connect before receiving challenge. Changing this breaks WS completely.
  private connectChallengeSeen = false
  private connectChallengeNonce: string | null = null
  private connectChallengeResolver: (() => void) | null = null

  // Known methods from OpenClaw Gateway protocol
  static readonly KNOWN_METHODS = [
    'connect',
    'chat.history',
    'chat.send',
    'chat.abort',
    'chat.inject',
    'sessions.list',
    'sessions.patch',
    'channels.status',
    'config.patch'
  ]

  constructor(config: WsClientConfig) {
    this.wsUrl = config.wsUrl
    this.apiKey = config.apiKey
    this.requestTimeoutMs = config.reconnectIntervalMs ?? 30000
    // Client identity from config or env (FIX 034: official values)
    this.wsClientId = config.wsClientId || process.env.OPENCLAW_WS_CLIENT_ID || 'gateway-client'
    this.wsClientMode = config.wsClientMode || process.env.OPENCLAW_WS_CLIENT_MODE || 'backend'
    this.wsClientVariants = config.wsClientVariants || process.env.OPENCLAW_WS_CLIENT_VARIANTS
  }

  /**
   * Estado actual de la conexión
   */
  getState(): WsConnectionState {
    return this.state
  }

  /**
   * URL WebSocket configurada
   */
  getWsUrl(): string {
    return this.wsUrl
  }

  /**
   * Verifica si está conectado y handshake completo
   */
  isConnected(): boolean {
    return this.state === 'connected' && this.ws !== null && this.handshakeComplete
  }

  /**
   * Verifica si handshake está completo
   */
  isHandshakeComplete(): boolean {
    return this.handshakeComplete
  }

  /**
   * Obtiene resultado del connect
   */
  getConnectResult(): ConnectResult | null {
    return this.connectResult
  }

  /**
   * Obtiene último error WS
   */
  getLastError(): string | null {
    return this.lastError
  }

  /**
   * Obtiene última respuesta de handshake (para debug)
   */
  getLastHandshakeResponse(): unknown {
    return this.lastHandshakeResponse
  }

  /**
   * Conectar al WebSocket y realizar handshake
   * FIX 040: Uses ws package with Authorization header in upgrade request
   */
  async connect(): Promise<void> {
    if (this.ws && this.handshakeComplete) {
      return
    }

    this.state = 'connecting'
    this.handshakeComplete = false
    this.lastError = null

    console.log('[WS] Connecting to:', this.wsUrl)
    console.log('[WS] Auth header:', this.apiKey ? 'Bearer [REDACTED]' : 'none')

    return new Promise((resolve, reject) => {
      try {
        // FIX 040: Build WebSocket options with Authorization header
        const wsOptions: WebSocket.ClientOptions = {
          headers: {}
        }

        // Add Authorization header if API key is configured
        if (this.apiKey) {
          wsOptions.headers = {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }

        // Create WebSocket with headers (ws package supports this, browser WebSocket does not)
        this.ws = new WebSocket(this.wsUrl, wsOptions)

        this.ws.on('open', async () => {
          console.log('[WS] Connection opened (upgrade successful)')
          // FIX 033: Mark socket as open BEFORE sending connect request
          this.socketOpen = true
          try {
            // Handshake obligatorio: primer frame debe ser connect
            await this.performHandshake()
            this.state = 'connected'
            console.log('[WS] Handshake complete')
            resolve()
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err)
            console.error('[WS] Handshake failed:', errMsg)
            this.lastError = errMsg
            this.state = 'error'
            this.disconnect()
            reject(err)
          }
        })

        this.ws.on('close', (code: number, reason: Buffer) => {
          const reasonStr = reason?.toString() || ''
          console.log('[WS] Connection closed, code:', code, 'reason:', reasonStr)
          this.state = 'disconnected'
          this.socketOpen = false // FIX 033
          this.handshakeComplete = false
          this.ws = null
          this.rejectAllPending(new Error('Connection closed'))
        })

        this.ws.on('error', (err: Error) => {
          const errMsg = err.message || 'WebSocket error'
          console.error('[WS] ERROR:', errMsg)
          this.lastError = errMsg
          this.state = 'error'
          reject(err)
        })

        this.ws.on('message', (data: WebSocket.RawData) => {
          this.handleIncomingFrame(data.toString())
        })

        // FIX 040: Handle unexpected-response for auth failures
        this.ws.on('unexpected-response', (_req, res) => {
          const errMsg = `WebSocket upgrade failed: ${res.statusCode} ${res.statusMessage}`
          console.error('[WS] Upgrade rejected:', errMsg)
          this.lastError = errMsg
          this.state = 'error'
          reject(new Error(errMsg))
        })
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error('[WS] Connect exception:', errMsg)
        this.lastError = errMsg
        this.state = 'error'
        reject(err)
      }
    })
  }

  /**
   * Desconectar del WebSocket
   */
  disconnect(): void {
    this.rejectAllPending(new Error('Disconnected'))
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.state = 'disconnected'
    this.socketOpen = false // FIX 033
    this.handshakeComplete = false
    this.connectResult = null
    // FIX 041: Reset challenge state
    this.connectChallengeSeen = false
    this.connectChallengeNonce = null
    this.connectChallengeResolver = null
  }

  /**
   * Enviar request RPC y esperar respuesta
   * FIX 033: Allow 'connect' method when socket is open (before handshake complete)
   */
  async request(method: string, params?: unknown): Promise<unknown> {
    // FIX 033: For 'connect' method, only require socket to be open
    if (method === 'connect') {
      if (!this.ws || !this.socketOpen) {
        throw new Error('Socket not open')
      }
    } else {
      // For all other methods, require full connection and handshake
      if (!this.ws || this.state !== 'connected') {
        throw new Error('Not connected')
      }
      if (!this.handshakeComplete) {
        throw new Error('Handshake not complete')
      }
    }

    const id = this.generateId()
    const frame: RpcRequest = {
      type: 'req',
      id,
      method,
      params
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Request timeout: ${method}`))
      }, this.requestTimeoutMs)

      this.pendingRequests.set(id, { resolve, reject, timeout })

      try {
        this.ws!.send(JSON.stringify(frame))
      } catch (err) {
        clearTimeout(timeout)
        this.pendingRequests.delete(id)
        reject(err)
      }
    })
  }

  /**
   * Enviar notificación (sin esperar respuesta)
   */
  notify(method: string, params?: unknown): boolean {
    if (!this.isConnected()) {
      return false
    }

    // Notificaciones no tienen id
    const frame = {
      type: 'notify',
      method,
      params
    }

    try {
      this.ws!.send(JSON.stringify(frame))
      return true
    } catch {
      return false
    }
  }

  /**
   * Registrar handler para evento del servidor
   */
  onEvent(event: string, handler: RpcEventHandler): void {
    const handlers = this.eventHandlers.get(event) || []
    handlers.push(handler)
    this.eventHandlers.set(event, handlers)
  }

  /**
   * Remover handler de evento
   */
  offEvent(event: string, handler: RpcEventHandler): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index !== -1) {
        handlers.splice(index, 1)
      }
    }
  }

  /**
   * FIX 041: Wait for connect.challenge event from server
   * CRITICAL: OpenClaw requires connect.challenge before connect.
   * Do not send connect before receiving challenge. Changing this breaks WS completely.
   */
  private async waitForConnectChallenge(timeoutMs: number = 10000): Promise<void> {
    // If already seen, return immediately
    if (this.connectChallengeSeen) {
      return
    }

    console.log('[WS] Waiting for connect.challenge event...')

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.connectChallengeResolver = null
        reject(new Error('Timeout waiting for connect.challenge'))
      }, timeoutMs)

      this.connectChallengeResolver = () => {
        clearTimeout(timeout)
        this.connectChallengeResolver = null
        resolve()
      }

      // Check again in case it arrived while setting up
      if (this.connectChallengeSeen) {
        clearTimeout(timeout)
        this.connectChallengeResolver = null
        resolve()
      }
    })
  }

  /**
   * Realizar handshake con Gateway
   * Protocolo oficial OpenClaw Gateway
   *
   * FIX 041: CRITICAL - Must wait for connect.challenge before sending connect
   * Flow: open -> wait for connect.challenge -> send connect -> hello-ok
   *
   * FIX 033: Configurable client.id/mode, variants support, schema error detection
   * Intenta variantes de auth y client identity si falla
   */
  private async performHandshake(): Promise<void> {
    // FIX 041: CRITICAL - Wait for connect.challenge before sending connect
    // OpenClaw Gateway sends connect.challenge immediately after socket opens
    // We MUST wait for it before sending connect request
    try {
      await this.waitForConnectChallenge(10000)
      console.log('[WS] CONNECT CHALLENGE RECEIVED, nonce:', this.connectChallengeNonce || 'none')
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error('[WS] Failed waiting for connect.challenge:', errMsg)
      throw new Error(`Missing connect.challenge: ${errMsg}`)
    }

    // FIX 033: Build client identity variants to try
    const clientVariants: Array<{ id: string; mode: string }> = []

    // Si hay variantes configuradas, parsearlas (formato "id:mode,id:mode")
    if (this.wsClientVariants) {
      const parts = this.wsClientVariants.split(',')
      for (const part of parts) {
        const [id, mode] = part.trim().split(':')
        if (id && mode) {
          clientVariants.push({ id: id.trim(), mode: mode.trim() })
        }
      }
    }

    // Variante principal: desde config/env
    clientVariants.push({ id: this.wsClientId, mode: this.wsClientMode })

    // FIX 034: Fallback oficial OpenClaw Gateway
    if (!clientVariants.some(v => v.id === 'gateway-client' && v.mode === 'backend')) {
      clientVariants.push({ id: 'gateway-client', mode: 'backend' })
    }

    // Variantes de auth a probar
    const authVariants: Array<{ token: string } | undefined> = []

    if (this.apiKey) {
      // Variante 1: token directo
      authVariants.push({ token: this.apiKey })
      // Variante 2: Bearer prefix
      authVariants.push({ token: `Bearer ${this.apiKey}` })
    }
    // Variante 3: sin auth
    authVariants.push(undefined)

    let lastError: Error | null = null

    // Try all combinations of client identity and auth
    for (const clientIdentity of clientVariants) {
      for (const auth of authVariants) {
        const connectParams: ConnectParams = {
          role: 'operator',
          scopes: ['operator.read', 'operator.write'],
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: clientIdentity.id,
            version: '1.0.0',
            platform: typeof process !== 'undefined' ? process.platform : 'unknown',
            mode: clientIdentity.mode
          },
          caps: [],
          commands: [],
          permissions: {},
          locale: 'en',
          userAgent: 'granclaw-client',
          auth
        }

        // Log sanitizado (sin token real)
        const sanitizedParams = {
          ...connectParams,
          auth: auth ? { token: '[REDACTED]' } : undefined
        }
        console.log('[WS] CONNECT SENT:', JSON.stringify(sanitizedParams))

        try {
          const result = await this.request('connect', connectParams)
          console.log('[WS] HELLO OK:', JSON.stringify(result))
          this.lastHandshakeResponse = result
          this.connectResult = result as ConnectResult
          this.handshakeComplete = true
          console.log('[WS] Handshake succeeded with client:', clientIdentity.id + ':' + clientIdentity.mode,
            ', auth:', auth ? (auth.token.startsWith('Bearer') ? 'Bearer' : 'raw') : 'none')
          return
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err))
          const errMsg = lastError.message

          // FIX 033: Detect schema validation errors
          if (errMsg.includes('INVALID_REQUEST') || errMsg.includes('/client/id') || errMsg.includes('/client/mode')) {
            console.warn('[WS] Schema validation error - client identity rejected:', clientIdentity.id + ':' + clientIdentity.mode)
            console.warn('[WS] Error details:', errMsg)
            // Continue to next client variant
            break // Skip remaining auth variants for this client identity
          }

          console.log('[WS] Variant failed:',
            'client=' + clientIdentity.id + ':' + clientIdentity.mode,
            ', auth=' + (auth ? (auth.token.startsWith('Bearer') ? 'Bearer' : 'raw') : 'none'),
            '-', errMsg)
        }
      }
    }

    this.handshakeComplete = false
    this.lastError = lastError?.message || 'All variants failed'
    throw new Error(`Handshake failed: ${this.lastError}`)
  }

  /**
   * Procesar frame entrante
   */
  private handleIncomingFrame(data: string): void {
    console.log('[WS] RAW MESSAGE:', data.substring(0, 500))
    try {
      const frame = JSON.parse(data) as RpcFrame
      console.log('[WS] PARSED:', JSON.stringify(frame).substring(0, 500))

      if (frame.type === 'res') {
        this.handleResponse(frame as RpcResponse)
      } else if (frame.type === 'event') {
        this.handleEvent(frame as RpcEvent)
      }
    } catch (err) {
      console.error('[WS] Parse error:', err instanceof Error ? err.message : 'Unknown')
    }
  }

  /**
   * Manejar response RPC
   * Protocolo documentado: ok + payload/error
   */
  private handleResponse(response: RpcResponse): void {
    const pending = this.pendingRequests.get(response.id)
    if (!pending) {
      return
    }

    clearTimeout(pending.timeout)
    this.pendingRequests.delete(response.id)

    if (response.ok) {
      pending.resolve(response.payload)
    } else {
      const errorMsg = typeof response.error === 'string'
        ? response.error
        : (response.error as { message?: string })?.message || 'Unknown RPC error'
      pending.reject(new Error(errorMsg))
    }
  }

  /**
   * Manejar evento del servidor
   * Protocolo documentado: payload en lugar de data
   *
   * FIX 041: Handle connect.challenge event specially
   */
  private handleEvent(event: RpcEvent): void {
    // FIX 041: CRITICAL - Handle connect.challenge event
    // This event MUST be received before sending connect request
    if (event.event === 'connect.challenge') {
      console.log('[WS] CONNECT CHALLENGE RECEIVED')
      this.connectChallengeSeen = true
      // Extract nonce if present (do NOT add to connect params - breaks schema)
      const payload = event.payload as { nonce?: string } | undefined
      this.connectChallengeNonce = payload?.nonce || null
      if (this.connectChallengeNonce) {
        console.log('[WS] Challenge nonce:', this.connectChallengeNonce)
      }
      // Resolve waiting promise if any
      if (this.connectChallengeResolver) {
        this.connectChallengeResolver()
      }
      return // Don't pass to regular handlers during handshake
    }

    const handlers = this.eventHandlers.get(event.event)
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(event.payload)
        } catch {
          // Handler error - ignorar
        }
      })
    }

    // También notificar a handler wildcard si existe
    const wildcardHandlers = this.eventHandlers.get('*')
    if (wildcardHandlers) {
      wildcardHandlers.forEach((handler) => {
        try {
          handler({ event: event.event, payload: event.payload })
        } catch {
          // Handler error - ignorar
        }
      })
    }
  }

  /**
   * Rechazar todas las requests pendientes
   */
  private rejectAllPending(error: Error): void {
    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeout)
      pending.reject(error)
    })
    this.pendingRequests.clear()
  }

  /**
   * Generar ID único para requests
   */
  private generateId(): RpcId {
    return `rpc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }
}
