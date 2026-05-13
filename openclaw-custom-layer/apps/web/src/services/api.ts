/**
 * GranClaw API Client
 * FEATURE 072: Auth guard + error translation
 * P2.2: API Base URL & Runtime State Fetch Fix
 * P5.2: Config consistency - unified naming
 * P6.5: Runtime API Connectivity & Error Handling
 */

// P5.2: Unified naming with backward compatibility
const API_BASE = import.meta.env.VITE_API_BASE_URL ||
                 import.meta.env.VITE_API_URL ||  // deprecated
                 "http://localhost:3001"

// P6.5: Export API_BASE for diagnostics
export const API_BASE_URL = API_BASE

/**
 * P6.5: Error for backend offline (ERR_CONNECTION_REFUSED)
 */
export class ApiOfflineError extends Error {
  constructor(
    public url: string,
    public originalError?: Error
  ) {
    super(`Backend API no esta corriendo en ${API_BASE}. Ejecuta: npm run dev:api`)
    this.name = 'ApiOfflineError'
  }
}

/**
 * P2.2: Check if error is API connection error
 * P6.5: Enhanced to distinguish offline from other errors
 */
export function isApiConnectionError(error: unknown): boolean {
  if (error instanceof ApiOfflineError) {
    return true
  }
  if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
    return true
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return msg.includes('network') ||
           msg.includes('connection') ||
           msg.includes('offline') ||
           msg.includes('err_connection_refused') ||
           msg.includes('failed to fetch')
  }
  return false
}

/**
 * P6.5: Check if error is specifically backend offline
 */
export function isBackendOffline(error: unknown): boolean {
  if (error instanceof ApiOfflineError) {
    return true
  }
  if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
    return true
  }
  return false
}

/**
 * P2.2: Error for non-JSON responses
 */
