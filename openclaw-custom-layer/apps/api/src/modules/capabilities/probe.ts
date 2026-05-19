/**
 * OpenClaw Capability Probe Service
 * P6.18: Real evidence-based readiness probing
 * P6.18D: Extended with CLI/plugin/tool/security probing
 *
 * This service performs ACTUAL connectivity checks to determine if capabilities
 * are really available, replacing the hardcoded CAPABILITY_IMPLEMENTATION_STATUS.
 */

import type {
  ReadinessState,
  ProbeEvidence,
  RealCapabilityReadiness,
  RecoveryAction,
  OpenClawProbeResult,
  SystemReadinessSnapshot,
  SystemCapabilityType,
  CLIProbeResult,
  ToolInfo,
  PluginInfo,
  ExtendedOpenClawProbeResult,
  EvidenceSource,
  CapabilityGateCheckResult
} from './types'
import { getEnabledCapabilityByKey } from './service'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

// ============================================================================
// CONFIGURATION
// ============================================================================

function getEnvConfig() {
  return {
    baseUrl: process.env.OPENCLAW_BASE_URL || null,
    wsUrl: process.env.OPENCLAW_WS_URL || null,
    apiKey: process.env.OPENCLAW_API_KEY || null,
    webhookUrl: process.env.OPENCLAW_WEBHOOK_URL || null
  }
}

// ============================================================================
// P6.18: CAPABILITY DEFINITIONS (what each capability needs)
// ============================================================================

interface CapabilityDefinition {
  key: SystemCapabilityType | string
  displayName: string
  isCore: boolean
  providerChain: string[]
  requiresOpenClaw: boolean
  requiresApproval: boolean
  checkFn?: (tenantId: string) => Promise<{ state: ReadinessState; evidence?: ProbeEvidence }>
}

const CAPABILITY_DEFINITIONS: CapabilityDefinition[] = [
  {
    key: 'browser',
    displayName: 'Navegador Web',
    isCore: false,
    providerChain: ['openclaw', 'gateway', 'playwright'],
    requiresOpenClaw: true,
    requiresApproval: true
  },
  {
    key: 'download',
    displayName: 'Descargas',
    isCore: false,
    providerChain: ['openclaw', 'gateway', 'http-client'],
    requiresOpenClaw: true,
    requiresApproval: true
  },
  {
    key: 'filesystem',
    displayName: 'Sistema de Archivos',
    isCore: true,
    providerChain: ['local', 'node-fs'],
    requiresOpenClaw: false,
    requiresApproval: true
  },
  {
    key: 'install_app',
    displayName: 'Instalar Aplicaciones',
    isCore: false,
    providerChain: ['local', 'os-shell'],
    requiresOpenClaw: false,
    requiresApproval: true
  },
  {
    key: 'web_search',
    displayName: 'Busqueda Web',
    isCore: true,
    providerChain: ['openclaw', 'gateway', 'search-api'],
    requiresOpenClaw: true,
    requiresApproval: false
  },
  {
    key: 'ftp',
    displayName: 'FTP',
    isCore: false,
    providerChain: ['local', 'ftp-client'],
    requiresOpenClaw: false,
    requiresApproval: true
  },
  {
    key: 'email',
    displayName: 'Correo Electronico',
    isCore: false,
    providerChain: ['external', 'smtp'],
    requiresOpenClaw: false,
    requiresApproval: true
  },
  {
    key: 'whatsapp',
    displayName: 'WhatsApp',
    isCore: false,
    providerChain: ['external', 'whatsapp-business-api'],
    requiresOpenClaw: false,
    requiresApproval: true
  },
  {
    key: 'calendar',
    displayName: 'Calendario',
    isCore: false,
    providerChain: ['external', 'google-calendar-api'],
    requiresOpenClaw: false,
    requiresApproval: true
  },
  {
    key: 'screenshot',
    displayName: 'Capturas de Pantalla',
    isCore: false,
    providerChain: ['openclaw', 'gateway', 'playwright'],
    requiresOpenClaw: true,
    requiresApproval: false
  },
  {
    key: 'clipboard',
    displayName: 'Portapapeles',
    isCore: false,
    providerChain: ['local', 'os-clipboard'],
    requiresOpenClaw: false,
    requiresApproval: true
  }
]

