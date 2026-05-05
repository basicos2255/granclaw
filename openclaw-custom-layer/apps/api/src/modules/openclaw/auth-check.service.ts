/**
 * OpenClaw Auth Check Service
 * Valida autenticación contra todas las superficies OpenClaw:
 * REST, WebSocket y /tools/invoke
 */

import { OpenClawWsClient } from '@granclaw/openclaw-adapter'

/**
 * Estado de autenticación por superficie
 */
export type AuthStatus = 'ok' | 'fail' | 'not_configured'

/**
 * Detalles de validación de auth
 */
export interface AuthCheckDetails {
  restStatus?: number
  restError?: string
  wsConnected?: boolean
  wsHandshakeComplete?: boolean
  wsError?: string
  wsHandshakeResponse?: unknown
  toolsOk?: boolean
  toolsError?: string
}

/**
 * Respuesta de validación de auth completa
 */
export interface AuthCheckResponse {
  rest: AuthStatus
  ws: AuthStatus
  tools: AuthStatus
  details: AuthCheckDetails
  timestamp: string
}

/**
 * Lee configuración de entorno
 */
function getEnvConfig() {
  return {
    baseUrl: process.env.OPENCLAW_BASE_URL || null,
    wsUrl: process.env.OPENCLAW_WS_URL || null,
    apiKey: process.env.OPENCLAW_API_KEY || null
  }
}

/**
 * Valida auth REST contra OpenClaw
 * Intenta GET /v1/models como endpoint seguro
 */
async function checkRestAuth(): Promise<{ status: AuthStatus; httpStatus?: number; error?: string }> {
  const config = getEnvConfig()

  if (!config.baseUrl) {
    return { status: 'not_configured' }
  }

  if (!config.apiKey) {
    return { status: 'fail', error: 'OPENCLAW_API_KEY not configured' }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    // Intentar GET /v1/models como endpoint estándar OpenAI-compatible
    const response = await fetch(`${config.baseUrl}/v1/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      console.log('[AUTH-CHECK] REST auth OK:', response.status)
      return { status: 'ok', httpStatus: response.status }
    }

    if (response.status === 401 || response.status === 403) {
      console.warn('[AUTH-CHECK] REST auth FAIL:', response.status)
      return { status: 'fail', httpStatus: response.status, error: `HTTP ${response.status}` }
    }

    // Otros errores (404, 500, etc) - puede que endpoint no exista
    console.warn('[AUTH-CHECK] REST endpoint error:', response.status)
    return { status: 'fail', httpStatus: response.status, error: `HTTP ${response.status}` }
  } catch (err) {
    clearTimeout(timeoutId)
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[AUTH-CHECK] REST auth error:', errorMsg)
    return { status: 'fail', error: errorMsg }
  }
}

/**
 * Valida auth WebSocket contra OpenClaw Gateway
 * Intenta connect y verifica handshake
 */
async function checkWsAuth(): Promise<{
  status: AuthStatus
  connected?: boolean
  handshakeComplete?: boolean
  error?: string
  handshakeResponse?: unknown
}> {
  const config = getEnvConfig()

  if (!config.wsUrl) {
    return { status: 'not_configured' }
  }

  const wsClient = new OpenClawWsClient({
    wsUrl: config.wsUrl,
    apiKey: config.apiKey ?? undefined
  })

  try {
    // Intentar conexión con timeout
    const connectPromise = wsClient.connect()
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('WS connect timeout')), 10000)
    })

    await Promise.race([connectPromise, timeoutPromise])

    const connected = wsClient.isConnected()
    const handshakeComplete = wsClient.isHandshakeComplete()
    const handshakeResponse = wsClient.getLastHandshakeResponse()
    const lastError = wsClient.getLastError()

    // Limpiar conexión
    wsClient.disconnect()

    if (connected && handshakeComplete) {
      console.log('[AUTH-CHECK] WS auth OK: connected and handshake complete')
      return { status: 'ok', connected: true, handshakeComplete: true, handshakeResponse }
    }

    if (connected && !handshakeComplete) {
      console.warn('[AUTH-CHECK] WS connected but handshake failed')
      return { status: 'fail', connected: true, handshakeComplete: false, error: lastError || 'Handshake failed', handshakeResponse }
    }

    return { status: 'fail', connected: false, handshakeComplete: false, error: lastError || 'Connection failed' }
  } catch (err) {
    // Asegurar desconexión en caso de error
    const lastError = wsClient.getLastError()
    const handshakeResponse = wsClient.getLastHandshakeResponse()
    try {
      wsClient.disconnect()
    } catch {
      // Ignorar error de disconnect
    }

    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[AUTH-CHECK] WS auth error:', errorMsg)
    return { status: 'fail', connected: false, handshakeComplete: false, error: lastError || errorMsg, handshakeResponse }
  }
}

/**
 * Valida auth /tools/invoke contra OpenClaw
 * Intenta invocar una tool de prueba
 */
async function checkToolsAuth(): Promise<{ status: AuthStatus; ok?: boolean; error?: string }> {
  const config = getEnvConfig()

  if (!config.baseUrl) {
    return { status: 'not_configured' }
  }

  if (!config.apiKey) {
    return { status: 'fail', error: 'OPENCLAW_API_KEY not configured' }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    // Intentar invocar tool con payload mínimo
    // Usamos una tool que probablemente no exista para verificar auth
    const response = await fetch(`${config.baseUrl}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tool: '__auth_check_ping__',
        action: 'json',
        args: {},
        sessionKey: 'main'
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    // 401/403 = auth fail
    if (response.status === 401 || response.status === 403) {
      console.warn('[AUTH-CHECK] Tools auth FAIL:', response.status)
      return { status: 'fail', ok: false, error: `HTTP ${response.status} Forbidden` }
    }

    // Cualquier otra respuesta (200, 400, 404, etc) indica que auth pasó
    // El error de "tool not found" es esperado y válido
    const data = await response.json().catch(() => ({}))

    // Si tenemos respuesta JSON, auth funcionó
    console.log('[AUTH-CHECK] Tools auth OK (endpoint accessible)')
    return { status: 'ok', ok: true }
  } catch (err) {
    clearTimeout(timeoutId)
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[AUTH-CHECK] Tools auth error:', errorMsg)
    return { status: 'fail', ok: false, error: errorMsg }
  }
}

/**
 * Ejecuta validación completa de auth contra todas las superficies OpenClaw
 */
export async function checkOpenClawAuth(): Promise<AuthCheckResponse> {
  console.log('[AUTH-CHECK] Starting auth validation...')

  // Ejecutar checks en paralelo
  const [restResult, wsResult, toolsResult] = await Promise.all([
    checkRestAuth(),
    checkWsAuth(),
    checkToolsAuth()
  ])

  const response: AuthCheckResponse = {
    rest: restResult.status,
    ws: wsResult.status,
    tools: toolsResult.status,
    details: {
      restStatus: restResult.httpStatus,
      restError: restResult.error,
      wsConnected: wsResult.connected,
      wsHandshakeComplete: wsResult.handshakeComplete,
      wsError: wsResult.error,
      wsHandshakeResponse: wsResult.handshakeResponse,
      toolsOk: toolsResult.ok,
      toolsError: toolsResult.error
    },
    timestamp: new Date().toISOString()
  }

  console.log('[AUTH-CHECK] Validation complete:', {
    rest: response.rest,
    ws: response.ws,
    tools: response.tools
  })

  return response
}
