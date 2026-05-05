/**
 * Setup Page - OpenClaw Configuration & Pairing
 * FIX 123: OpenClaw Persistent Setup & Pairing Flow
 * FIX 123.1: Granular requirements display
 * FIX 125: Pairing Auto-Repair Action Button
 * FIX 125.1: Setup Page Robustness & Repair Data Normalization
 */

import { useState, useEffect } from 'react'
import { api, isAuthenticated, type SystemStateData, type OpenClawCheckAuthResult, type PendingActionData, type OpenClawSetupRequirement, type RepairSessionData } from '../../services/api'

// FIX 125.1: Safe helpers for undefined values
function safeText(value: string | undefined | null, fallback = 'N/D'): string {
  return value && typeof value === 'string' ? value : fallback
}

function shortId(value: string | undefined | null, fallback = 'sin-id'): string {
  if (!value || typeof value !== 'string') return fallback
  return value.length > 10 ? value.substring(0, 10) + '…' : value
}

function safeSubstring(value: string | undefined | null, maxLen: number, fallback = ''): string {
  if (!value || typeof value !== 'string') return fallback
  if (value.length <= maxLen) return value
  return value.substring(0, maxLen) + '...'
}

function safeDate(value: string | number | undefined | null): string {
  if (!value) return 'Fecha no disponible'
  try {
    const date = new Date(value)
    if (isNaN(date.getTime())) return 'Fecha inválida'
    return date.toLocaleString()
  } catch {
    return 'Fecha inválida'
  }
}

// FIX 125.1: Normalize requirement data
function normalizeRequirement(req: Partial<OpenClawSetupRequirement>, index: number): OpenClawSetupRequirement {
  return {
    id: req.id ?? `req-${index}`,
    scopeKey: req.scopeKey ?? 'openclaw:unknown_scope' as OpenClawSetupRequirement['scopeKey'],
    capabilityKey: req.capabilityKey,
    provider: req.provider ?? 'openclaw',
    reason: req.reason ?? 'OpenClaw requiere configuración',
    originalError: req.originalError,
    status: req.status ?? 'active',
    createdAt: req.createdAt ?? new Date().toISOString(),
    updatedAt: req.updatedAt ?? new Date().toISOString(),
    resolvedAt: req.resolvedAt
  }
}

// FIX 125.1: Normalize repair session data
function normalizeRepairSession(session: Partial<RepairSessionData>): RepairSessionData {
  return {
    id: session.id ?? 'unknown',
    tenantId: session.tenantId ?? 'unknown',
    userId: session.userId ?? 'unknown',
    scopeKey: session.scopeKey ?? 'openclaw:unknown_scope' as RepairSessionData['scopeKey'],
    capabilityKey: session.capabilityKey,
    originalInput: session.originalInput ?? '',
    status: session.status ?? 'pending',
    originalError: session.originalError,
    lastCheckError: session.lastCheckError,
    checkAttempts: session.checkAttempts ?? 0,
    createdAt: session.createdAt ?? new Date().toISOString(),
    updatedAt: session.updatedAt ?? new Date().toISOString(),
    readyAt: session.readyAt,
    retriedAt: session.retriedAt
  }
}