// ============================================================================
// P6.18: OPENCLAW GATEWAY PROBE
// ============================================================================

let lastGatewayProbe: OpenClawProbeResult | null = null
let lastGatewayProbeTime = 0
const GATEWAY_PROBE_CACHE_MS = 30000 // Cache for 30 seconds

/**
 * P6.18: Probe OpenClaw Gateway with real HTTP request
 */
export async function probeOpenClawGateway(forceRefresh = false): Promise<OpenClawProbeResult> {
  const now = Date.now()

  // Return cached result if fresh
  if (!forceRefresh && lastGatewayProbe && (now - lastGatewayProbeTime) < GATEWAY_PROBE_CACHE_MS) {
    return lastGatewayProbe
  }

  const config = getEnvConfig()
  const probedAt = new Date().toISOString()

  // Check if configured
  if (!config.baseUrl) {
    const result: OpenClawProbeResult = {
      state: 'not_configured',
      gateway: {
        configured: false,
        reachable: false,
        error: 'OPENCLAW_BASE_URL no esta configurada'
      },
      websocket: {
        configured: !!config.wsUrl,
        connected: false,
        handshakeComplete: false
      },
      probedAt
    }
    lastGatewayProbe = result
    lastGatewayProbeTime = now
    return result
  }

  // Probe gateway health endpoint
  let gatewayReachable = false
  let gatewayLatency: number | undefined
  let gatewayVersion: string | undefined
  let gatewayError: string | undefined

  try {
    const healthUrl = `${config.baseUrl}/health`
    const startTime = Date.now()

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {},
      signal: controller.signal
    })

    clearTimeout(timeout)
    gatewayLatency = Date.now() - startTime

    if (response.ok) {
      gatewayReachable = true
      try {
        const data = await response.json() as { version?: string; v?: string }
        gatewayVersion = data.version || data.v || undefined
      } catch {
        // OK response but no JSON body is still success
      }
    } else {
      gatewayError = `HTTP ${response.status}: ${response.statusText}`
    }
  } catch (err) {
    const error = err as Error
    if (error.name === 'AbortError') {
      gatewayError = 'Timeout: Gateway no responde en 5s'
    } else {
      gatewayError = `Error de conexion: ${error.message}`
    }
  }

  // Determine overall state
  let state: ReadinessState = 'unknown'
  if (!config.baseUrl) {
    state = 'not_configured'
  } else if (!gatewayReachable) {
    state = 'gateway_unreachable'
  } else {
    state = 'ready'
  }

  const result: OpenClawProbeResult = {
    state,
    gateway: {
      configured: true,
      reachable: gatewayReachable,
      latencyMs: gatewayLatency,
      version: gatewayVersion,
      error: gatewayError
    },
    websocket: {
      configured: !!config.wsUrl,
      connected: false, // WS connection state would need actual WS client
      handshakeComplete: false
    },
    probedAt
  }

  lastGatewayProbe = result
  lastGatewayProbeTime = now

  console.log(`[P6.18 Probe] Gateway probe completed: state=${state} reachable=${gatewayReachable} latency=${gatewayLatency}ms`)

  return result
}

// ============================================================================
// P6.18: CAPABILITY READINESS PROBE
// ============================================================================

/**
 * P6.18: Get recovery actions for a capability state
 */
