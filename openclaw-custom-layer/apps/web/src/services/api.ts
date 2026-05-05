/**
 * GranClaw API Client
 * FEATURE 072: Auth guard + error translation
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001"
const TOKEN_KEY = 'granclaw_token'

/**
 * Get stored auth token
 */
function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getToken()
}

/**
 * Set auth token
 */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

/**
 * Clear auth token
 */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

/**
 * Get auth headers
 */
function getAuthHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * FEATURE 072: Translate backend errors to human-readable messages
 */
function translateError(error: string | null): string {
  if (!error) return 'Ha ocurrido un error'

  const errorMap: Record<string, string> = {
    'Email already registered': 'Este email ya esta registrado',
    'Este email ya esta registrado': 'Este email ya esta registrado',
    'User not found': 'Credenciales incorrectas',
    'Credenciales incorrectas': 'Credenciales incorrectas',
    'Invalid or expired token': 'Sesion expirada',
    'Authentication required': 'Debes iniciar sesion',
    'Authorization token required': 'Debes iniciar sesion',
    'Password is required': 'Password es requerido',
    'Email is required': 'Email es requerido',
    'Invalid email format': 'Formato de email invalido',
    'User is inactive': 'Usuario inactivo',
    'Usuario inactivo': 'Usuario inactivo'
  }

  return errorMap[error] || error
}

interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
}

/**
 * FIX 076: Tipos para respuesta de orchestrator/run
 * El backend envuelve con ok(res, data) -> { success, data, error }
 * Pero data contiene el payload real con meta
 */

// Estado del adaptador
interface AdapterStatus {
  openclawConfigured: boolean
  restConfigured: boolean
  wsConfigured: boolean
}

// Paso de ejecucion
interface ExecutionTraceStep {
  id: string
  requestId?: string
  timestamp: string
  stage: string
  status: string
  label: string
  detail?: string
  durationMs?: number
}

// Debug snapshot
interface DebugSnapshot {
  requestId: string
  timestamp: string
  route: string
  tenantId?: string
  userId?: string
  sessionPresent: boolean
  hubEvaluated: boolean
  hubAllowed?: boolean
  hubReason?: string
  orchestratorCalled: boolean
  openclawCalled?: boolean
  toolCalled?: boolean
  source?: 'openclaw' | 'tool' | 'mock' | 'fallback' | 'unknown'
  executionConfirmed: boolean
  tracePresent: boolean
  error?: string
}

// Meta del orchestrator
interface OrchestratorMeta {
  requestId?: string
  hubDecision?: string[]
  executionTrace?: ExecutionTraceStep[]
  executionDurationMs?: number
  tenantId?: string
  source?: string
  adapterStatus?: AdapterStatus
  debugSnapshot?: DebugSnapshot
}

// Payload real dentro de data
export interface OrchestratorPayload {
  success: boolean
  result?: unknown
  source?: string
  error?: string
  reason?: string
  warning?: string
  message?: string
  meta?: OrchestratorMeta
  agentId?: string
  presetId?: string
  sessionId?: string
  toolId?: string
}

// Wrapper del backend (ok(res, data))
interface OrchestratorWrappedResponse {
  success: boolean
  data: OrchestratorPayload | null
  error: string | null
}

// Legacy alias para compatibilidad
export type OrchestratorResponse = OrchestratorPayload

/**
 * FIX 105: Handle 401 errors by clearing token
 */
function handleUnauthorized(json: { error?: string }): void {
  if (json.error === 'Invalid or expired token' || json.error === 'Sesion expirada') {
    clearToken()
    // Dispatch event for UI to handle
    window.dispatchEvent(new CustomEvent('session-expired'))
  }
}

/**
 * FEATURE 072: Request with guard - returns error if not authenticated
 * FIX 105: Handle 401 by clearing token
 */
async function request<T>(endpoint: string): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: getAuthHeaders()
    })

    // FIX 105: Handle 401 status
    if (response.status === 401) {
      clearToken()
      window.dispatchEvent(new CustomEvent('session-expired'))
      return {
        success: false,
        data: null,
        error: 'Sesion expirada. Inicia sesion de nuevo.'
      }
    }

    const json = await response.json() as ApiResponse<T>
    if (!json.success && json.error) {
      json.error = translateError(json.error)
      handleUnauthorized({ error: json.error })
    }
    return json
  } catch (err) {
    return {
      success: false,
      data: null,
      error: 'Error de conexion'
    }
  }
}

