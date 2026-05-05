/**
 * Execute Page - Control de acciones de IA
 * FEATURE 061: UI orientada a caso de uso
 * FEATURE 062: Refinamiento visual empresarial
 * FEATURE 064: UI moderna SaaS + ejecución real
 * FEATURE 073: Real execution trace
 * FEATURE 074: Execution guarantees & status bar
 * FEATURE 075: Debug Snapshot & Bottom Status Bar
 * FEATURE 090: Tool Proposal System v1
 * FIX 111: Complete OS Tools UI Confirmation
 * FIX 124: Final Execution Status Resolution
 */

import { useState, useEffect } from 'react'
import { TaskInput, SecurityResultPanel, GlobalHeader, ExecutionTracePanel, StatusBar, DebugPanel, OutputViewer, type DebugSnapshot, type ResultStatus, type CapabilityOutput, type StatusResolution } from '../../components/control'
import { api, isAuthenticated } from '../../services/api'
import { needsOSConfirmation, extractOSConfirmation } from '../../lib/output-normalizer'

/**
 * FIX 124.1: Helper seguro para extraer statusResolution de múltiples ubicaciones
 */
function getStatusResolution(response: unknown): StatusResolution | undefined {
  if (!response || typeof response !== 'object') return undefined
  const r = response as Record<string, unknown>

  // Direct statusResolution
  if (r.statusResolution && typeof r.statusResolution === 'object') {
    return r.statusResolution as StatusResolution
  }

  // Inside data
  if (r.data && typeof r.data === 'object') {
    const data = r.data as Record<string, unknown>
    if (data.statusResolution && typeof data.statusResolution === 'object') {
      return data.statusResolution as StatusResolution
    }
  }

  // Inside meta
  if (r.meta && typeof r.meta === 'object') {
    const meta = r.meta as Record<string, unknown>
    if (meta.statusResolution && typeof meta.statusResolution === 'object') {
      return meta.statusResolution as StatusResolution
    }
  }

  return undefined
}

/**
 * FEATURE 073: Tipo de paso de ejecucion
 * FEATURE 074/075: Añadido durationMs y requestId
 */