function getRecoveryActions(
  capability: string,
  state: ReadinessState,
  requiresApproval: boolean,
  tenantId: string
): RecoveryAction[] {
  const actions: RecoveryAction[] = []

  switch (state) {
    case 'not_configured':
      actions.push({
        id: 'configure',
        label: 'Configurar',
        type: 'navigate',
        target: '/control/setup'
      })
      break

    case 'gateway_unreachable':
      actions.push({
        id: 'retry',
        label: 'Reintentar conexion',
        type: 'retry'
      })
      actions.push({
        id: 'setup',
        label: 'Ver configuracion',
        type: 'navigate',
        target: '/control/setup'
      })
      break

    case 'unavailable':
      if (requiresApproval) {
        actions.push({
          id: 'approve',
          label: 'Solicitar aprobacion',
          type: 'navigate',
          target: '/control/tools'
        })
      }
      break

    case 'plugin_missing':
      actions.push({
        id: 'install',
        label: 'Ver instrucciones',
        type: 'navigate',
        target: '/control/setup'
      })
      break

    case 'auth_expired':
      actions.push({
        id: 'reauth',
        label: 'Renovar autenticacion',
        type: 'navigate',
        target: '/control/settings'
      })
      break
  }

  return actions
}

/**
 * P6.18C: Generate status message for capability state
 */
function getStatusMessage(
  displayName: string,
  state: ReadinessState,
  evidence?: ProbeEvidence
): string {
  switch (state) {
    case 'ready':
      return `${displayName} esta disponible y funcionando correctamente${evidence?.latencyMs ? ` (${evidence.latencyMs}ms)` : ''}.`
    case 'unavailable':
      return `${displayName} no esta disponible en esta instancia de GranClaw.`
    case 'not_configured':
      return `${displayName} requiere configuracion adicional (OPENCLAW_BASE_URL).`
    case 'gateway_unreachable':
      return `${displayName} no esta disponible porque OpenClaw Gateway no responde.`
    case 'cli_unavailable':
      return `${displayName} requiere que el CLI local este ejecutandose.`
    case 'plugin_missing':
      return `${displayName} requiere un plugin que no esta instalado.`
    case 'auth_expired':
      return `${displayName} requiere renovar la autenticacion.`
    case 'rate_limited':
      return `${displayName} no esta disponible temporalmente (limite de uso alcanzado).`
    case 'unknown':
      return `${displayName}: Gateway conectado pero disponibilidad no verificada.`
    default:
      return `Estado de ${displayName} desconocido.`
  }
}

/**
 * P6.18C: Probe a single capability's readiness
 * CRITICAL: Gateway being alive does NOT mean capabilities are ready.
 * We must have evidence of actual tool/plugin availability.
 */
