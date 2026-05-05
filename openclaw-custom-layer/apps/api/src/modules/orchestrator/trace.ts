/**
 * ExecutionTrace Types and Builder
 * FEATURE 073: Trazabilidad real de ejecucion
 * FEATURE 074: Tiempos reales y garantias de ejecucion
 * FEATURE 075: Debug Snapshot & Bottom Status Bar
 */

/**
 * Un paso de la traza de ejecucion
 */
export interface ExecutionTraceStep {
  id: string
  requestId?: string
  timestamp: string
  stage: 'hub' | 'orchestrator' | 'openclaw' | 'tool' | 'result' | 'error'
  status: 'pending' | 'running' | 'success' | 'blocked' | 'error'
  label: string
  detail?: string
  raw?: unknown
  durationMs?: number
}

/**
 * FEATURE 074: Meta de diagnostico del adaptador
 */
export interface AdapterStatus {
  openclawConfigured: boolean
  restConfigured: boolean
  wsConfigured: boolean
}

/**
 * FEATURE 075: Debug Snapshot - estado real de cada ejecucion
 * FEATURE 090: Added 'granclaw' and 'error' sources
 */
export interface DebugSnapshot {
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
  source?: 'openclaw' | 'tool' | 'mock' | 'fallback' | 'unknown' | 'granclaw' | 'error' | 'setup-required'
  executionConfirmed: boolean
  tracePresent: boolean
  error?: string
}

/**
 * FEATURE 075: Genera requestId unico
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `req-${timestamp}-${random}`
}

/**
 * Traduccion de errores tecnicos a mensajes humanos
 */
function translateErrorToHuman(error: string): string {
  const errorMap: Record<string, string> = {
    'authentication required': 'Debes iniciar sesion para ejecutar esta accion',
    'invalid or expired token': 'Sesion expirada',
    'network error': 'No se pudo contactar con el servidor',
    'openclaw rest client not configured': 'Servicio de IA no configurado',
    'openclaw error': 'Error en el servicio de IA',
    'rpc client not ready': 'Servicio de conexion no disponible',
    'rpc chat.send failed': 'Error al enviar mensaje',
    'invalid input': 'Datos de entrada invalidos',
    'session not found': 'Sesion no encontrada',
    'agent not found': 'Agente no encontrado',
    'preset not found': 'Configuracion no encontrada',
    'not active': 'Recurso no activo',
    'not enabled': 'Recurso no habilitado'
  }

  const lowerError = error.toLowerCase()

  // Buscar match parcial
  for (const [key, value] of Object.entries(errorMap)) {
    if (lowerError.includes(key)) {
      return value
    }
  }

  // Si no hay match, devolver error legible
  return 'No se pudo completar la ejecucion'
}

/**
 * Contexto de traza para una ejecucion
 * FEATURE 074: Tracking de tiempos
 * FEATURE 075: Debug snapshot y requestId
 */
export class ExecutionTraceBuilder {
  private steps: ExecutionTraceStep[] = []
  private counter = 0
  private startTime: number = Date.now()
  private lastStepTime: number = Date.now()

  // FEATURE 075: Estado de debug
  public readonly requestId: string
  private _route: string = 'unknown'
  private _tenantId?: string
  private _userId?: string
  private _sessionPresent: boolean = false
  private _hubEvaluated: boolean = false
  private _hubAllowed?: boolean
  private _hubReason?: string
  private _orchestratorCalled: boolean = false
  private _openclawCalled?: boolean
  private _toolCalled?: boolean
  private _source?: DebugSnapshot['source']
  private _error?: string

  constructor(requestId?: string) {
    this.requestId = requestId || generateRequestId()
  }

  // FEATURE 075: Setters para debug state
  setRoute(route: string): void { this._route = route }
  setTenantId(id: string): void { this._tenantId = id }
  setUserId(id: string): void { this._userId = id }
  setSessionPresent(present: boolean): void { this._sessionPresent = present }
  setError(error: string): void { this._error = error }

  private createStep(
    stage: ExecutionTraceStep['stage'],
    status: ExecutionTraceStep['status'],
    label: string,
    detail?: string,
    raw?: unknown
  ): ExecutionTraceStep {
    const now = Date.now()
    const durationMs = now - this.lastStepTime
    this.lastStepTime = now
    return {
      id: `step-${++this.counter}`,
      requestId: this.requestId,
      timestamp: new Date().toISOString(),
      stage,
      status,
      label,
      detail,
      raw,
      durationMs
    }
  }

  /**
   * FEATURE 074: Obtener duracion total de la ejecucion
   */
  getTotalDurationMs(): number {
    return Date.now() - this.startTime
  }

  /**
   * Hub: inicio de evaluacion
   */
  hubStart(): void {
    this._hubEvaluated = true
    this.steps.push(this.createStep('hub', 'running', 'Evaluando politicas de la empresa'))
  }