interface ExecutionTraceStep {
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
 * FEATURE 074: Estado del adaptador
 */
interface AdapterStatus {
  openclawConfigured: boolean
  restConfigured: boolean
  wsConfigured: boolean
}

// FEATURE 090: Info de propuesta de tool
interface ToolProposalInfo {
  toolProposalId: string
  proposedTool: string
  riskLevel: 'low' | 'medium' | 'high'
  missingCapability: string
}

// FIX 111: Info de confirmación OS pendiente
interface OSConfirmationInfo {
  confirmationId: string
  capabilityKey: string
  displayName: string
  riskLevel?: 'low' | 'medium' | 'high'
  message?: string
}

interface ExecutionResult {
  allowed: boolean
  result?: string
  reason?: string
  decisionLog?: string[]
  executionOutput?: string
  executionTrace?: ExecutionTraceStep[]
  source?: string
  // FEATURE 074
  executionDurationMs?: number
  adapterStatus?: AdapterStatus
  warning?: string
  // FEATURE 075
  requestId?: string
  debugSnapshot?: DebugSnapshot
  // FIX 077: Estado explicito
  status?: ResultStatus
  // FEATURE 080: Task ID
  taskId?: string
  // FEATURE 090: Tool proposal info
  toolProposalInfo?: ToolProposalInfo
  // FEATURE 091: Capability output
  capabilityOutput?: CapabilityOutput
  capabilityName?: string
  // FIX 111: OS confirmation info
  osConfirmationInfo?: OSConfirmationInfo
  // FIX 111: Raw result for OutputViewer
  rawResult?: unknown
  // FIX 124: Status resolution from backend
  statusResolution?: StatusResolution
}

// Historial local (en memoria)
// FEATURE 074: Historial mejorado con mas datos
interface HistoryItem {
  id: string
  tenantId: string
  message: string
  allowed: boolean
  reason?: string
  timestamp: number
  source?: string
  hasTrace: boolean
  durationMs?: number
  status: 'allowed' | 'blocked' | 'error' | 'no-confirmed'
}

// Store global temporal
const historyStore: HistoryItem[] = []
export function getHistory(): HistoryItem[] {
  return [...historyStore]
}

export function Execute() {
  const [tenants, setTenants] = useState<string[]>(['default'])
  const [selectedTenant, setSelectedTenant] = useState('default')
  const [mode, setMode] = useState<'strict' | 'passthrough'>('strict')
  const [loading, setLoading] = useState(false)
  // FEATURE 074: Estados progresivos reales
  const [executionPhase, setExecutionPhase] = useState<'evaluating' | 'connecting' | 'executing' | 'completed' | 'error' | null>(null)
  const [result, setResult] = useState<ExecutionResult | null>(null)
  const [showResult, setShowResult] = useState(false)
  // FIX 103: Guardar último mensaje para reintentar
  const [lastMessage, setLastMessage] = useState<string | null>(null)
  // FIX 112: Removed pendingOsConfirmation/osConfirmationLoading - UI uses result.osConfirmationInfo directly

  useEffect(() => {
    loadTenants()
  }, [])

  // Animación fade-in del resultado
  useEffect(() => {
    if (result) {
      setShowResult(false)
      const timer = setTimeout(() => setShowResult(true), 50)
      return () => clearTimeout(timer)
    }
  }, [result])

  const loadTenants = async () => {
    try {
      const response = await api.getHubConfig()
      if (response.success && response.data) {
        const tenantIds = ['default', ...Object.keys(response.data.tenants)]
        setTenants([...new Set(tenantIds)])
      }
    } catch {
      // Usar default si falla
    }
  }

  const handleExecute = async (message: string) => {
    setLoading(true)
    setResult(null)
    setExecutionPhase('evaluating')
    // FIX 103: Guardar mensaje para posible retry
    setLastMessage(message)

    try {
      // Primero aplicar el modo seleccionado al tenant
      await api.setHubTenantConfig(selectedTenant, { mode })

      // Ejecutar la tarea (incluye evaluación del Hub)
      setExecutionPhase('connecting')
      const response = await api.run(message)
      setExecutionPhase('executing')

      // FEATURE 073/074/075/080/090: Extraer meta completa
      interface ResponseMeta {
        requestId?: string
        taskId?: string
        hubDecision?: string[]
        executionTrace?: ExecutionTraceStep[]
        executionDurationMs?: number
        source?: string
        adapterStatus?: AdapterStatus
        debugSnapshot?: DebugSnapshot
        // FEATURE 090: Tool proposal
        toolProposalId?: string
        missingCapability?: string
        proposedTool?: string
        riskLevel?: 'low' | 'medium' | 'high'
      }
      const meta = (response as unknown as { meta?: ResponseMeta }).meta
      const requestId = meta?.requestId
      const taskId = meta?.taskId
      const decisionLog = meta?.hubDecision || []
      const executionTrace = meta?.executionTrace || []
      const executionDurationMs = meta?.executionDurationMs
      const adapterStatus = meta?.adapterStatus
      const source = meta?.source || response.source || 'unknown'
      const debugSnapshot = meta?.debugSnapshot

      // FEATURE 090: Extraer info de tool proposal
      const toolProposalId = meta?.toolProposalId
      const missingCapability = meta?.missingCapability
      const proposedTool = meta?.proposedTool
      const riskLevel = meta?.riskLevel

      // FEATURE 074: Extraer warning si existe
      const warning = (response as unknown as { warning?: string }).warning

      // FIX 124.1: Extract statusResolution using safe helper
      const statusResolution = getStatusResolution(response)

      // FEATURE 075: Determinar si fue realmente permitido (con confirmación)
      const allowed = response.success !== false
      const executionConfirmed = debugSnapshot?.executionConfirmed ?? false

      // Extraer resultado o razón
      let resultText = ''
      let executionOutput = ''
      let reason = ''

      if (allowed) {
        // Extraer el resultado de la ejecución
        if (typeof response.result === 'string') {
          executionOutput = response.result
        } else if (response.result && typeof response.result === 'object') {
          const r = response.result as Record<string, unknown>
          executionOutput = r.content as string || r.text as string || r.message as string || ''
          if (!executionOutput && Object.keys(r).length > 0) {
            // Formatear objeto de forma legible
            executionOutput = Object.entries(r)
              .filter(([k]) => !['meta', 'hubDecision'].includes(k))
              .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
              .join('\n')
          }
        }

        // FEATURE 074/075: No decir "ejecutado correctamente" si no hay resultado real
        const hasRealResult = executionOutput.length > 0
        const isMock = source === 'mock' || source === 'fallback'

        if (hasRealResult && executionConfirmed) {
          resultText = executionOutput
        } else if (hasRealResult && !executionConfirmed) {
          resultText = executionOutput + '\n\n⚠️ Ejecución no confirmada'
        } else if (isMock) {
          resultText = 'Respuesta de fallback/mock (OpenClaw no configurado)'
        } else if (!hasRealResult && executionTrace.length === 0) {
          resultText = 'Permitido, pero no se pudo confirmar la ejecucion real'
        } else if (!executionConfirmed) {
          resultText = 'Permitido, pero la ejecución no fue confirmada'
        } else {
          resultText = executionOutput || 'Ejecucion completada'
        }
      } else {
        reason = response.error || (response as unknown as { reason?: string }).reason || 'Bloqueado por politicas de seguridad'
      }

      // FIX 077 + FEATURE 090 + FIX 124.1: Determinar status correcto
      // FIX 124.1: statusResolution.finalUiStatus tiene prioridad absoluta
      let resultStatus: ResultStatus
      if (statusResolution?.finalUiStatus) {
        // FIX 124.1: Backend ya resolvió el estado correcto
        resultStatus = statusResolution.finalUiStatus
      } else {
        // Fallback a lógica legacy solo si no hay statusResolution
        const isMissingCapability = response.error === 'Missing capability' || !!toolProposalId
        if (isMissingCapability) {
          resultStatus = 'missing_capability'
        } else if (!allowed) {
          const hubBlocked = debugSnapshot?.hubAllowed === false || reason?.includes('Hub') || reason?.includes('Blocked')
          resultStatus = hubBlocked ? 'blocked' : 'error'
        } else if (!executionConfirmed) {
          resultStatus = 'unconfirmed'
        } else {
          resultStatus = 'allowed'
        }
      }

      // FEATURE 090: Construir toolProposalInfo si existe
      const toolProposalInfo: ToolProposalInfo | undefined = toolProposalId && proposedTool && missingCapability
        ? {
            toolProposalId,
            proposedTool,
            missingCapability,
            riskLevel: riskLevel || 'medium'
          }
        : undefined

      // FEATURE 091: Detectar capability output
      let capabilityOutput: CapabilityOutput | undefined
      let capabilityName: string | undefined
      if (response.result && typeof response.result === 'object') {
        const r = response.result as Record<string, unknown>
        if (r.type === 'document' || r.type === 'info') {
          capabilityOutput = response.result as CapabilityOutput
          // Extraer nombre de capability del meta
          capabilityName = (meta as Record<string, unknown>)?.capabilityName as string | undefined
        }
      }

      // FIX 111: Detectar si necesita confirmación OS
      let osConfirmationInfo: OSConfirmationInfo | undefined
      if (needsOSConfirmation(response)) {
        const osConfirm = extractOSConfirmation(response)
        if (osConfirm) {
          osConfirmationInfo = {
            confirmationId: osConfirm.confirmationId,
            capabilityKey: osConfirm.capabilityKey,
            displayName: osConfirm.actionLabel,
            riskLevel: osConfirm.riskLevel,
            message: osConfirm.message
          }
          resultStatus = 'confirmation_required'
          // FIX 112: Removed setPendingOsConfirmation - UI uses result.osConfirmationInfo directly
        }
      }

      // FEATURE 073/074/075/090/091 + FIX 111 + FIX 124: Incluir trace, source, diagnostico, debugSnapshot, toolProposalInfo, capabilityOutput, osConfirmationInfo y statusResolution
      const execResult: ExecutionResult = {
        allowed,
        result: resultText,
        reason,
        decisionLog,
        executionOutput: allowed ? executionOutput : undefined,
        executionTrace,
        source,
        executionDurationMs,
        adapterStatus,
        warning,
        requestId,
        debugSnapshot,
        status: resultStatus,
        taskId,
        toolProposalInfo,
        capabilityOutput,
        capabilityName,
        osConfirmationInfo,
        rawResult: response.result,
        statusResolution
      }

      setResult(execResult)
      setExecutionPhase('completed')

      // FEATURE 074/075: Historial mejorado con executionConfirmed
      const hasTrace = executionTrace.length > 0
      let status: HistoryItem['status'] = 'allowed'
      if (!allowed) {
        status = reason?.includes('Bloqueado') ? 'blocked' : 'error'
      } else if (!executionConfirmed || !hasTrace || source === 'unknown') {
        status = 'no-confirmed'
      }

      historyStore.unshift({
        id: Date.now().toString(),
        tenantId: selectedTenant,
        message,
        allowed,
        reason: reason || undefined,
        timestamp: Date.now(),
        source,
        hasTrace,
        durationMs: executionDurationMs,
        status
      })

      // Mantener solo últimos 50
      if (historyStore.length > 50) {
        historyStore.pop()
      }

    } catch (err) {
      setExecutionPhase('error')
      // FIX 077: Status correcto para errores de conexion/JS
      setResult({
        allowed: false,
        reason: err instanceof Error ? err.message : 'Error de conexion',
        executionTrace: [],
        source: 'error',
        status: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  // FIX 103: Reintentar la última acción (después de aprobar capability)
  const handleRetry = () => {
    if (lastMessage) {
      handleExecute(lastMessage)
    }
  }

  // FIX 111 + FIX 112: Confirmar acción OS (removed unused capabilityKey parameter)
  const handleConfirmOsAction = async (confirmationId: string, _capabilityKey: string) => {
    try {
      const response = await api.confirmOsTool({
        confirmationId,
        action: 'confirm'
      })

      if (response.success && response.data) {
        // Actualizar resultado con la ejecución confirmada
        setResult(prev => {
          if (!prev) return prev
          return {
            ...prev,
            status: 'allowed',
            result: response.data?.message || 'Acción ejecutada correctamente',
            rawResult: response.data?.result,
            osConfirmationInfo: undefined
          }
        })
      } else {
        // Mostrar error
        setResult(prev => {
          if (!prev) return prev
          return {
            ...prev,
            status: 'error',
            reason: response.error || 'Error al confirmar la acción'
          }
        })
      }
    } catch (err) {
      setResult(prev => {
        if (!prev) return prev
        return {
          ...prev,
          status: 'error',
          reason: err instanceof Error ? err.message : 'Error de conexión'
        }
      })
    }
  }

  // FIX 111 + FIX 112: Cancelar acción OS
  const handleCancelOsAction = () => {
    setResult(prev => {
      if (!prev) return prev
      return {
        ...prev,
        status: 'blocked',
        reason: 'Acción cancelada por el usuario',
        osConfirmationInfo: undefined
      }
    })
  }

  // FEATURE 064: Estilos modernos SaaS
  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: '#f8fafc'
  }

  const containerStyle: React.CSSProperties = {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '56px 32px'
  }

  const heroStyle: React.CSSProperties = {
    textAlign: 'center',
    marginBottom: '48px'
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '36px',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '16px',
    letterSpacing: '-0.5px'
  }

  const subtitleStyle: React.CSSProperties = {
    fontSize: '18px',
    color: '#64748b',
    lineHeight: '1.7',
    maxWidth: '600px',
    margin: '0 auto'
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '16px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
    border: '1px solid #e2e8f0'
  }

  const resultContainerStyle: React.CSSProperties = {
    marginTop: '32px',
    opacity: showResult ? 1 : 0,
    transform: showResult ? 'translateY(0)' : 'translateY(10px)',
    transition: 'opacity 0.3s ease, transform 0.3s ease'
  }

  const processingStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '32px',
    marginTop: '24px',
    backgroundColor: '#f1f5f9',
    borderRadius: '12px',
    color: '#475569',
    fontSize: '16px',
    fontWeight: '500'
  }

  const spinnerStyle: React.CSSProperties = {
    width: '20px',
    height: '20px',
    border: '2px solid #e2e8f0',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  }

  // FEATURE 072: Auth guard - show login prompt if not authenticated
  if (!isAuthenticated()) {
    return (
      <div style={pageStyle}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 120px)',
          padding: '40px'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '60px 80px',
            borderRadius: '16px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            textAlign: 'center',
            maxWidth: '500px'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '24px' }}>🔐</div>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '600',
              color: '#1e293b',
              marginTop: 0,
              marginBottom: '12px'
            }}>
              Inicia sesión para usar GranClaw
            </h2>
            <p style={{
              color: '#64748b',
              fontSize: '16px',
              marginBottom: '32px',
              lineHeight: '1.6'
            }}>
              Necesitas una cuenta para acceder al panel de control y ejecutar acciones.
            </p>
            <button
              onClick={() => {
                window.history.pushState({}, '', '/login')
                window.dispatchEvent(new PopStateEvent('popstate'))
              }}
              style={{
                padding: '14px 32px',
                fontSize: '16px',
                fontWeight: '500',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'background-color 0.15s'
              }}
            >
              Ir a login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <GlobalHeader
        tenants={tenants}
        selectedTenant={selectedTenant}
        onTenantChange={setSelectedTenant}
        mode={mode}
        onModeChange={setMode}
      />