/**
 * FEATURE 072: Protected request - skips if no token
 */
async function requestProtected<T>(endpoint: string): Promise<ApiResponse<T>> {
  if (!isAuthenticated()) {
    return { success: false, data: null, error: 'Debes iniciar sesion' }
  }
  return request<T>(endpoint)
}

async function postRequest<T>(endpoint: string, body: unknown): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(body)
    })

    // FIX 105: Handle 401 status
    if (response.status === 401) {
      clearToken()
      window.dispatchEvent(new CustomEvent('session-expired'))
      return { success: false, error: 'Sesion expirada. Inicia sesion de nuevo.' } as T
    }

    const json = await response.json() as T
    // Translate error if present
    if (typeof json === 'object' && json !== null && 'error' in json) {
      const errStr = (json as { error: string }).error
      const translated = translateError(errStr)
      ;(json as { error: string }).error = translated
      handleUnauthorized({ error: translated })
    }
    return json
  } catch {
    return { success: false, error: 'Error de conexion' } as T
  }
}

/**
 * FEATURE 072: Protected POST - skips if no token
 */
async function postRequestProtected<T>(endpoint: string, body: unknown): Promise<T> {
  if (!isAuthenticated()) {
    return { success: false, error: 'Debes iniciar sesion' } as T
  }
  return postRequest<T>(endpoint, body)
}

interface LoginResponse {
  success: boolean
  data: {
    token: string
    user: {
      id: string
      tenantId: string
      email: string
      role: 'admin' | 'user'
    }
  } | null
  error: string | null
}

interface MeResponse {
  success: boolean
  data: {
    user: {
      id: string
      tenantId: string
      email: string
      role: 'admin' | 'user'
    }
    tenant: {
      id: string
      name: string
    }
  } | null
  error: string | null
}

/**
 * FEATURE 080: Tipos para tareas
 */
export type TaskStatus = 'pending' | 'running' | 'success' | 'blocked' | 'error' | 'unconfirmed'

export interface GranClawTask {
  id: string
  status: TaskStatus
  tenantId: string
  userId?: string
  requestId?: string
  input: string
  result?: unknown
  source?: string
  reason?: string
  error?: string
  executionTrace?: ExecutionTraceStep[]
  debugSnapshot?: DebugSnapshot
  executionDurationMs?: number
  createdAt: string
  updatedAt: string
}

/**
 * FEATURE 090: Tipos para propuestas de tools
 */
// FIX 104: Added 'archived' status
export type ToolProposalStatus = 'pending' | 'approved' | 'rejected' | 'archived'
export type RiskLevel = 'low' | 'medium' | 'high'

export interface ToolProposal {
  id: string
  tenantId: string
  userId?: string
  requestedAction: string
  detectedCapability: string
  proposedToolName: string
  // FIX 104: Clave canónica normalizada
  capabilityKey: string
  description: string
  riskLevel: RiskLevel
  requiresOsAccess: boolean
  requiresNetworkAccess: boolean
  suggestedImplementation?: string
  status: ToolProposalStatus
  createdAt: string
  updatedAt: string
  message?: string // Mensaje de confirmacion al aprobar
}

/**
 * FEATURE 091: Tipos para capacidades aprobadas
 */
export interface ApprovedCapability {
  id: string
  tenantId: string
  proposalId: string
  toolName: string
  // FIX 104: Clave canónica normalizada
  capabilityKey: string
  description: string
  riskLevel: RiskLevel
  requiresOsAccess: boolean
  requiresNetworkAccess: boolean
  enabled: boolean
  // FIX 104: Flag de eliminación lógica
  deleted?: boolean
  createdAt: string
  updatedAt: string
}

/**
 * FEATURE 091: Respuesta de approve con capability
 */
export interface ApproveProposalResponse {
  proposal: ToolProposal
  capability: ApprovedCapability
  message: string
}

