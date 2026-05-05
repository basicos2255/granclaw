/**
 * Settings Page - Execution Policy Configuration
 * FEATURE 120: Hybrid Execution Policy v1
 */

import { useState, useEffect } from 'react'
import { api, type ExecutionPolicyConfig, type ExecutionProvider, isAuthenticated } from '../../services/api'

export function Settings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [policy, setPolicy] = useState<ExecutionPolicyConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadPolicy()
  }, [])

  const loadPolicy = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.getExecutionPolicy()
      if (response.success && response.data) {
        // Extract policy from nested structure if needed
        const policyData = (response.data as { policy?: ExecutionPolicyConfig }).policy || response.data
        setPolicy(policyData as ExecutionPolicyConfig)
      } else {
        setError(response.error || 'Error al cargar la politica')
      }
    } catch {
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  const savePolicy = async () => {
    if (!policy) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await api.setExecutionPolicy({
        provider: policy.provider,
        preferOpenClawForNewActions: policy.preferOpenClawForNewActions,
        allowLocalFallback: policy.allowLocalFallback,
        avoidAiForLearnedActions: policy.avoidAiForLearnedActions,
        requireConfirmationForOsToolsInStrict: policy.requireConfirmationForOsToolsInStrict,
        requireConfirmationForHighRiskInFree: policy.requireConfirmationForHighRiskInFree
      })
      if (response.success && response.data) {
        const policyData = (response.data as { policy?: ExecutionPolicyConfig }).policy || response.data
        setPolicy(policyData as ExecutionPolicyConfig)
        setSuccess('Configuracion guardada correctamente')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(response.error || 'Error al guardar')
      }
    } catch {
      setError('Error de conexion')
    } finally {
      setSaving(false)
    }
  }

  const updatePolicy = <K extends keyof ExecutionPolicyConfig>(key: K, value: ExecutionPolicyConfig[K]) => {
    if (!policy) return
    setPolicy({ ...policy, [key]: value })
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

  const sectionStyle: React.CSSProperties = {
    marginBottom: '24px'
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: '600',
    color: '#334155',
    marginBottom: '8px',
    display: 'block'
  }

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '14px',
    backgroundColor: 'white'
  }

  const checkboxContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    marginBottom: '12px'
  }

  const checkboxStyle: React.CSSProperties = {
    width: '20px',
    height: '20px',
    marginTop: '2px',
    cursor: 'pointer'
  }

  const checkboxLabelStyle: React.CSSProperties = {
    flex: 1
  }

  const checkboxTitleStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: '4px'
  }

  const checkboxDescStyle: React.CSSProperties = {
    fontSize: '13px',
    color: '#64748b'
  }

  const buttonStyle: React.CSSProperties = {
    padding: '12px 24px',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: saving ? 'not-allowed' : 'pointer',
    opacity: saving ? 0.7 : 1
  }

  const alertStyle = (type: 'error' | 'success'): React.CSSProperties => ({
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    backgroundColor: type === 'error' ? '#fef2f2' : '#ecfdf5',
    color: type === 'error' ? '#dc2626' : '#16a34a',
    fontSize: '14px'
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
            <p>Cargando configuracion...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div style={cardStyle}>
          <h1 style={titleStyle}>Politica de Ejecucion</h1>
          <p style={subtitleStyle}>
            Configura como GranClaw decide entre ejecutar acciones localmente o delegarlas a OpenClaw.
          </p>

          {error && <div style={alertStyle('error')}>{error}</div>}
          {success && <div style={alertStyle('success')}>{success}</div>}

          {policy && (
            <>
              <div style={sectionStyle}>
                <label style={labelStyle}>Proveedor de ejecucion</label>
                <select
                  style={selectStyle}
                  value={policy.provider}
                  onChange={(e) => updatePolicy('provider', e.target.value as ExecutionProvider)}
                >
                  <option value="auto">Auto (recomendado) - Decide automaticamente</option>
                  <option value="openclaw">OpenClaw primero - Siempre delegar a OpenClaw</option>
                  <option value="local">Local primero - Preferir ejecucion local</option>
                </select>
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>Opciones avanzadas</label>

                <div style={checkboxContainerStyle}>
                  <input
                    type="checkbox"
                    style={checkboxStyle}
                    checked={policy.avoidAiForLearnedActions}
                    onChange={(e) => updatePolicy('avoidAiForLearnedActions', e.target.checked)}
                  />
                  <div style={checkboxLabelStyle}>
                    <div style={checkboxTitleStyle}>Evitar IA en acciones aprendidas</div>
                    <div style={checkboxDescStyle}>
                      Las acciones determinísticas (abrir calculadora, navegador, etc.) se ejecutan localmente sin consumir tokens de IA.
                    </div>
                  </div>
                </div>

                <div style={checkboxContainerStyle}>
                  <input
                    type="checkbox"
                    style={checkboxStyle}
                    checked={policy.preferOpenClawForNewActions}
                    onChange={(e) => updatePolicy('preferOpenClawForNewActions', e.target.checked)}
                  />
                  <div style={checkboxLabelStyle}>
                    <div style={checkboxTitleStyle}>Preferir OpenClaw para acciones nuevas</div>
                    <div style={checkboxDescStyle}>
                      Las acciones no aprendidas o complejas se delegan a OpenClaw para razonamiento.
                    </div>
                  </div>
                </div>

                <div style={checkboxContainerStyle}>
                  <input
                    type="checkbox"
                    style={checkboxStyle}
                    checked={policy.allowLocalFallback}
                    onChange={(e) => updatePolicy('allowLocalFallback', e.target.checked)}
                  />
                  <div style={checkboxLabelStyle}>
                    <div style={checkboxTitleStyle}>Permitir fallback local</div>
                    <div style={checkboxDescStyle}>
                      Si OpenClaw falla o requiere reautorizacion, permite ejecutar localmente si existe una capacidad aprobada.
                    </div>
                  </div>
                </div>
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>Seguridad</label>

                <div style={checkboxContainerStyle}>
                  <input
                    type="checkbox"
                    style={checkboxStyle}
                    checked={policy.requireConfirmationForOsToolsInStrict}
                    onChange={(e) => updatePolicy('requireConfirmationForOsToolsInStrict', e.target.checked)}
                  />
                  <div style={checkboxLabelStyle}>
                    <div style={checkboxTitleStyle}>Confirmar OS tools en modo estricto</div>
                    <div style={checkboxDescStyle}>
                      En modo estricto, todas las acciones que abren aplicaciones requieren confirmacion del usuario.
                    </div>
                  </div>
                </div>

                <div style={checkboxContainerStyle}>
                  <input
                    type="checkbox"
                    style={checkboxStyle}
                    checked={policy.requireConfirmationForHighRiskInFree}
                    onChange={(e) => updatePolicy('requireConfirmationForHighRiskInFree', e.target.checked)}
                  />
                  <div style={checkboxLabelStyle}>
                    <div style={checkboxTitleStyle}>Confirmar alto riesgo en modo libre</div>
                    <div style={checkboxDescStyle}>
                      En modo libre (passthrough), las acciones de alto riesgo todavia requieren confirmacion.
                    </div>
                  </div>
                </div>
              </div>

              <button style={buttonStyle} onClick={savePolicy} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar configuracion'}
              </button>
            </>
          )}
        </div>

        <div style={cardStyle}>
          <h2 style={{ ...titleStyle, fontSize: '18px' }}>Acerca de la politica hibrida</h2>
          <div style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.7' }}>
            <p style={{ marginBottom: '12px' }}>
              <strong>GranClaw</strong> actua como capa de seguridad, permisos y cache de aprendizaje operativo.
              <strong> OpenClaw</strong> es el motor agente para razonamiento y acciones complejas.
            </p>
            <p style={{ marginBottom: '12px' }}>
              En modo <strong>Auto</strong>:
            </p>
            <ul style={{ paddingLeft: '20px', marginBottom: '12px' }}>
              <li>Acciones aprendidas y determinísticas se ejecutan localmente (ahorro de tokens)</li>
              <li>Acciones complejas o ambiguas se delegan a OpenClaw</li>
              <li>Si OpenClaw falla, se ofrece fallback local cuando es seguro</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