export function Setup() {
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [systemState, setSystemState] = useState<SystemStateData | null>(null)
  const [checkResult, setCheckResult] = useState<OpenClawCheckAuthResult | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingActionData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  // FIX 125: Repair session state
  const [repairSessionId, setRepairSessionId] = useState<string | null>(null)
  const [repairSession, setRepairSession] = useState<RepairSessionData | null>(null)
  const [checkingRepair, setCheckingRepair] = useState(false)
  const [repairCanRetry, setRepairCanRetry] = useState(false)
  const [repairInstructions, setRepairInstructions] = useState<string | null>(null)

  useEffect(() => {
    // FIX 125: Check for repairSessionId in URL
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('repairSessionId')
    if (sessionId) {
      setRepairSessionId(sessionId)
      loadRepairSession(sessionId)
    }
    loadState()
  }, [])

  const loadState = async () => {
    setLoading(true)
    setError(null)
    try {
      const [stateRes, pendingRes] = await Promise.all([
        api.getSystemState(),
        api.getPendingAction()
      ])

      if (stateRes.success && stateRes.data) {
        setSystemState(stateRes.data)
      }
      if (pendingRes.success && pendingRes.data) {
        setPendingAction(pendingRes.data)
      }
    } catch {
      setError('Error al cargar el estado del sistema')
    } finally {
      setLoading(false)
    }
  }

  // FIX 125: Load repair session details
  // FIX 125.1: Normalize data to prevent crashes
  const loadRepairSession = async (sessionId: string) => {
    try {
      const response = await api.getRepairSession(sessionId)
      if (response.success && response.data) {
        const data = response.data as { repairSession?: Partial<RepairSessionData>; instructions?: string }
        if (data.repairSession) {
          const normalized = normalizeRepairSession(data.repairSession)
          setRepairSession(normalized)
          setRepairCanRetry(normalized.status === 'ready')
        }
        if (data.instructions) {
          setRepairInstructions(data.instructions)
        }
      } else {
        // FIX 125.1: Handle invalid session
        setError(`Sesión de reparación no encontrada: ${shortId(sessionId)}`)
      }
    } catch {
      console.error('Error loading repair session')
      setError('Error al cargar la sesión de reparación')
    }
  }

  // FIX 125: Check repair authorization
  const checkRepairAuth = async () => {
    if (!repairSessionId) return
    setCheckingRepair(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await api.checkRepair(repairSessionId)
      if (response.success && response.data) {
        if (response.data.canRetry) {
          setRepairCanRetry(true)
          setSuccess('OpenClaw autorizado correctamente. Puedes reintentar la accion.')
          if (response.data.repairSession) {
            setRepairSession(response.data.repairSession)
          }
        } else {
          setError(response.data.message || 'OpenClaw aun requiere autorizacion')
          if (response.data.instructions) {
            setRepairInstructions(response.data.instructions)
          }
        }
      } else {
        setError(response.error || 'Error al verificar autorizacion')
      }
    } catch {
      setError('Error de conexion')
    } finally {
      setCheckingRepair(false)
    }
  }

  // FIX 125: Retry after repair
  const retryAfterRepair = async () => {
    if (!repairSessionId || !repairSession) return
    setError(null)
    try {
      const response = await api.retryRepair(repairSessionId)
      if (response.success && response.data?.originalInput) {
        // Navigate to execute page with the original input
        setSuccess('Redirigiendo para reintentar la accion...')
        // Store in session for Execute page to pick up
        sessionStorage.setItem('retryInput', response.data.originalInput)
        window.history.pushState({}, '', '/control')
        window.dispatchEvent(new PopStateEvent('popstate'))
      }
    } catch {
      setError('Error al reintentar')
    }
  }

  // FIX 125: Cancel repair
  const cancelRepair = async () => {
    if (!repairSessionId) return
    try {
      await api.cancelRepair(repairSessionId)
      // Clear URL params and reload
      window.history.pushState({}, '', '/control/setup')
      setRepairSessionId(null)
      setRepairSession(null)
      setRepairCanRetry(false)
      setRepairInstructions(null)
    } catch {
      setError('Error al cancelar')
    }
  }

  const checkAuth = async () => {
    setChecking(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await api.checkOpenClawAuth()
      if (response.success && response.data) {
        setCheckResult(response.data)
        // Reload state after check
        await loadState()
        if (response.data.summary.isReady) {
          setSuccess('OpenClaw esta listo para usar')
        }
      } else {
        setError(response.error || 'Error al verificar la autenticacion')
      }
    } catch {
      setError('Error de conexion')
    } finally {
      setChecking(false)
    }
  }

  const markReady = async () => {
    setError(null)
    setSuccess(null)
    try {
      const response = await api.markOpenClawReady()
      // FIX 123.1: markReady now requires verification
      if (response.success && response.data?.verified) {
        setSuccess(`OpenClaw verificado y listo (${response.data.resolvedCount || 0} requisitos resueltos)`)
        await loadState()
      } else if (response.success && !response.data?.verified) {
        // Verification failed
        setError(response.data?.message || 'Verificacion fallida - OpenClaw no esta listo')
      } else {
        setError(response.error || 'Error al verificar')
      }
    } catch {
      setError('Error de conexion')
    }
  }

  const retryPendingAction = async () => {
    if (!pendingAction) return
    setError(null)
    setSuccess(null)
    try {
      // Consume pending action to clear it
      const response = await api.consumePendingAction()
      if (response.success && response.data) {
        // FIX 125.1: Safe substring
        const inputPreview = safeSubstring(response.data.input, 50, 'acción desconocida')
        setSuccess(`Accion pendiente recuperada: "${inputPreview}"`)
        setPendingAction(null)
        // Optionally trigger the action via orchestrator
      }
    } catch {
      setError('Error al recuperar la accion pendiente')
    }
  }

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    padding: '32px'
  }

  const containerStyle: React.CSSProperties = {
    maxWidth: '800px',
    margin: '0 auto'
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
    border: '1px solid #e2e8f0',
    marginBottom: '24px'
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '8px'
  }

  const subtitleStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#64748b',
    marginBottom: '24px'
  }

  const statusBadgeStyle = (isReady: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '999px',
    fontSize: '14px',
    fontWeight: '500',
    backgroundColor: isReady ? '#ecfdf5' : '#fef2f2',
    color: isReady ? '#16a34a' : '#dc2626'
  })

  const infoRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid #f1f5f9'
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#64748b'
  }

  const valueStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1e293b'
  }

  const buttonStyle = (variant: 'primary' | 'secondary' | 'warning'): React.CSSProperties => ({
    padding: '12px 24px',
    backgroundColor: variant === 'primary' ? '#2563eb' : variant === 'warning' ? '#f59e0b' : '#f1f5f9',
    color: variant === 'secondary' ? '#475569' : 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    marginRight: '12px'
  })

  const alertStyle = (type: 'error' | 'success' | 'warning'): React.CSSProperties => ({
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '16px',
    backgroundColor: type === 'error' ? '#fef2f2' : type === 'success' ? '#ecfdf5' : '#fffbeb',
    color: type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#d97706',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px'
  })

  const authStatusStyle = (status: 'ok' | 'fail' | 'skip'): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 12px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: '500',
    backgroundColor: status === 'ok' ? '#ecfdf5' : status === 'fail' ? '#fef2f2' : '#f8fafc',
    color: status === 'ok' ? '#16a34a' : status === 'fail' ? '#dc2626' : '#64748b'
  })

  // FIX 123.1: Format scope key for display
  // FIX 125.1: Handle undefined scopeKey safely
  const formatScopeKey = (scopeKey: string | undefined | null): string => {
    if (!scopeKey) return 'Permiso desconocido'
    const scopeLabels: Record<string, string> = {
      'os:open_app': 'Abrir aplicaciones',
      'os:install': 'Instalar aplicaciones',
      'os:filesystem': 'Acceso a archivos',
      'os:browser': 'Control de navegador',
      'os:system': 'Control del sistema',
      'openclaw:unknown_scope': 'Permiso desconocido'
    }
    return scopeLabels[scopeKey] || scopeKey
  }

  // FIX 125.1: Get explanation for os:install
  const getInstallExplanation = (scopeKey: string | undefined | null): string | null => {
    if (scopeKey === 'os:install') {
      return 'OpenClaw necesita autorización para instalar o modificar aplicaciones. Aunque otra instalación haya funcionado, esta acción puede requerir permisos adicionales o una nueva aprobación del nodo.'
    }
    return null
  }

  if (!isAuthenticated()) {
    return (
      <div style={pageStyle}>
        <div style={containerStyle}>
          <div style={cardStyle}>
            <p>Debes iniciar sesion para acceder a la configuracion.</p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={containerStyle}>
          <div style={cardStyle}>
            <p>Cargando estado del sistema...</p>
          </div>
        </div>
      </div>
    )
  }

  const isReady = systemState && !systemState.openclawRequiresSetup

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        {/* Status Card */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
            <div>
              <h1 style={titleStyle}>Configuracion de OpenClaw</h1>
              <p style={subtitleStyle}>
                Estado de conexion y autenticacion con el servicio OpenClaw.
              </p>
            </div>
            <span style={statusBadgeStyle(!!isReady)}>
              {isReady ? 'Listo' : 'Requiere configuracion'}
            </span>
          </div>

          {error && <div style={alertStyle('error')}>{error}</div>}
          {success && <div style={alertStyle('success')}>{success}</div>}

          {systemState && (
            <>
              <div style={infoRowStyle}>
                <span style={labelStyle}>Estado</span>
                <span style={valueStyle}>{systemState.openclawSetupStatus}</span>
              </div>
              {systemState.lastError && (
                <div style={infoRowStyle}>
                  <span style={labelStyle}>Ultimo error</span>
                  <span style={{ ...valueStyle, color: '#dc2626' }}>{systemState.lastError}</span>
                </div>
              )}
              {systemState.lastChecked && (
                <div style={infoRowStyle}>
                  <span style={labelStyle}>Ultima verificacion</span>
                  <span style={valueStyle}>{new Date(systemState.lastChecked).toLocaleString()}</span>
                </div>
              )}
              {systemState.lastSuccessfulExecution && (
                <div style={infoRowStyle}>
                  <span style={labelStyle}>Ultima ejecucion exitosa</span>
                  <span style={valueStyle}>{new Date(systemState.lastSuccessfulExecution).toLocaleString()}</span>
                </div>
              )}
            </>
          )}

          <div style={{ marginTop: '24px' }}>
            <button style={buttonStyle('primary')} onClick={checkAuth} disabled={checking}>
              {checking ? 'Verificando...' : 'Verificar conexion'}
            </button>
            {!isReady && (
              <button style={buttonStyle('warning')} onClick={markReady}>
                Verificar y marcar como listo
              </button>
            )}
          </div>
        </div>

        {/* FIX 125: Repair Session Card */}
        {repairSession && (
          <div style={{ ...cardStyle, borderColor: repairCanRetry ? '#16a34a' : '#f59e0b', borderWidth: '2px' }}>
            <h2 style={{ ...titleStyle, fontSize: '18px', color: repairCanRetry ? '#16a34a' : '#d97706' }}>
              {repairCanRetry ? 'OpenClaw Autorizado' : 'Reparacion en progreso'}
            </h2>
            <p style={subtitleStyle}>
              {repairCanRetry
                ? 'OpenClaw ha sido autorizado correctamente. Puedes reintentar tu accion.'
                : 'Sigue las instrucciones para autorizar OpenClaw.'}
            </p>

            <div style={infoRowStyle}>
              <span style={labelStyle}>Permiso requerido</span>
              <span style={valueStyle}>{formatScopeKey(repairSession.scopeKey)}</span>
            </div>
            {repairSession.capabilityKey && (
              <div style={infoRowStyle}>
                <span style={labelStyle}>Capability</span>
                <span style={valueStyle}>{repairSession.capabilityKey}</span>
              </div>
            )}
            <div style={infoRowStyle}>
              <span style={labelStyle}>Accion original</span>
              <span style={valueStyle}>
                {safeSubstring(repairSession.originalInput, 80, 'Acción no especificada')}
              </span>
            </div>
            <div style={infoRowStyle}>
              <span style={labelStyle}>Estado</span>
              <span style={statusBadgeStyle(repairSession.status === 'ready')}>
                {repairSession.status === 'ready' ? 'Listo' : repairSession.status === 'waiting_user' ? 'Esperando autorizacion' : repairSession.status}
              </span>
            </div>
            {repairSession.originalError && (
              <div style={{ ...alertStyle('warning'), marginTop: '16px' }}>
                <strong>Error original:</strong> {repairSession.originalError}
              </div>
            )}

            {/* Instructions */}
            {repairInstructions && !repairCanRetry && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                backgroundColor: '#f0f9ff',
                borderRadius: '8px',
                border: '1px solid #bae6fd'
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#0369a1', marginBottom: '8px' }}>
                  Instrucciones de autorizacion
                </h3>
                <div style={{ fontSize: '14px', color: '#0c4a6e', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                  {repairInstructions}
                </div>
              </div>
            )}

            {/* Buttons */}
            <div style={{ marginTop: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {repairCanRetry ? (
                <button style={buttonStyle('primary')} onClick={retryAfterRepair}>
                  Reintentar accion
                </button>
              ) : (
                <button style={buttonStyle('primary')} onClick={checkRepairAuth} disabled={checkingRepair}>
                  {checkingRepair ? 'Verificando...' : 'Ya autorice, comprobar'}
                </button>
              )}
              <button style={buttonStyle('secondary')} onClick={cancelRepair}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Auth Check Results */}
        {checkResult && (
          <div style={cardStyle}>
            <h2 style={{ ...titleStyle, fontSize: '18px' }}>Resultado de verificacion</h2>
            <div style={{ marginTop: '16px' }}>
              <div style={infoRowStyle}>
                <span style={labelStyle}>WebSocket (WS)</span>
                <span style={authStatusStyle(checkResult.authStatus.ws)}>
                  {checkResult.authStatus.ws}
                </span>
              </div>
              <div style={infoRowStyle}>
                <span style={labelStyle}>REST API</span>
                <span style={authStatusStyle(checkResult.authStatus.rest)}>
                  {checkResult.authStatus.rest}
                </span>
              </div>
              <div style={infoRowStyle}>
                <span style={labelStyle}>Tools RPC</span>
                <span style={authStatusStyle(checkResult.authStatus.tools)}>
                  {checkResult.authStatus.tools}
                </span>
              </div>

              {checkResult.authStatus.details.wsError && (
                <div style={alertStyle('error')}>
                  WS Error: {checkResult.authStatus.details.wsError}
                </div>
              )}
              {checkResult.authStatus.details.restError && (
                <div style={alertStyle('error')}>
                  REST Error: {checkResult.authStatus.details.restError}
                </div>
              )}
              {checkResult.authStatus.details.toolsError && (
                <div style={alertStyle('error')}>
                  Tools Error: {checkResult.authStatus.details.toolsError}
                </div>
              )}

              {checkResult.summary.hasPairingError && (
                <div style={alertStyle('warning')}>
                  Se detecto un error de emparejamiento. Por favor, reautoriza OpenClaw en el portal.
                </div>
              )}

              {/* FIX 123.1: Show resolved count */}
              {checkResult.resolvedCount !== undefined && checkResult.resolvedCount > 0 && (
                <div style={alertStyle('success')}>
                  {checkResult.resolvedCount} requisito(s) resuelto(s) con esta verificacion.
                </div>
              )}
            </div>
          </div>
        )}

        {/* FIX 123.1: Active Requirements */}
        {/* FIX 125.1: Normalize requirements and use safe accessors */}
        {systemState?.activeRequirements && systemState.activeRequirements.length > 0 && (
          <div style={{ ...cardStyle, borderColor: '#dc2626', borderWidth: '2px' }}>
            <h2 style={{ ...titleStyle, fontSize: '18px', color: '#dc2626' }}>
              Requisitos de configuracion ({systemState.activeRequirements.length})
            </h2>
            <p style={subtitleStyle}>
              Los siguientes permisos requieren autorizacion en OpenClaw.
            </p>
            <div style={{ marginTop: '16px' }}>
              {systemState.activeRequirements.map((rawReq, index) => {
                const req = normalizeRequirement(rawReq, index)
                const installExplanation = getInstallExplanation(req.scopeKey)
                return (
                  <div key={req.id} style={{ ...infoRowStyle, flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <span style={{ ...valueStyle, fontWeight: '600' }}>{formatScopeKey(req.scopeKey)}</span>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {safeDate(req.createdAt)}
                      </span>
                    </div>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>{safeText(req.reason, 'OpenClaw requiere configuración')}</span>
                    {installExplanation && (
                      <span style={{ fontSize: '12px', color: '#d97706', backgroundColor: '#fffbeb', padding: '8px', borderRadius: '4px', width: '100%' }}>
                        {installExplanation}
                      </span>
                    )}
                    {req.capabilityKey && (
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                        Capability: {req.capabilityKey}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Pending Action */}
        {/* FIX 125.1: Safe accessors for pending action */}
        {pendingAction && (
          <div style={{ ...cardStyle, borderColor: '#f59e0b', borderWidth: '2px' }}>
            <h2 style={{ ...titleStyle, fontSize: '18px', color: '#d97706' }}>
              Accion pendiente
            </h2>
            <p style={subtitleStyle}>
              Hay una accion que quedo pendiente debido a la configuracion requerida.
            </p>
            <div style={{ ...alertStyle('warning'), marginTop: '16px' }}>
              <strong>Accion:</strong> {safeSubstring(pendingAction.input, 100, 'Acción no especificada')}
            </div>
            <div style={infoRowStyle}>
              <span style={labelStyle}>Antigüedad</span>
              <span style={valueStyle}>{Math.round((pendingAction.age ?? 0) / 1000 / 60)} minutos</span>
            </div>
            {pendingAction.scopeKey && (
              <div style={infoRowStyle}>
                <span style={labelStyle}>Scope</span>
                <span style={valueStyle}>{formatScopeKey(pendingAction.scopeKey)}</span>
              </div>
            )}
            {getInstallExplanation(pendingAction.scopeKey) && (
              <div style={{ ...alertStyle('warning'), marginTop: '8px', backgroundColor: '#fffbeb' }}>
                {getInstallExplanation(pendingAction.scopeKey)}
              </div>
            )}
            <button style={buttonStyle('primary')} onClick={retryPendingAction}>
              Reintentar accion
            </button>
          </div>
        )}

        {/* Instructions */}
        <div style={cardStyle}>
          <h2 style={{ ...titleStyle, fontSize: '18px' }}>Instrucciones</h2>
          <div style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.7' }}>
            <p style={{ marginBottom: '12px' }}>
              Si OpenClaw requiere configuracion, sigue estos pasos:
            </p>
            <ol style={{ paddingLeft: '20px', marginBottom: '12px' }}>
              <li>Accede al portal de OpenClaw</li>
              <li>Ve a la seccion de dispositivos emparejados</li>
              <li>Autoriza o reautoriza este dispositivo</li>
              <li>Vuelve aqui y haz clic en "Verificar conexion"</li>
            </ol>
            <p>
              Una vez verificada la conexion, las acciones pendientes podran ejecutarse.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