export const api = {
  // Auth - public endpoints
  login: (email: string, password: string) => postRequest<LoginResponse>('/auth/login', { email, password }),
  register: (email: string, password: string) => postRequest<LoginResponse>('/auth/register', { email, password }),
  logout: () => postRequest<{ success: boolean }>('/auth/logout', {}),
  getMe: () => requestProtected<MeResponse['data']>('/auth/me'),

  // Public endpoints
  getHealth: () => request<{ status: string; timestamp: string; version: string; uptime: number }>('/health'),
  getOpenClawStatus: () => request<unknown>('/openclaw/status'),

  // Protected endpoints - FEATURE 072: guard
  getAgents: () => requestProtected<unknown[]>('/agents'),
  getSessions: () => requestProtected<unknown[]>('/sessions'),
  // FEATURE 080: Tareas tipadas
  getTasks: () => requestProtected<GranClawTask[]>('/tasks'),
  getTask: (id: string) => requestProtected<GranClawTask>(`/tasks/${id}`),
  getPresets: () => requestProtected<unknown[]>('/presets'),
  getTenants: () => requestProtected<unknown[]>('/tenants'),
  getUsers: () => requestProtected<unknown[]>('/users'),
  getAudit: () => requestProtected<unknown[]>('/audit'),
  getTools: () => requestProtected<unknown[]>('/tools'),
  getOpenClawAuthStatus: () => requestProtected<unknown>('/openclaw/auth-status'),

  // Orchestrator - protected
  // FIX 076: Unwrap response to return payload directly
  // FIX 077: Preserve meta even on errors - never discard wrapped.data if it exists
  run: async (message: string, sessionId?: string, agentId?: string): Promise<OrchestratorPayload> => {
    if (!isAuthenticated()) {
      return { success: false, error: 'Debes iniciar sesion' }
    }
    const wrapped = await postRequest<OrchestratorWrappedResponse>('/orchestrator/run', { message, sessionId, agentId })

    // FIX 077: Si data existe, devolverla SIEMPRE (incluso si wrapper indica error)
    // Esto preserva meta, executionTrace, debugSnapshot, requestId, source, warning
    if (wrapped.data) {
      // Si el wrapper tiene error pero data existe, añadir el error al payload
      if (wrapped.error && !wrapped.data.error) {
        wrapped.data.error = wrapped.error
      }
      // Si wrapper indica success=false, asegurar que data también lo refleje
      if (!wrapped.success && wrapped.data.success !== false) {
        wrapped.data.success = false
      }
      return wrapped.data
    }

    // Solo si data es null/undefined, devolver error mínimo
    return {
      success: false,
      error: wrapped.error || 'No se recibio respuesta del servidor'
    }
  },

  // GranClaw Hub - protected
  getHubConfig: () => requestProtected<HubConfigResponse>('/granclaw-hub/config'),
  getHubTenantConfig: (tenantId: string) => requestProtected<HubTenantConfigResponse>(`/granclaw-hub/config/${tenantId}`),
  setHubTenantConfig: (tenantId: string, config: Partial<HubConfig>) =>
    postRequestProtected<{ success: boolean; tenantId: string; config: HubConfig }>(`/granclaw-hub/config/${tenantId}`, config),
  deleteHubTenantConfig: (tenantId: string) =>
    deleteRequestProtected<{ success: boolean; tenantId: string; removed: boolean }>(`/granclaw-hub/config/${tenantId}`),

  // FEATURE 090: Tool Proposals - protected
  getToolProposals: () => requestProtected<ToolProposal[]>('/tool-proposals'),
  getToolProposal: (id: string) => requestProtected<ToolProposal>(`/tool-proposals/${id}`),

  // FIX 103: Approve/reject properly unwrap response
  approveToolProposal: async (id: string): Promise<ApiResponse<ApproveProposalResponse>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    const response = await postRequest<ApiResponse<ApproveProposalResponse>>(`/tool-proposals/${id}/approve`, {})
    return response
  },

  rejectToolProposal: async (id: string): Promise<ApiResponse<ToolProposal>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    const response = await postRequest<ApiResponse<ToolProposal>>(`/tool-proposals/${id}/reject`, {})
    return response
  },

  // FEATURE 091: Capabilities - protected
  // FIX 103: Enable/disable properly unwrap response
  getCapabilities: () => requestProtected<ApprovedCapability[]>('/capabilities'),
  getCapability: (id: string) => requestProtected<ApprovedCapability>(`/capabilities/${id}`),

  enableCapability: async (id: string): Promise<ApiResponse<ApprovedCapability>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    const response = await postRequest<ApiResponse<ApprovedCapability>>(`/capabilities/${id}/enable`, {})
    return response
  },

  disableCapability: async (id: string): Promise<ApiResponse<ApprovedCapability>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    const response = await postRequest<ApiResponse<ApprovedCapability>>(`/capabilities/${id}/disable`, {})
    return response
  },

  // FIX 104: Archive tool proposal
  archiveToolProposal: async (id: string): Promise<ApiResponse<ToolProposal>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    const response = await postRequest<ApiResponse<ToolProposal>>(`/tool-proposals/${id}/archive`, {})
    return response
  },

  // FIX 104: Delete capability (soft delete)
  deleteCapability: async (id: string): Promise<ApiResponse<ApprovedCapability>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    const response = await deleteRequestProtected<ApiResponse<ApprovedCapability>>(`/capabilities/${id}`)
    return response
  },

  // FIX 105: Cleanup duplicates
  cleanupToolProposals: async (): Promise<ApiResponse<CleanupResult>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    const response = await postRequest<ApiResponse<CleanupResult>>('/tool-proposals/cleanup', {})
    return response
  },

  // FIX 111: OS Tools confirmation
  confirmOsTool: async (payload: OSToolConfirmPayload): Promise<ApiResponse<OSToolConfirmResult>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    const response = await postRequest<ApiResponse<OSToolConfirmResult>>('/os-tools/confirm', payload)
    return response
  },

  // FIX 111: Get pending OS confirmations
  getPendingOsConfirmations: async (sessionId: string): Promise<ApiResponse<OSToolPendingConfirmation[]>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    return requestProtected<OSToolPendingConfirmation[]>(`/os-tools/pending?sessionId=${sessionId}`)
  },

  // FIX 111: Get available OS tools
  getOsTools: async (): Promise<ApiResponse<OSToolInfo[]>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    return requestProtected<OSToolInfo[]>('/os-tools')
  }
}