  /**
   * Hub: permitido
   */
  hubAllowed(tenantId?: string): void {
    this._hubAllowed = true
    this.steps.push(this.createStep(
      'hub',
      'success',
      'Accion permitida',
      tenantId ? `Tenant: ${tenantId}` : undefined
    ))
  }

  /**
   * Hub: bloqueado
   */
  hubBlocked(reason: string): void {
    this._hubAllowed = false
    this._hubReason = reason
    this.steps.push(this.createStep(
      'hub',
      'blocked',
      'Accion bloqueada',
      reason
    ))
  }

  /**
   * Orchestrator: inicio de ejecucion
   */
  orchestratorStart(): void {
    this._orchestratorCalled = true
    this.steps.push(this.createStep('orchestrator', 'running', 'Enviando accion al orquestador'))
  }

  /**
   * Orchestrator: completado
   */
  orchestratorSuccess(): void {
    this.steps.push(this.createStep('orchestrator', 'success', 'Orquestador completo la ejecucion'))
  }

  /**
   * Orchestrator: error
   */
  orchestratorError(errorMsg: string): void {
    this._error = errorMsg
    // Traducir error a mensaje humano
    const humanError = translateErrorToHuman(errorMsg)
    this.steps.push(this.createStep('error', 'error', humanError, errorMsg))
  }

  /**
   * Tool: detectada y ejecutando
   */
  toolStart(toolId: string): void {
    this._toolCalled = true
    this.steps.push(this.createStep('tool', 'running', `Ejecutando herramienta: ${toolId}`))
  }

  /**
   * Tool: completada
   */
  toolSuccess(toolId: string): void {
    this._toolCalled = true
    this.steps.push(this.createStep('tool', 'success', `Herramienta completada: ${toolId}`))
  }

  /**
   * Tool: error
   */
  toolError(toolId: string, errorMsg: string): void {
    this._toolCalled = true
    this._error = errorMsg
    this.steps.push(this.createStep('tool', 'error', `Error en herramienta: ${toolId}`, errorMsg))
  }

  /**
   * OpenClaw: enviando
   */
  openclawStart(): void {
    this._openclawCalled = true
    this.steps.push(this.createStep('openclaw', 'running', 'Enviando a OpenClaw'))
  }

  /**
   * OpenClaw: respuesta
   */
  openclawSuccess(): void {
    this._openclawCalled = true
    this.steps.push(this.createStep('openclaw', 'success', 'Respuesta generada por OpenClaw'))
  }

  /**
   * OpenClaw: error
   */
  openclawError(errorMsg: string): void {
    this._openclawCalled = true
    this._error = errorMsg
    this.steps.push(this.createStep('openclaw', 'error', 'Error en OpenClaw', errorMsg))
  }

  /**
   * Resultado: source indica origen de la respuesta
   */
  resultSource(source: 'openclaw' | 'tool' | 'mock' | string): void {
    this._source = source as DebugSnapshot['source']
    const labels: Record<string, string> = {
      openclaw: 'Respuesta generada por OpenClaw',
      tool: 'Respuesta generada por herramienta',
      mock: 'Respuesta de fallback (mock)'
    }
    const label = labels[source] || `Respuesta de: ${source}`
    this.steps.push(this.createStep('result', 'success', label, source))
  }

  /**
   * FEATURE 090: Añadir paso generico
   */
  addStep(opts: {
    stage: ExecutionTraceStep['stage']
    status: ExecutionTraceStep['status']
    label: string
    detail?: string
    raw?: unknown
  }): void {
    this.steps.push(this.createStep(opts.stage, opts.status, opts.label, opts.detail, opts.raw))
  }

  /**
   * Obtener todos los pasos
   */
  getSteps(): ExecutionTraceStep[] {
    return [...this.steps]
  }

  /**
   * FEATURE 075: Obtener debug snapshot
   */
  getDebugSnapshot(): DebugSnapshot {
    const tracePresent = this.steps.length > 0
    const hasResult = this._source !== undefined && this._source !== 'unknown'
    const executionConfirmed = tracePresent && hasResult && this._orchestratorCalled && !this._error

    return {
      requestId: this.requestId,
      timestamp: new Date().toISOString(),
      route: this._route,
      tenantId: this._tenantId,
      userId: this._userId,
      sessionPresent: this._sessionPresent,
      hubEvaluated: this._hubEvaluated,
      hubAllowed: this._hubAllowed,
      hubReason: this._hubReason,
      orchestratorCalled: this._orchestratorCalled,
      openclawCalled: this._openclawCalled,
      toolCalled: this._toolCalled,
      source: this._source,
      executionConfirmed,
      tracePresent,
      error: this._error
    }
  }

  /**
   * Reset para reutilizar
   */
  reset(): void {
    this.steps = []
    this.counter = 0
  }
}