export async function probeCapabilityReadiness(
  tenantId: string,
  capabilityKey: string
): Promise<RealCapabilityReadiness> {
  const definition = CAPABILITY_DEFINITIONS.find(d => d.key === capabilityKey)

  if (!definition) {
    return {
      capability: capabilityKey,
      displayName: capabilityKey,
      state: 'unavailable',
      isCore: false,
      providerChain: ['unknown'],
      statusMessage: `La capacidad "${capabilityKey}" no es reconocida por GranClaw.`,
      recoveryActions: []
    }
  }

  // Check if approved for tenant
  const approvedCapability = getEnabledCapabilityByKey(tenantId, capabilityKey)
  const isApproved = !!approvedCapability

  let state: ReadinessState = 'unknown'
  let evidence: ProbeEvidence | undefined
  let activeProvider: string | undefined

  // If requires OpenClaw, check gateway first
  if (definition.requiresOpenClaw) {
    const gatewayProbe = await probeOpenClawGateway()

    if (gatewayProbe.state === 'not_configured') {
      state = 'not_configured'
      evidence = {
        probedAt: gatewayProbe.probedAt,
        latencyMs: 0,
        target: 'OPENCLAW_BASE_URL',
        error: 'OpenClaw no esta configurado'
      }
    } else if (gatewayProbe.state !== 'ready') {
      state = 'gateway_unreachable'
      evidence = {
        probedAt: gatewayProbe.probedAt,
        latencyMs: gatewayProbe.gateway.latencyMs || 0,
        target: process.env.OPENCLAW_BASE_URL || 'not_configured',
        error: gatewayProbe.gateway.error
      }
    } else {
      // P6.18C: Gateway is reachable, but we CANNOT assume capability is ready
      // without actual tool/plugin verification. Mark as 'unknown' or 'plugin_missing'
      // depending on whether we have any evidence of the tool existing.

      if (definition.requiresApproval && !isApproved) {
        // Needs approval but not approved
        state = 'unavailable'
        evidence = {
          probedAt: gatewayProbe.probedAt,
          latencyMs: gatewayProbe.gateway.latencyMs || 0,
          target: process.env.OPENCLAW_BASE_URL || ''
        }
      } else {
        // P6.18D4: Gateway is alive - now check if the specific tool is available
        // by calling /tools endpoint and verifying the required tool exists
        const toolsProbe = await probeGatewayTools()

        if (toolsProbe.available && toolsProbe.list && toolsProbe.list.length > 0) {
          // P6.18D4: We have tool list - check if required tool for this capability exists
          const toolCheck = hasRequiredToolForCapability(capabilityKey, toolsProbe.list)

          if (toolCheck.hasRequired && toolCheck.matchedTool) {
            // P6.18D4: Tool found - capability is READY with evidence
            state = 'ready'
            activeProvider = 'openclaw'
            evidence = {
              probedAt: toolsProbe.probedAt,
              latencyMs: gatewayProbe.gateway.latencyMs || 0,
              target: process.env.OPENCLAW_BASE_URL || '',
              responseSummary: `Tool encontrada: ${toolCheck.matchedTool}`
            }
          } else {
            // P6.18D4: Tools endpoint available but required tool not found
            state = 'plugin_missing'
            activeProvider = 'openclaw'
            evidence = {
              probedAt: toolsProbe.probedAt,
              latencyMs: gatewayProbe.gateway.latencyMs || 0,
              target: process.env.OPENCLAW_BASE_URL || '',
              responseSummary: `Gateway conectado pero tool ${capabilityKey} no encontrada en ${toolsProbe.list.length} tools disponibles`
            }
          }
        } else if (toolsProbe.error) {
          // P6.18D4: Tools endpoint not available or errored
          state = 'unknown'
          activeProvider = 'openclaw'
          evidence = {
            probedAt: toolsProbe.probedAt,
            latencyMs: gatewayProbe.gateway.latencyMs || 0,
            target: process.env.OPENCLAW_BASE_URL || '',
            error: toolsProbe.error,
            responseSummary: 'Gateway conectado pero endpoint /tools no disponible'
          }
        } else {
          // P6.18D4: No error but no tools - mark as unknown
          state = 'unknown'
          activeProvider = 'openclaw'
          evidence = {
            probedAt: gatewayProbe.probedAt,
            latencyMs: gatewayProbe.gateway.latencyMs || 0,
            target: process.env.OPENCLAW_BASE_URL || '',
            responseSummary: 'Gateway conectado pero sin tools disponibles'
          }
        }
      }
    }
  } else {
    // Local capability - check if approved
    if (definition.requiresApproval && !isApproved) {
      state = 'unavailable'
    } else {
      // P6.18C: For local capabilities that don't require OpenClaw,
      // we can be more confident since they run locally.
      // filesystem is locally implemented, so mark ready.
      // Other local capabilities depend on their actual implementation.
      if (definition.key === 'filesystem') {
        state = 'ready'
        activeProvider = 'local'
      } else {
        // Other local capabilities - check if actually implemented
        state = 'unavailable'
        activeProvider = 'local'
      }
      evidence = {
        probedAt: new Date().toISOString(),
        latencyMs: 0,
        target: 'local'
      }
    }
  }

  const statusMessage = getStatusMessage(definition.displayName, state, evidence)
  const recoveryActions = getRecoveryActions(
    capabilityKey,
    state,
    definition.requiresApproval,
    tenantId
  )

  return {
    capability: capabilityKey,
    displayName: definition.displayName,
    state,
    evidence,
    isCore: definition.isCore,
    providerChain: definition.providerChain,
    activeProvider,
    statusMessage,
    recoveryActions: recoveryActions.length > 0 ? recoveryActions : undefined,
    lastSuccessfulProbe: state === 'ready' ? evidence?.probedAt : undefined
  }
}

/**
 * P6.18: Probe all capabilities and return full snapshot
 */