// FIX 105: Cleanup result type
export interface CleanupResult {
  archivedProposals: number
  deletedCapabilities: number
  keptCapabilities: number
  keptProposals: number
  message: string
}

// Hub types
export interface HubConfig {
  enabled: boolean
  mode: 'passthrough' | 'strict'
  blockedWords: string[]
}

export interface HubConfigResponse {
  defaultConfig: HubConfig
  tenants: Record<string, HubConfig>
}

export interface HubTenantConfigResponse {
  tenantId: string
  config: HubConfig
  source: 'tenant' | 'global'
}

// Hub decision from orchestrator
export interface HubDecision {
  hubDecision?: string[]
}

// FIX 111: OS Tools types
export interface OSToolConfirmPayload {
  confirmationId: string
  action: 'confirm' | 'reject'
}

export interface OSToolConfirmResult {
  success: boolean
  message: string
  status?: 'confirmed' | 'rejected' | 'error'
  result?: {
    success: boolean
    capabilityKey: string
    platform: string
    command: string
    args: string[]
    executedAt: string
    durationMs: number
  }
}

export interface OSToolPendingConfirmation {
  id: string
  tenantId: string
  sessionId: string
  capabilityKey: string
  displayName: string
  description: string
  platform: string
  command: string
  args: string[]
  riskLevel: 'low' | 'medium' | 'high'
  createdAt: string
  expiresAt: string
  status: 'pending' | 'confirmed' | 'rejected' | 'expired'
}

export interface OSToolInfo {
  capabilityKey: string
  displayName: string
  description: string
  riskLevel: 'low' | 'medium' | 'high'
  requiresConfirmation: boolean
  platformSupported: boolean
  currentPlatform: string
}

async function deleteRequest<T>(endpoint: string): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    })
    return response.json() as Promise<T>
  } catch {
    return { success: false, error: 'Error de conexion' } as T
  }
}

/**
 * FEATURE 072: Protected DELETE - skips if no token
 */
async function deleteRequestProtected<T>(endpoint: string): Promise<T> {
  if (!isAuthenticated()) {
    return { success: false, error: 'Debes iniciar sesion' } as T
  }
  return deleteRequest<T>(endpoint)
}
