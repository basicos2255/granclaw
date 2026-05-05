/**
 * Setup Page - OpenClaw Configuration & Pairing
 * FIX 123: OpenClaw Persistent Setup & Pairing Flow
 */

import { useState, useEffect } from 'react'
import { api, isAuthenticated, type SystemStateData, type OpenClawCheckAuthResult, type PendingActionData } from '../../services/api'

export function Setup() {
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [systemState, setSystemState] = useState<SystemStateData | null>(null)
  const [checkResult, setCheckResult] = useState<OpenClawCheckAuthResult | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingActionData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
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
      if (response.success) {
        setSuccess('OpenClaw marcado como listo')
        await loadState()
      } else {
        setError(response.error || 'Error al marcar como listo')
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
        // Redirect to execute page or run the action
        setSuccess(`Accion pendiente recuperada: "${response.data.input.substring(0, 50)}..."`)
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
                Marcar como listo manualmente
              </button>
            )}
          </div>
        </div>

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
            </div>
          </div>
        )}

        {/* Pending Action */}
        {pendingAction && (
          <div style={{ ...cardStyle, borderColor: '#f59e0b', borderWidth: '2px' }}>
            <h2 style={{ ...titleStyle, fontSize: '18px', color: '#d97706' }}>
              Accion pendiente
            </h2>
            <p style={subtitleStyle}>
              Hay una accion que quedo pendiente debido a la configuracion requerida.
            </p>
            <div style={{ ...alertStyle('warning'), marginTop: '16px' }}>
              <strong>Accion:</strong> {pendingAction.input.substring(0, 100)}
              {pendingAction.input.length > 100 && '...'}
            </div>
            <div style={infoRowStyle}>
              <span style={labelStyle}>Antigüedad</span>
              <span style={valueStyle}>{Math.round(pendingAction.age / 1000 / 60)} minutos</span>
            </div>
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