export class ApiNonJsonError extends Error {
  constructor(
    public status: number,
    public url: string,
    public preview: string
  ) {
    super(`API returned non-JSON response (status ${status}). Preview: ${preview}`)
    this.name = 'ApiNonJsonError'
  }
}
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
/**
 * P2.2: Raw fetch with JSON validation
 * P6.5: Enhanced error handling for backend offline
 * Returns data directly or throws on error
 */
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`

  let response: Response

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...options?.headers
      }
    })
  } catch (err) {
    // P6.5: Network error - backend likely offline
    if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
      throw new ApiOfflineError(url, err)
    }
    throw err
  }

  // Check content-type before parsing
  const contentType = response.headers.get('content-type') || ''

  if (!contentType.includes('application/json')) {
    const text = await response.text()
    const preview = text.substring(0, 100).replace(/\n/g, ' ')
    throw new ApiNonJsonError(response.status, url, preview)
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `HTTP ${response.status}`)
  }

  return response.json() as Promise<T>
}

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

    // P2.2: Validate content-type
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      const text = await response.text()
      const preview = text.substring(0, 50)
      console.error(`[API] Non-JSON response from ${endpoint}:`, preview)
      return {
        success: false,
        data: null,
        error: 'API devolvio respuesta no-JSON. Verifica que el backend este corriendo.'
      }
    }

    const json = await response.json() as ApiResponse<T>
    if (!json.success && json.error) {
      json.error = translateError(json.error)
      handleUnauthorized({ error: json.error })
    }
    return json
  } catch (err) {
    const isConnection = isApiConnectionError(err)
    return {
      success: false,
      data: null,
      error: isConnection ? 'No se pudo conectar con el servidor API' : 'Error de conexion'
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
 * P6.3: Added structured result types
 */
export type TaskStatus = 'pending' | 'running' | 'success' | 'blocked' | 'error' | 'unconfirmed'

/**
 * P6.3: Task output types
 */
export type TaskOutputType =
  | 'text'
  | 'link'
  | 'json'
  | 'file'
  | 'image'
  | 'table'
  | 'warning'
  | 'code'
  | 'list'

export interface TaskOutput {
  type: TaskOutputType
  label?: string
  value: unknown
}

/**
 * P6.3: Task artifact types
 */
export type TaskArtifactType =
  | 'file'
  | 'download'
  | 'screenshot'
  | 'report'
  | 'url'
  | 'log'

export interface TaskArtifact {
  type: TaskArtifactType
  name: string
  path?: string
  url?: string
  size?: number
  mimeType?: string
  metadata?: Record<string, unknown>
}

/**
 * P6.13: Recovery action for UI
 */
export interface RecoveryAction {
  type: string
  label: string
  description?: string
  endpoint?: string
  navigateTo?: string
  primary?: boolean
}

/**
 * P6.13: Human-readable task failure explanation
 */
export interface TaskFailureExplanation {
  code: string
  title: string
  humanMessage: string
  technicalMessage?: string
  failedStep?: string
  capability?: string
  provider?: string
  requiredArtifact?: string
  requiredOutput?: string
  recoveryActions: RecoveryAction[]
  canRetry: boolean
  canRepair: boolean
  canReplan: boolean
}

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

  // P6.3: Structured result fields
  summary?: string
  outputs?: TaskOutput[]
  artifacts?: TaskArtifact[]
  provider?: string

  // P6.13: Failure explanation
  failureExplanation?: TaskFailureExplanation
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

/**
 * P6.6: Human Interaction Layer - Task Threads
 * P6.7: Added execution evidence states
 */
export type HumanTaskState =
  | 'thinking'
  | 'planning'           // P6.7: Building execution plan
  | 'reusing_strategy'   // P6.7: Found pattern, preparing to execute
  | 'queued'
  | 'executing'
  | 'validating'         // P6.7: Checking results/evidence
  | 'waiting_approval'
  | 'waiting_user_input'
  | 'waiting_input'      // P6.7: Alias for waiting_user_input
  | 'paused'
  | 'completed'
  | 'failed'
  | 'needs_repair'
  | 'needs_artifacts'    // P6.7: Execution done but missing artifacts
  | 'needs_outputs'      // P6.7: Execution done but missing outputs
  | 'cancelled'

export type MessageRole = 'user' | 'assistant' | 'system' | 'runtime'

export interface ThreadMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: string
  taskAction?: string
  workflowStep?: {
    stepId: string
    stepName: string
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  }
  artifacts?: TaskArtifact[]
  outputs?: TaskOutput[]
  pendingApproval?: {
    id: string
    action: string
    description: string
    risks?: string[]
    options?: string[]
  }
  explanation?: {
    what: string
    why: string
    nextSteps: string[]
  }
}

export interface ThreadContext {
  preferences: Record<string, string | number | boolean>
  filters: string[]
  decisions: Array<{
    key: string
    value: string
    reason: string
    timestamp: string
  }>
  entities: Array<{
    type: string
    name: string
    firstMentioned: string
  }>
}

export interface HumanReadablePlan {
  summary: string
  steps: Array<{
    order: number
    description: string
    requiresApproval: boolean
    estimatedDuration?: string
    risks?: string[]
  }>
  totalSteps: number
  estimatedDuration?: string
  permissions?: string[]
  warnings?: string[]
}

export interface PendingApproval {
  id: string
  type: string
  action: string
  description: string
  risks: string[]
  createdAt: string
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  resolvedAt?: string
}

export interface TaskThread {
  id: string
  taskId?: string
  workflowId?: string
  tenantId: string
  userId?: string
  title: string
  status: HumanTaskState
  messages: ThreadMessage[]
  activeContext: ThreadContext
  currentPlan?: HumanReadablePlan
  lastUserIntent?: string
  pendingApprovals: PendingApproval[]
  createdAt: string
  updatedAt: string
  lastActivityAt: string
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
  // P6.3: Added getTaskResult
  getTasks: () => requestProtected<GranClawTask[]>('/tasks'),
  getTask: (id: string) => requestProtected<GranClawTask>(`/tasks/${id}`),
  getTaskResult: (id: string) => requestProtected<{
    taskId: string
    status: string
    summary: string
    details?: string
    outputs: TaskOutput[]
    artifacts: TaskArtifact[]
    provider?: string
    durationMs?: number
    createdAt: string
  }>(`/tasks/${id}/result`),
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
  },

  // FEATURE 120: Execution Policy
  getExecutionPolicy: async (): Promise<ApiResponse<ExecutionPolicyConfig>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    return requestProtected<ExecutionPolicyConfig>('/execution-policy')
  },

  setExecutionPolicy: async (config: Partial<ExecutionPolicyConfigInput>): Promise<ApiResponse<ExecutionPolicyConfig>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    const response = await postRequest<ApiResponse<ExecutionPolicyConfig>>('/execution-policy', config)
    return response
  },

  // FIX 123: System State
  getSystemState: async (): Promise<ApiResponse<SystemStateData>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    return requestProtected<SystemStateData>('/system/state')
  },

  getPendingAction: async (): Promise<ApiResponse<PendingActionData | null>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    return requestProtected<PendingActionData | null>('/system/pending-action')
  },

  // FIX 123.1: markOpenClawReady now returns verification result
  markOpenClawReady: async (): Promise<ApiResponse<{
    verified: boolean
    message: string
    resolvedCount?: number
    authStatus?: {
      ws: 'ok' | 'fail' | 'skip'
      rest: 'ok' | 'fail' | 'skip'
      tools: 'ok' | 'fail' | 'skip'
    }
  }>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    return postRequestProtected('/system/mark-openclaw-ready', {})
  },

  checkOpenClawAuth: async (): Promise<ApiResponse<OpenClawCheckAuthResult>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    return requestProtected<OpenClawCheckAuthResult>('/openclaw/check-auth')
  },

  consumePendingAction: async (): Promise<ApiResponse<PendingActionData | null>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    return postRequestProtected<ApiResponse<PendingActionData | null>>('/system/consume-pending-action', {})
  },

  // FIX 125: OpenClaw Repair
  startRepair: async (params: StartRepairParams): Promise<ApiResponse<StartRepairResult>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    const response = await postRequest<ApiResponse<StartRepairResult>>('/openclaw/repair/start', params)
    return response
  },

  getRepairSession: async (id: string): Promise<ApiResponse<RepairSessionData>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    return requestProtected<RepairSessionData>(`/openclaw/repair/${id}`)
  },

  checkRepair: async (id: string): Promise<ApiResponse<CheckRepairResult>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    const response = await postRequest<ApiResponse<CheckRepairResult>>(`/openclaw/repair/${id}/check`, {})
    return response
  },

  cancelRepair: async (id: string): Promise<ApiResponse<RepairSessionData>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    const response = await postRequest<ApiResponse<RepairSessionData>>(`/openclaw/repair/${id}/cancel`, {})
    return response
  },

  retryRepair: async (id: string): Promise<ApiResponse<RetryRepairResult>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    const response = await postRequest<ApiResponse<RetryRepairResult>>(`/openclaw/repair/${id}/retry`, {})
    return response
  },

  getActiveRepairs: async (): Promise<ApiResponse<{ sessions: RepairSessionData[]; count: number }>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    return requestProtected<{ sessions: RepairSessionData[]; count: number }>('/openclaw/repair/active')
  },

  // P6.6: Task Threads - protected
  getThreads: async (tenantId?: string): Promise<ApiResponse<TaskThread[]>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    const query = tenantId ? `?tenantId=${tenantId}` : ''
    return requestProtected<TaskThread[]>(`/threads${query}`)
  },

  getActiveThread: async (tenantId?: string): Promise<ApiResponse<TaskThread | null>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    const query = tenantId ? `?tenantId=${tenantId}` : ''
    return requestProtected<TaskThread | null>(`/threads/active${query}`)
  },

  getThread: async (threadId: string): Promise<ApiResponse<TaskThread>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    return requestProtected<TaskThread>(`/threads/${threadId}`)
  },

  getThreadByTask: async (taskId: string): Promise<ApiResponse<TaskThread | null>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    return requestProtected<TaskThread | null>(`/threads/by-task/${taskId}`)
  },

  createThread: async (data: { tenantId: string; title: string; taskId?: string; initialMessage?: string }): Promise<ApiResponse<TaskThread>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    return postRequestProtected<ApiResponse<TaskThread>>('/threads', data)
  },

  addThreadMessage: async (threadId: string, content: string): Promise<ApiResponse<{ message: ThreadMessage; detectedAction?: string; shouldContinue?: boolean }>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    return postRequestProtected<ApiResponse<{ message: ThreadMessage; detectedAction?: string; shouldContinue?: boolean }>>(`/threads/${threadId}/messages`, { content })
  },

  pauseThread: async (threadId: string): Promise<ApiResponse<TaskThread>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    return postRequestProtected<ApiResponse<TaskThread>>(`/threads/${threadId}/pause`, {})
  },

  resumeThread: async (threadId: string): Promise<ApiResponse<TaskThread>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    return postRequestProtected<ApiResponse<TaskThread>>(`/threads/${threadId}/resume`, {})
  },

  cancelThread: async (threadId: string, reason?: string): Promise<ApiResponse<TaskThread>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    return postRequestProtected<ApiResponse<TaskThread>>(`/threads/${threadId}/cancel`, { reason })
  },

  getThreadApprovals: async (threadId: string): Promise<ApiResponse<PendingApproval[]>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    return requestProtected<PendingApproval[]>(`/threads/${threadId}/approvals`)
  },

  resolveApproval: async (threadId: string, approvalId: string, approved: boolean): Promise<ApiResponse<PendingApproval>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    return postRequestProtected<ApiResponse<PendingApproval>>(`/threads/${threadId}/approvals/${approvalId}/resolve`, { approved })
  },

  // ==========================================================================
  // P6.8: Thread Lifecycle Synchronization APIs
  // ==========================================================================

  /**
   * P6.8: Get execution truth - combined task + thread state
   */
  getExecutionTruth: async (taskId: string): Promise<ApiResponse<ExecutionTruth>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    return requestProtected<ExecutionTruth>(`/tasks/${taskId}/truth`)
  },

  /**
   * P6.8: Get ALL threads for a task (for duplicate detection)
   */
  getThreadsByTask: async (taskId: string): Promise<ApiResponse<TaskThread[]>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    return requestProtected<TaskThread[]>(`/threads/by-task/${taskId}/all`)
  },

  /**
   * P6.8: Detect zombie threads
   */
  detectZombieThreads: async (): Promise<ApiResponse<ZombieThreadInfo[]>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    return requestProtected<ZombieThreadInfo[]>('/threads/zombies')
  },

  /**
   * P6.8: Repair zombie threads
   */
  repairZombieThreads: async (): Promise<ApiResponse<RepairResult>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    return postRequestProtected<ApiResponse<RepairResult>>('/threads/repair-zombies', {})
  },

  /**
   * P6.8: Detect duplicate threads
   */
  detectDuplicateThreads: async (): Promise<ApiResponse<DuplicateThreadInfo[]>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    return requestProtected<DuplicateThreadInfo[]>('/threads/duplicates')
  },

  /**
   * P6.8: Repair duplicate threads
   */
  repairDuplicateThreads: async (): Promise<ApiResponse<RepairResult>> => {
    if (!isAuthenticated()) {
      return { success: false, data: null, error: 'Debes iniciar sesion' }
    }
    return postRequestProtected<ApiResponse<RepairResult>>('/threads/repair-duplicates', {})
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

// ==========================================================================
// P6.8: Thread Lifecycle Synchronization Types
// ==========================================================================

/**
 * P6.8: Execution truth - combined task + thread state
 */
export interface ExecutionTruth {
  taskId: string
  taskExists: boolean
  taskStatus: string | null
  threadExists: boolean
  threadId: string | null
  threadStatus: HumanTaskState | null
  threadCount: number
  isConsistent: boolean
  truthStatus: 'completed' | 'failed' | 'in_progress' | 'unknown'
  issues: string[]
}

/**
 * P6.8: Zombie thread info
 */
export interface ZombieThreadInfo {
  threadId: string
  taskId: string
  threadStatus: HumanTaskState
  taskStatus: string | null
  reason: string
}

/**
 * P6.8: Duplicate thread info
 */
export interface DuplicateThreadInfo {
  taskId: string
  count: number
  threadIds: string[]
}

/**
 * P6.8: Repair operation result
 */
export interface RepairResult {
  repaired?: number
  failed?: number
  tasksProcessed?: number
  threadsMerged?: number
  details: Array<{
    threadId?: string
    taskId?: string
    oldStatus?: HumanTaskState
    newStatus?: HumanTaskState
    reason?: string
    kept?: string
    merged?: number
  }>
}

// FIX 123: System State types
// FIX 123.1: Granular setup requirements
export type OpenClawSetupStatus = 'ready' | 'setup_required' | 'unknown'

export type OpenClawScopeKey =
  | 'os:open_app'
  | 'os:install'
  | 'os:filesystem'
  | 'os:browser'
  | 'os:system'
  | 'openclaw:unknown_scope'

export interface OpenClawSetupRequirement {
  id: string
  scopeKey: OpenClawScopeKey
  capabilityKey?: string
  provider: 'openclaw'
  reason: string
  originalError?: string
  status: 'active' | 'resolved'
  createdAt: string
  updatedAt: string
  resolvedAt?: string
}

export interface SystemStateData {
  openclawRequiresSetup: boolean
  openclawSetupStatus: OpenClawSetupStatus
  lastError?: string
  lastChecked?: number
  lastSuccessfulExecution?: number
  hasPendingAction: boolean
  pendingActionInput?: string
  // FIX 123.1: Granular requirements
  activeRequirements?: OpenClawSetupRequirement[]
  activeRequirementCount?: number
}

export interface PendingActionData {
  input: string
  tenantId: string
  userId: string
  timestamp: number
  capabilityKey?: string
  scopeKey?: OpenClawScopeKey
  age: number
}

export interface OpenClawCheckAuthResult {
  success: boolean
  authStatus: {
    ws: 'ok' | 'fail' | 'skip'
    rest: 'ok' | 'fail' | 'skip'
    tools: 'ok' | 'fail' | 'skip'
    details: {
      wsError?: string
      restError?: string
      toolsError?: string
    }
  }
  systemState: {
    openclawRequiresSetup: boolean
    openclawSetupStatus: OpenClawSetupStatus
    lastError?: string
    lastChecked?: number
  }
  // FIX 123.1: Granular requirements
  activeRequirements?: OpenClawSetupRequirement[]
  resolvedRequirements?: OpenClawSetupRequirement[]
  resolvedCount?: number
  summary: {
    wsOk: boolean
    restOk: boolean
    toolsOk: boolean
    hasPairingError: boolean
    isReady: boolean
    activeRequirementCount?: number
  }
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

// FEATURE 120: Execution Policy types
export type ExecutionProvider = 'auto' | 'openclaw' | 'local'

export interface ExecutionPolicyConfig {
  tenantId: string
  provider: ExecutionProvider
  preferOpenClawForNewActions: boolean
  allowLocalFallback: boolean
  avoidAiForLearnedActions: boolean
  requireConfirmationForOsToolsInStrict: boolean
  requireConfirmationForHighRiskInFree: boolean
  updatedAt: string
}

export interface ExecutionPolicyConfigInput {
  provider?: ExecutionProvider
  preferOpenClawForNewActions?: boolean
  allowLocalFallback?: boolean
  avoidAiForLearnedActions?: boolean
  requireConfirmationForOsToolsInStrict?: boolean
  requireConfirmationForHighRiskInFree?: boolean
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

// FIX 125: OpenClaw Repair types
export type RepairSessionStatus = 'pending' | 'waiting_user' | 'checking' | 'ready' | 'failed' | 'cancelled'

export interface RepairSessionData {
  id: string
  tenantId: string
  userId: string
  scopeKey: OpenClawScopeKey
  capabilityKey?: string
  originalInput: string
  status: RepairSessionStatus
  originalError?: string
  lastCheckError?: string
  checkAttempts: number
  createdAt: string
  updatedAt: string
  readyAt?: string
  retriedAt?: string
}

export interface StartRepairParams {
  scopeKey: OpenClawScopeKey
  capabilityKey?: string
  originalInput: string
  error?: string
}

export interface StartRepairResult {
  success: boolean
  repairSession?: RepairSessionData
  setupUrl?: string
  instructions?: string
  error?: string
}

export interface CheckRepairResult {
  success: boolean
  repairSession?: RepairSessionData
  canRetry: boolean
  message: string
  instructions?: string
}

export interface RetryRepairResult {
  success: boolean
  repairSession?: RepairSessionData
  originalInput?: string
}

/**
 * P2.2: Runtime State types
 */
export interface RuntimeStateData {
  queueStats?: {
    pendingJobs: number
    runningJobs: number
    completedJobs: number
    failedJobs: number
  }
  queuePressure?: {
    status: 'ok' | 'warning' | 'critical'
    message: string
  }
  queueState?: {
    totalPending: number
    totalRunning: number
    pressure: number
    avgWaitTime: number
    deadLetters: number
    pendingRetries: number
  }
  orchestratorState?: {
    totalWorkers: number
    busyWorkers: number
    idleWorkers: number
  }
  dagState?: {
    activeWorkflows: number
    completedToday: number
    failedToday: number
  }
  wsState?: {
    activeConnections: number
    totalSubscriptions: number
    messagesSentLastMinute: number
  }
  resources?: {
    memoryUsageMb: number
    cpuPercent: number
  }
  deadLetters?: {
    count: number
  }
  activeWorkflows?: {
    count: number
  }
  websocket?: {
    activeConnections: number
  }
}

/**
 * P2.2: Get runtime state (centralized)
 */
export async function getRuntimeState(): Promise<{ success: boolean; data: RuntimeStateData | null; error: string | null }> {
  try {
    const data = await apiFetch<RuntimeStateData>('/runtime/state')
    return { success: true, data, error: null }
  } catch (err) {
    if (err instanceof ApiNonJsonError) {
      return {
        success: false,
        data: null,
        error: 'API devolvio HTML en lugar de JSON. Verifica que el backend este corriendo.'
      }
    }
    if (isApiConnectionError(err)) {
      return {
        success: false,
        data: null,
        error: 'No se pudo conectar con Runtime API'
      }
    }
    return {
      success: false,
      data: null,
      error: err instanceof Error ? err.message : 'Error desconocido'
    }
  }
}

/**
 * P2.2: Get queue stats
 */
export async function getQueueStats(): Promise<{ success: boolean; data: unknown; error: string | null }> {
  try {
    const data = await apiFetch('/queue/stats')
    return { success: true, data, error: null }
  } catch (err) {
    return {
      success: false,
      data: null,
      error: err instanceof Error ? err.message : 'Error'
    }
  }
}

/**
 * P6.4: Pairing Health Types
 */
export type OverallPairingState =
  | 'unknown'
  | 'disconnected'
  | 'connected'
  | 'paired'
  | 'degraded'
  | 'blocked'
  | 'error'

export interface PairingIssue {
  type: 'connection' | 'auth' | 'capability'
  severity: 'warning' | 'error' | 'critical'
  message: string
  scope?: string
  canRepair: boolean
}

export interface PairingHealthData {
  overall: OverallPairingState
  connection: string
  auth: string
  capability: string
  healthy: boolean
  canExecute: boolean
  lastCheck?: number
  lastSuccess?: number
  issues: PairingIssue[]
  repairAvailable: boolean
  repairSessionId?: string
}

/**
 * P6.4: Get pairing health
 */
export async function getPairingHealth(): Promise<{ success: boolean; data: PairingHealthData | null; error: string | null }> {
  try {
    const result = await apiFetch<{ success: boolean; data: PairingHealthData }>('/pairing/health')
    return { success: true, data: result.data, error: null }
  } catch (err) {
    if (err instanceof ApiNonJsonError) {
      return {
        success: false,
        data: null,
        error: 'API devolvio HTML en lugar de JSON'
      }
    }
    if (isApiConnectionError(err)) {
      return {
        success: false,
        data: null,
        error: 'No se pudo conectar con API'
      }
    }
    return {
      success: false,
      data: null,
      error: err instanceof Error ? err.message : 'Error desconocido'
    }
  }
}

/**
 * P6.4: Run pairing health check
 */
export async function runPairingCheck(): Promise<{ success: boolean; data: PairingHealthData | null; error: string | null }> {
  try {
    const result = await apiFetch<{ success: boolean; data: PairingHealthData }>('/pairing/check', {
      method: 'POST'
    })
    return { success: true, data: result.data, error: null }
  } catch (err) {
    return {
      success: false,
      data: null,
      error: err instanceof Error ? err.message : 'Error'
    }
  }
}

/**
 * P6.4R: OpenClaw Auth Health Types
 */
export type OpenClawAuthState =
  | 'unknown'
  | 'disconnected'
  | 'connected'
  | 'paired'
  | 'degraded'
  | 'reauthorization_required'
  | 'repair_required'
  | 'expired'

export interface OpenClawAuthIssue {
  type: 'connection' | 'auth' | 'capability' | 'scope'
  severity: 'warning' | 'error' | 'critical'
  message: string
  scope?: string
  canRepair: boolean
}

export interface OpenClawAuthHealthData {
  overall: OpenClawAuthState
  connection: string
  auth: string
  capability: string
  healthy: boolean
  canExecute: boolean
  lastCheck?: number
  lastSuccess?: number
  issues: OpenClawAuthIssue[]
  repairAvailable: boolean
  repairSessionId?: string
}

/**
 * P6.4R: Get OpenClaw auth health
 */
export async function getOpenClawAuthHealth(): Promise<{ success: boolean; data: OpenClawAuthHealthData | null; error: string | null }> {
  try {
    const result = await apiFetch<{ success: boolean; data: OpenClawAuthHealthData }>('/openclaw/health')
    return { success: true, data: result.data, error: null }
  } catch (err) {
    if (err instanceof ApiNonJsonError) {
      return {
        success: false,
        data: null,
        error: 'API returned HTML instead of JSON'
      }
    }
    if (isApiConnectionError(err)) {
      return {
        success: false,
        data: null,
        error: 'Cannot connect to API'
      }
    }
    return {
      success: false,
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error'
    }
  }
}

/**
 * P6.4R: Run OpenClaw auth health check
 */
export async function runOpenClawAuthCheck(): Promise<{ success: boolean; data: OpenClawAuthHealthData | null; error: string | null }> {
  try {
    const result = await apiFetch<{ success: boolean; data: OpenClawAuthHealthData }>('/openclaw/check', {
      method: 'POST'
    })
    return { success: true, data: result.data, error: null }
  } catch (err) {
    return {
      success: false,
      data: null,
      error: err instanceof Error ? err.message : 'Error'
    }
  }
}

/**
 * P6.4R: Check if capability is usable
 */
export async function isCapabilityUsable(scopeKey?: string): Promise<{ usable: boolean; reason?: string; repairUrl?: string }> {
  try {
    const url = scopeKey ? `/openclaw/capability/${encodeURIComponent(scopeKey)}` : '/openclaw/can-execute'
    const result = await apiFetch<{ success: boolean; data: { usable?: boolean; canExecute?: boolean; reason?: string; repairUrl?: string } }>(url)
    return {
      usable: result.data.usable ?? result.data.canExecute ?? false,
      reason: result.data.reason,
      repairUrl: result.data.repairUrl
    }
  } catch {
    return { usable: false, reason: 'Cannot check capability' }
  }
}