export async function probeAllCapabilities(
  tenantId: string,
  forceRefresh = false
): Promise<SystemReadinessSnapshot> {
  // Probe OpenClaw gateway first (used by multiple capabilities)
  const openclaw = await probeOpenClawGateway(forceRefresh)

  // Probe each capability
  const capabilities: RealCapabilityReadiness[] = []

  for (const def of CAPABILITY_DEFINITIONS) {
    const readiness = await probeCapabilityReadiness(tenantId, def.key)
    capabilities.push(readiness)
  }

  // Calculate summary - P6.18D: Include unknown count
  const summary = {
    total: capabilities.length,
    ready: capabilities.filter(c => c.state === 'ready').length,
    unavailable: capabilities.filter(c => c.state === 'unavailable').length,
    notConfigured: capabilities.filter(c => c.state === 'not_configured').length,
    degraded: capabilities.filter(c =>
      c.state === 'gateway_unreachable' ||
      c.state === 'cli_unavailable' ||
      c.state === 'auth_expired' ||
      c.state === 'rate_limited'
    ).length,
    unknown: capabilities.filter(c => c.state === 'unknown').length
  }

  console.log(`[P6.18D Probe] Full snapshot: ready=${summary.ready}/${summary.total} unavailable=${summary.unavailable} unknown=${summary.unknown} degraded=${summary.degraded}`)

  return {
    openclaw,
    capabilities,
    summary,
    snapshotAt: new Date().toISOString()
  }
}

/**
 * P6.18: Check if a specific capability is ready for execution
 * Used by task gates to determine if task can proceed
 */
export async function isCapabilityReady(
  tenantId: string,
  capabilityKey: string
): Promise<{ ready: boolean; state: ReadinessState; message: string }> {
  const readiness = await probeCapabilityReadiness(tenantId, capabilityKey)

  return {
    ready: readiness.state === 'ready',
    state: readiness.state,
    message: readiness.statusMessage
  }
}

/**
 * P6.18: Get capability definitions for UI
 */
export function getCapabilityDefinitions(): CapabilityDefinition[] {
  return CAPABILITY_DEFINITIONS
}

// ============================================================================
// P6.18D: CLI PROBE (NON-DESTRUCTIVE)
// ============================================================================

const CLI_PROBE_TIMEOUT_MS = 3000
const CLI_ALLOWLISTED_COMMANDS = [
  ['openclaw', '--version'],
  ['openclaw', 'status', '--json'],
  ['openclaw', 'plugins', 'list', '--json'],
  ['openclaw', 'tools', 'list', '--json']
]

/**
 * P6.18D: Redact sensitive information from CLI output
 */