      <div style={containerStyle}>
        <div style={heroStyle}>
          <h1 style={titleStyle}>Controla lo que la IA puede hacer</h1>
          <p style={subtitleStyle}>
            Escribe una acción y GranClaw evaluará si tu empresa la permite. Si es aprobada, se ejecutará automáticamente.
          </p>
        </div>

        <div style={cardStyle}>
          <TaskInput
            onSubmit={handleExecute}
            loading={loading}
          />

          {/* FEATURE 074: Estados progresivos reales */}
          {loading && executionPhase && (
            <div style={processingStyle}>
              <div style={spinnerStyle} />
              <span>
                {executionPhase === 'evaluating' && 'Evaluando politicas de la empresa...'}
                {executionPhase === 'connecting' && 'Conectando con orquestador...'}
                {executionPhase === 'executing' && 'Esperando respuesta...'}
              </span>
            </div>
          )}

          {result && !loading && (
            <div style={resultContainerStyle}>
              {/* FIX 077 + FEATURE 090 + FIX 103 + FIX 111 + FIX 124: Pasar status, statusResolution, toolProposalInfo, onRetry y OS confirmation handlers */}
              <SecurityResultPanel
                allowed={result.allowed}
                result={result.capabilityOutput ? undefined : result.result}
                rawResult={result.rawResult}
                reason={result.reason}
                decisionLog={result.decisionLog}
                status={result.status}
                statusResolution={result.statusResolution}
                toolProposalInfo={result.toolProposalInfo}
                onRetry={result.status === 'missing_capability' ? handleRetry : undefined}
                osConfirmationInfo={result.osConfirmationInfo}
                onConfirmOsAction={handleConfirmOsAction}
                onCancelOsAction={handleCancelOsAction}
              />
              {/* FEATURE 091: Mostrar capability output si existe */}
              {result.capabilityOutput && (
                <OutputViewer
                  output={result.capabilityOutput}
                  capabilityName={result.capabilityName}
                />
              )}
              {/* FEATURE 073: Mostrar flujo real de ejecucion */}
              <ExecutionTracePanel
                trace={result.executionTrace}
                hubDecision={result.decisionLog}
                source={result.source}
              />
            </div>
          )}
        </div>

        {/* FEATURE 075: StatusBar al final del contenido (no fixed) */}
        <StatusBar
          isExecuting={loading}
          executionPhase={executionPhase || undefined}
          allowed={result?.allowed}
          source={result?.source}
          executionDurationMs={result?.executionDurationMs}
          executionTrace={result?.executionTrace}
          adapterStatus={result?.adapterStatus}
          warning={result?.warning}
          error={!result?.allowed && result?.reason ? result.reason : undefined}
          debugSnapshot={result?.debugSnapshot}
          requestId={result?.requestId}
          statusResolution={result?.statusResolution}
        />

        {/* FEATURE 075/080/FIX 124.1: DebugPanel al final con taskId y statusResolution */}
        {result && !loading && (
          <DebugPanel
            debugSnapshot={result.debugSnapshot}
            collapsed={true}
            taskId={result.taskId}
            statusResolution={result.statusResolution}
          />
        )}

        {/* Espacio inferior */}
        <div style={{ height: '40px' }} />
      </div>
    </div>
  )
}