function redactSensitiveData(output: string): string {
  // Redact common patterns
  return output
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/apiKey["']?\s*[:=]\s*["']?[a-zA-Z0-9._-]+/gi, 'apiKey: [REDACTED]')
    .replace(/password["']?\s*[:=]\s*["']?[^\s"']+/gi, 'password: [REDACTED]')
    .replace(/token["']?\s*[:=]\s*["']?[a-zA-Z0-9._-]+/gi, 'token: [REDACTED]')
    .replace(/secret["']?\s*[:=]\s*["']?[^\s"']+/gi, 'secret: [REDACTED]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]')
    .slice(0, 500) // Limit output length
}

/**
 * P6.18D: Probe OpenClaw CLI (non-destructive)
 * Uses execFile with allowlisted commands only
 */
export async function probeCLI(): Promise<CLIProbeResult> {
  const probedAt = new Date().toISOString()
  const commandsTried: string[] = []

  // Try to detect CLI
  try {
    const [cmd, ...args] = CLI_ALLOWLISTED_COMMANDS[0]
    commandsTried.push(`${cmd} ${args.join(' ')}`)

    const { stdout, stderr } = await execFileAsync(cmd, args, {
      timeout: CLI_PROBE_TIMEOUT_MS,
      maxBuffer: 1024 * 100 // 100KB max
    })

    const output = stdout || stderr
    const versionMatch = output.match(/v?(\d+\.\d+\.\d+)/)
    const version = versionMatch ? versionMatch[1] : undefined

    return {
      detected: true,
      running: true,
      version,
      outputSummary: redactSensitiveData(output),
      commandsTried,
      probedAt
    }
  } catch (err) {
    const error = err as Error & { code?: string }

    // ENOENT means command not found
    if (error.code === 'ENOENT') {
      return {
        detected: false,
        running: false,
        error: 'OpenClaw CLI not found in PATH',
        commandsTried,
        probedAt
      }
    }

    // ETIMEDOUT means command exists but timed out
    if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      return {
        detected: true,
        running: false,
        error: 'CLI timeout - may be hung or slow',
        commandsTried,
        probedAt
      }
    }

    return {
      detected: false,
      running: false,
      error: `CLI probe failed: ${error.message}`,
      commandsTried,
      probedAt
    }
  }
}

// ============================================================================
// P6.18D: GATEWAY TOOLS/PLUGINS PROBE
// P6.18D5: Support multiple response shapes for /tools endpoint
// ============================================================================

/**
 * P6.18D5: Normalize gateway tools payload to handle multiple response shapes
 *
 * Accepts:
 * 1. Array direct: [{id:"web_search"}, {id:"browser"}]
 * 2. Object with tools: {tools:[{id:"web_search"}]}
 * 3. Wrapper with data.tools: {data:{tools:[{id:"web_search"}]}}
 * 4. Tools with different key names (key, slug, name as id fallback)
 */
function normalizeGatewayToolsPayload(payload: unknown): {
  tools: ToolInfo[]
  normalized: boolean
  parseError?: string
} {
  // Case 1: Array direct
  if (Array.isArray(payload)) {
    const tools: ToolInfo[] = payload
      .filter((item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null
      )
      .map(item => ({
        id: String(item.id || item.key || item.slug || item.name || ''),
        name: String(item.name || item.id || item.key || ''),
        description: typeof item.description === 'string' ? item.description : undefined,
        available: item.available !== false && item.enabled !== false // Default true unless explicitly false
      }))
      .filter(t => t.id.length > 0) // Only keep tools with valid id

    return { tools, normalized: true }
  }

  // Case 2 & 3: Object with tools or data.tools
  if (typeof payload === 'object' && payload !== null) {
    const obj = payload as Record<string, unknown>

    // Try obj.tools first
    if (Array.isArray(obj.tools)) {
      const result = normalizeGatewayToolsPayload(obj.tools)
      return { ...result, normalized: true }
    }

    // Try obj.data.tools (wrapped response)
    if (typeof obj.data === 'object' && obj.data !== null) {
      const data = obj.data as Record<string, unknown>
      if (Array.isArray(data.tools)) {
        const result = normalizeGatewayToolsPayload(data.tools)
        return { ...result, normalized: true }
      }
    }

    // Try obj.items (alternative naming)
    if (Array.isArray(obj.items)) {
      const result = normalizeGatewayToolsPayload(obj.items)
      return { ...result, normalized: true }
    }
  }

  // Not a recognized shape
  return {
    tools: [],
    normalized: false,
    parseError: 'Response shape not recognized (expected array or {tools:[...]})'
  }
}

/**
 * P6.18D: Probe gateway for available tools
 * P6.18D5: Now accepts multiple response shapes
 */
export async function probeGatewayTools(): Promise<{
  available: boolean
  list?: ToolInfo[]
  error?: string
  probedAt: string
  responseShape?: string
}> {
  const config = getEnvConfig()
  const probedAt = new Date().toISOString()

  if (!config.baseUrl) {
    return { available: false, error: 'Gateway not configured', probedAt }
  }

  try {
    const toolsUrl = `${config.baseUrl}/tools`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(toolsUrl, {
      method: 'GET',
      headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {},
      signal: controller.signal
    })

    clearTimeout(timeout)

    if (response.ok) {
      // P6.18D5: Parse and normalize response
      const rawData = await response.json()
      const normalized = normalizeGatewayToolsPayload(rawData)

      if (normalized.tools.length > 0) {
        // Successfully parsed tools
        return {
          available: true,
          list: normalized.tools,
          probedAt,
          responseShape: Array.isArray(rawData) ? 'array_direct' : 'object_wrapped'
        }
      }

      if (normalized.parseError) {
        // Response 200 but unrecognized shape
        return {
          available: true, // Endpoint is available
          list: [],
          error: normalized.parseError,
          probedAt,
          responseShape: 'unknown'
        }
      }

      // Empty tools array is valid
      return {
        available: true,
        list: [],
        probedAt,
        responseShape: 'empty'
      }
    }

    // 404 means endpoint doesn't exist - not an error, just unavailable
    if (response.status === 404) {
      return {
        available: false,
        error: 'Tools endpoint not available',
        probedAt
      }
    }

    return {
      available: false,
      error: `HTTP ${response.status}: ${response.statusText}`,
      probedAt
    }
  } catch (err) {
    const error = err as Error
    return {
      available: false,
      error: error.name === 'AbortError' ? 'Timeout' : error.message,
      probedAt
    }
  }
}

/**
 * P6.18D: Probe gateway for available plugins
 */
export async function probeGatewayPlugins(): Promise<{
  available: boolean
  list?: PluginInfo[]
  error?: string
  probedAt: string
}> {
  const config = getEnvConfig()
  const probedAt = new Date().toISOString()

  if (!config.baseUrl) {
    return { available: false, error: 'Gateway not configured', probedAt }
  }

  try {
    const pluginsUrl = `${config.baseUrl}/plugins`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(pluginsUrl, {
      method: 'GET',
      headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {},
      signal: controller.signal
    })

    clearTimeout(timeout)

    if (response.ok) {
      const data = await response.json() as { plugins?: PluginInfo[] }
      return {
        available: true,
        list: data.plugins || [],
        probedAt
      }
    }

    if (response.status === 404) {
      return {
        available: false,
        error: 'Plugins endpoint not available',
        probedAt
      }
    }

    return {
      available: false,
      error: `HTTP ${response.status}: ${response.statusText}`,
      probedAt
    }
  } catch (err) {
    const error = err as Error
    return {
      available: false,
      error: error.name === 'AbortError' ? 'Timeout' : error.message,
      probedAt
    }
  }
}

// ============================================================================
// P6.18D: CAPABILITY TOOL MAPPING
// ============================================================================

/**
 * P6.18D: Map capability keys to required tool names
 * A capability is only 'ready' if its required tool exists in gateway
 */
const CAPABILITY_TOOL_REQUIREMENTS: Record<string, string[]> = {
  'web_search': ['web_search', 'search', 'web.search', 'web.fetch'],
  'browser': ['browser', 'playwright', 'web.browser', 'puppeteer'],
  'download': ['download', 'fetch', 'http', 'file.download'],
  'screenshot': ['screenshot', 'browser', 'playwright'],
  'email': ['email', 'smtp', 'mail.send'],
  'whatsapp': ['whatsapp', 'whatsapp.send'],
  'calendar': ['calendar', 'google.calendar'],
  'ftp': ['ftp', 'sftp']
}

/**
 * P6.18D: Check if capability has required tool available
 */
export function hasRequiredToolForCapability(
  capabilityKey: string,
  availableTools: ToolInfo[]
): { hasRequired: boolean; matchedTool?: string } {
  const requirements = CAPABILITY_TOOL_REQUIREMENTS[capabilityKey]

  if (!requirements || requirements.length === 0) {
    // No specific tool requirement - treat as not verifiable
    return { hasRequired: false }
  }

  const toolIds = availableTools.map(t => t.id.toLowerCase())
  const toolNames = availableTools.map(t => t.name.toLowerCase())
  const allToolIdentifiers = [...toolIds, ...toolNames]

  for (const req of requirements) {
    if (allToolIdentifiers.some(id => id.includes(req.toLowerCase()))) {
      return { hasRequired: true, matchedTool: req }
    }
  }

  return { hasRequired: false }
}

// ============================================================================
// P6.18D: CAPABILITY GATE CHECK WITH CACHE
// ============================================================================

let lastSnapshotCache: SystemReadinessSnapshot | null = null
let lastSnapshotTime = 0
const SNAPSHOT_CACHE_TTL_MS = 30000 // 30 seconds

/**
 * P6.18D: Get capability gate readiness for task execution
 * Uses cached snapshot if fresh, otherwise probes
 *
 * CRITICAL: This is the authoritative gate check for ALL capability-backed tasks
 */
export async function getCapabilityGateReadiness(
  tenantId: string,
  capabilityKey: string
): Promise<CapabilityGateCheckResult> {
  const now = Date.now()
  const checkedAt = new Date().toISOString()
  let source: EvidenceSource = 'unknown'
  let cacheAgeMs = 0

  // Check cache first
  if (lastSnapshotCache && (now - lastSnapshotTime) < SNAPSHOT_CACHE_TTL_MS) {
    source = 'probe_cache'
    cacheAgeMs = now - lastSnapshotTime

    const cached = lastSnapshotCache.capabilities.find(
      c => c.capability === capabilityKey
    )

    if (cached) {
      const canProceed = cached.state === 'ready'
      return {
        canProceed,
        state: cached.state,
        source,
        message: cached.statusMessage,
        blockingCapabilities: canProceed ? undefined : [{
          ...cached,
          capabilityKey,
          category: 'core',
          canUseNow: false,
          canConfigure: cached.state === 'not_configured',
          requiresApproval: true,
          source,
          missing: [],
          nextActions: cached.recoveryActions,
          lastCheckedAt: checkedAt
        }],
        recoveryActions: cached.recoveryActions,
        checkedAt,
        cacheAgeMs
      }
    }
  }

  // Fresh probe
  const readiness = await probeCapabilityReadiness(tenantId, capabilityKey)
  source = 'openclaw_gateway' // Most likely source

  // Update cache
  if (!lastSnapshotCache || (now - lastSnapshotTime) > SNAPSHOT_CACHE_TTL_MS) {
    lastSnapshotCache = await probeAllCapabilities(tenantId, true)
    lastSnapshotTime = Date.now()
  }

  const canProceed = readiness.state === 'ready'

  return {
    canProceed,
    state: readiness.state,
    source,
    message: readiness.statusMessage,
    blockingCapabilities: canProceed ? undefined : [{
      ...readiness,
      capabilityKey,
      category: 'core',
      canUseNow: false,
      canConfigure: readiness.state === 'not_configured',
      requiresApproval: true,
      source,
      missing: [],
      nextActions: readiness.recoveryActions,
      lastCheckedAt: checkedAt
    }],
    recoveryActions: readiness.recoveryActions,
    checkedAt,
    cacheAgeMs: 0
  }
}

/**
 * P6.18D: Clear probe cache (for testing or forced refresh)
 */
export function clearProbeCache(): void {
  lastSnapshotCache = null
  lastSnapshotTime = 0
  lastGatewayProbe = null
  lastGatewayProbeTime = 0
}

/**
 * P6.18D: Extended gateway probe with CLI/tools/plugins
 */
export async function probeOpenClawGatewayExtended(forceRefresh = false): Promise<ExtendedOpenClawProbeResult> {
  // Get basic gateway probe
  const baseProbe = await probeOpenClawGateway(forceRefresh)

  // Add CLI probe (parallel safe)
  const cliProbe = await probeCLI()

  // Add tools/plugins probe if gateway is reachable
  let toolsProbe: { available: boolean; list?: ToolInfo[]; error?: string; probedAt: string } | undefined
  let pluginsProbe: { available: boolean; list?: PluginInfo[]; error?: string; probedAt: string } | undefined

  if (baseProbe.gateway.reachable) {
    const [tools, plugins] = await Promise.all([
      probeGatewayTools(),
      probeGatewayPlugins()
    ])
    toolsProbe = tools
    pluginsProbe = plugins
  }

  return {
    ...baseProbe,
    cli: cliProbe,
    tools: toolsProbe,
    plugins: pluginsProbe
  }
}
