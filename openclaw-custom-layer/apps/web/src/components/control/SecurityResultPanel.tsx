/**
 * SecurityResultPanel - Muestra resultado de forma clara (permitido/bloqueado)
 * FEATURE 061: UI orientada a caso de uso
 * FEATURE 062: Refinamiento visual empresarial
 * FEATURE 063: UI v3 - impacto visual máximo
 * FEATURE 064: UI SaaS moderna + resultado de ejecución
 * FIX 077: Diferenciar blocked/error/unconfirmed
 * FEATURE 090: Estado missing_capability
 * FIX 103: Aprobar inline + callback de reintentar
 * FIX 111: Soporte confirmation_required para OS tools
 * FIX 122: OpenClaw Reauthorization Handling
 * FIX 124: Final Execution Status Resolution
 * FIX 125: Pairing Auto-Repair Action Button
 */

import { useState } from 'react'
import { api, type OpenClawScopeKey } from '../../services/api'
import { OutputViewer } from './OutputViewer'
// FIX 112: normalizeOutput removed - OutputViewer handles normalization internally

// FIX 077 + FEATURE 090 + FIX 111 + FIX 122 + FIX 124: Estados posibles
export type ResultStatus = 'allowed' | 'blocked' | 'error' | 'unconfirmed' | 'missing_capability' | 'confirmation_required' | 'reauthorization_required' | 'setup_required' | 'executed' | 'partial' | 'pending_confirmation' | 'failed'

// FIX 124: Status resolution from backend
export interface StatusResolution {
  hubDecision: 'allowed' | 'blocked'
  executionStatus: string
  finalUiStatus: 'allowed' | 'executed' | 'pending_confirmation' | 'setup_required' | 'reauthorization_required' | 'failed' | 'partial' | 'blocked'
  executionConfirmed: boolean
  isSuccess: boolean
  severity: 'success' | 'warning' | 'error' | 'info'
  title: string
  message: string
  reason: string
}

// FEATURE 090: Info de propuesta de tool
interface ToolProposalInfo {
  toolProposalId: string
  proposedTool: string
  riskLevel: 'low' | 'medium' | 'high'
  missingCapability: string
}

// FIX 111: Info de confirmación OS pending
interface OSConfirmationInfo {
  confirmationId: string
  capabilityKey: string
  displayName: string
  riskLevel?: 'low' | 'medium' | 'high'
  message?: string
}

// FIX 125: Repair info
interface RepairInfo {
  scopeKey: OpenClawScopeKey
  capabilityKey?: string
  originalInput: string
  error?: string
}

interface SecurityResultPanelProps {
  allowed: boolean
  result?: string
  /** FIX 111: Raw result for OutputViewer normalization */
  rawResult?: unknown
  reason?: string
  decisionLog?: string[]
  // FIX 077: Estado explícito (opcional para retrocompatibilidad)
  status?: ResultStatus
  // FIX 124: Status resolution from backend (takes precedence)
  statusResolution?: StatusResolution
  // FEATURE 090: Info de propuesta de tool
  toolProposalInfo?: ToolProposalInfo
  // FIX 103: Callback para reintentar después de aprobar
  onRetry?: () => void
  // FIX 111: OS tool confirmation callbacks
  osConfirmationInfo?: OSConfirmationInfo
  onConfirmOsAction?: (confirmationId: string, capabilityKey: string) => void
  onCancelOsAction?: () => void
  // FIX 125: Repair info for pairing/scope errors
  repairInfo?: RepairInfo
  onStartRepair?: (repairInfo: RepairInfo) => void
  onLocalFallback?: () => void
}

export function SecurityResultPanel({ allowed, result, rawResult, reason, decisionLog, status, statusResolution, toolProposalInfo, onRetry, osConfirmationInfo, onConfirmOsAction, onCancelOsAction, repairInfo, onStartRepair, onLocalFallback }: SecurityResultPanelProps) {
  const [showDetails, setShowDetails] = useState(false)
  // FIX 103: Estados para aprobar inline
  const [approving, setApproving] = useState(false)
  const [approveResult, setApproveResult] = useState<'success' | 'error' | null>(null)
  const [approveError, setApproveError] = useState<string | null>(null)
  // FIX 125: Estados para repair
  const [startingRepair, setStartingRepair] = useState(false)
  const [repairError, setRepairError] = useState<string | null>(null)

  // FIX 077 + FIX 124: Determinar estado real
  // FIX 124: statusResolution.finalUiStatus takes precedence
  const effectiveStatus: ResultStatus = statusResolution?.finalUiStatus || status || (allowed ? 'allowed' : 'blocked')

  // FEATURE 064: Colores modernos
  const green = '#059669'
  const greenBg = '#ecfdf5'
  const greenDark = '#064e3b'
  const red = '#dc2626'
  const redBg = '#fef2f2'
  const redDark = '#7f1d1d'
  // FIX 077: Colores para error y unconfirmed
  const orange = '#d97706'
  const orangeBg = '#fffbeb'
  const orangeDark = '#78350f'
  const gray = '#6b7280'
  const grayBg = '#f9fafb'
  const grayDark = '#374151'
  // FEATURE 090: Colores para missing_capability
  const purple = '#7c3aed'
  const purpleBg = '#f5f3ff'
  const purpleDark = '#4c1d95'
  // FIX 111: Colores para confirmation_required
  const amber = '#f59e0b'
  const amberBg = '#fffbeb'
  const amberDark = '#92400e'
  // FIX 122: Colores para reauthorization_required
  const rose = '#f43f5e'
  const roseBg = '#fff1f2'
  const roseDark = '#9f1239'

  // FIX 077 + FEATURE 090 + FIX 111 + FIX 122 + FIX 124: Determinar colores según estado
  const getColors = () => {
    switch (effectiveStatus) {
      case 'allowed':
        return { main: green, bg: greenBg, dark: greenDark }
      case 'executed':  // FIX 124
        return { main: green, bg: greenBg, dark: greenDark }
      case 'blocked':
        return { main: red, bg: redBg, dark: redDark }
      case 'error':
      case 'failed':  // FIX 124
        return { main: gray, bg: grayBg, dark: grayDark }
      case 'unconfirmed':
      case 'partial':  // FIX 124
        return { main: orange, bg: orangeBg, dark: orangeDark }
      case 'missing_capability':
        return { main: purple, bg: purpleBg, dark: purpleDark }
      case 'confirmation_required':
      case 'pending_confirmation':  // FIX 124
        return { main: amber, bg: amberBg, dark: amberDark }
      case 'reauthorization_required':
      case 'setup_required':  // FIX 124
        return { main: rose, bg: roseBg, dark: roseDark }
      default:
        return { main: gray, bg: grayBg, dark: grayDark }
    }
  }

  const colors = getColors()

  // FIX 077 + FEATURE 090 + FIX 111 + FIX 122 + FIX 124: Textos según estado
  // FIX 124: If statusResolution provided, use its title/message
  const getTexts = () => {
    // FIX 124: Use statusResolution title/message if available
    if (statusResolution) {
      const iconMap: Record<string, string> = {
        'executed': '✓',
        'allowed': '✓',
        'blocked': '✕',
        'failed': '✕',
        'error': '⚠',
        'partial': '⚠',
        'pending_confirmation': '⚠️',
        'confirmation_required': '⚠️',
        'setup_required': '🔧',
        'reauthorization_required': '🔐'
      }
      return {
        icon: iconMap[statusResolution.finalUiStatus] || '?',
        title: statusResolution.title,
        message: statusResolution.message
      }
    }

    switch (effectiveStatus) {
      case 'allowed':
        return { icon: '✓', title: 'PERMITIDO', message: 'La empresa PERMITE esta acción' }
      case 'executed':  // FIX 124
        return { icon: '✓', title: 'EJECUTADO', message: 'La acción se ejecutó correctamente' }
      case 'blocked':
        return { icon: '✕', title: 'BLOQUEADO', message: 'La empresa BLOQUEA esta acción' }
      case 'error':
        return { icon: '⚠', title: 'ERROR', message: 'Ocurrió un error durante la ejecución' }
      case 'failed':  // FIX 124
        return { icon: '✕', title: 'ERROR DE EJECUCIÓN', message: 'La ejecución falló con un error' }
      case 'unconfirmed':
        return { icon: '?', title: 'SIN CONFIRMAR', message: 'Permitido, pero la ejecución no pudo confirmarse' }
      case 'partial':  // FIX 124
        return { icon: '⚠', title: 'EJECUCIÓN PARCIAL', message: 'La acción se completó parcialmente' }
      case 'missing_capability':
        return { icon: '🧩', title: 'CAPACIDAD NO DISPONIBLE', message: 'GranClaw no tiene todavía una herramienta para ejecutar esta acción' }
      case 'confirmation_required':
      case 'pending_confirmation':  // FIX 124
        return { icon: '⚠️', title: 'CONFIRMACIÓN REQUERIDA', message: 'Esta acción necesita confirmación del usuario' }
      case 'reauthorization_required':
        return { icon: '🔐', title: 'REAUTORIZACIÓN REQUERIDA', message: 'OpenClaw necesita permisos adicionales para completar esta acción' }
      case 'setup_required':  // FIX 124
        return { icon: '🔧', title: 'CONFIGURACIÓN REQUERIDA', message: 'OpenClaw necesita configuración antes de completar esta acción' }
      default:
        return { icon: '?', title: 'DESCONOCIDO', message: 'Estado desconocido' }
    }
  }

  const texts = getTexts()

  // FIX 103: Handler para aprobar inline
  const handleApproveInline = async () => {
    if (!toolProposalInfo?.toolProposalId || approving) return
    setApproving(true)
    setApproveError(null)
    try {
      const response = await api.approveToolProposal(toolProposalInfo.toolProposalId)
      if (response.success && response.data?.proposal) {
        setApproveResult('success')
      } else {
        setApproveResult('error')
        setApproveError(response.error || 'Error al aprobar')
      }
    } catch {
      setApproveResult('error')
      setApproveError('Error de conexión')
    } finally {
      setApproving(false)
    }
  }

  // FIX 125: Handler para iniciar reparación
  const handleStartRepair = async () => {
    if (!repairInfo || startingRepair) return
    setStartingRepair(true)
    setRepairError(null)
    try {
      const response = await api.startRepair({
        scopeKey: repairInfo.scopeKey,
        capabilityKey: repairInfo.capabilityKey,
        originalInput: repairInfo.originalInput,
        error: repairInfo.error
      })
      if (response.success && response.data?.setupUrl) {
        // Navegar a la página de setup con el repairSessionId
        window.history.pushState({}, '', response.data.setupUrl)
        window.dispatchEvent(new PopStateEvent('popstate'))
        onStartRepair?.(repairInfo)
      } else {
        setRepairError(response.data?.error || response.error || 'Error al iniciar reparación')
      }
    } catch {
      setRepairError('Error de conexión')
    } finally {
      setStartingRepair(false)
    }
  }

  const containerStyle: React.CSSProperties = {
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
  }

  const headerStyle: React.CSSProperties = {
    padding: '40px',
    backgroundColor: colors.bg,
    borderBottom: `2px solid ${colors.main}`,
    textAlign: 'center'
  }

  const iconStyle: React.CSSProperties = {
    fontSize: '56px',
    marginBottom: '12px'
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '36px',
    fontWeight: '800',
    color: colors.main,
    marginBottom: '8px',
    letterSpacing: '-0.5px'
  }

  const messageStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: '500',
    color: colors.dark
  }

  const resultSectionStyle: React.CSSProperties = {
    backgroundColor: 'white',
    padding: '32px'
  }

  const resultLabelStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  }

  const dividerStyle: React.CSSProperties = {
    flex: 1,
    height: '1px',
    backgroundColor: '#e2e8f0'
  }

  const resultStyle: React.CSSProperties = {
    backgroundColor: '#f8fafc',
    padding: '24px',
    borderRadius: '12px',
    whiteSpace: 'pre-wrap',
    fontFamily: 'inherit',
    fontSize: '15px',
    lineHeight: '1.8',
    color: '#334155',
    border: '1px solid #e2e8f0'
  }

  // FIX 077: reasonStyle con colores dinámicos
  const reasonStyle: React.CSSProperties = {
    backgroundColor: colors.bg,
    padding: '20px 24px',
    borderRadius: '12px',
    color: colors.main,
    fontSize: '16px',
    fontWeight: '600',
    border: `1px solid ${colors.main}`,
    lineHeight: '1.6'
  }

  const footerStyle: React.CSSProperties = {
    backgroundColor: '#f8fafc',
    padding: '16px 32px',
    borderTop: '1px solid #e2e8f0',
    textAlign: 'center'
  }

  const detailsButtonStyle: React.CSSProperties = {
    padding: '10px 20px',
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#64748b',
    fontWeight: '500',
    transition: 'all 0.15s ease'
  }

  const detailsStyle: React.CSSProperties = {
    marginTop: '16px',
    padding: '16px 20px',
    backgroundColor: 'white',
    borderRadius: '8px',
    fontSize: '12px',
    fontFamily: 'ui-monospace, monospace',
    color: '#64748b',
    textAlign: 'left',
    border: '1px solid #e2e8f0'
  }

  // FIX 077: Determinar label para reason/error
  const getReasonLabel = () => {
    switch (effectiveStatus) {
      case 'blocked':
        return 'Motivo del bloqueo'
      case 'error':
        return 'Detalle del error'
      case 'unconfirmed':
        return 'Detalle'
      default:
        return 'Detalle'
    }
  }

  // FIX 077 + FIX 111 + FIX 124: Mostrar result si hay resultado (allowed, executed, unconfirmed, partial)
  const showResult = (effectiveStatus === 'allowed' || effectiveStatus === 'executed' || effectiveStatus === 'unconfirmed' || effectiveStatus === 'partial') && result
  // FIX 111: Use OutputViewer if rawResult provided
  const useOutputViewer = rawResult !== undefined
  // FIX 112: Removed unused normalizedResult/isHumanReadable - OutputViewer handles normalization internally

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={iconStyle}>
          {texts.icon}
        </div>
        <div style={titleStyle}>
          {texts.title}
        </div>
        <div style={messageStyle}>
          {texts.message}
        </div>
      </div>

      <div style={resultSectionStyle}>
        {/* FIX 111: OS Confirmation section */}
        {effectiveStatus === 'confirmation_required' && osConfirmationInfo && (
          <>
            <div style={{ ...resultLabelStyle, color: colors.dark }}>
              <span style={{ ...dividerStyle, backgroundColor: '#fde68a' }} />
              <span>Acción pendiente de confirmación</span>
              <span style={{ ...dividerStyle, backgroundColor: '#fde68a' }} />
            </div>
            <div style={{
              backgroundColor: amberBg,
              padding: '20px 24px',
              borderRadius: '12px',
              border: `1px solid ${amber}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Acción:</span>
                <span style={{ fontSize: '15px', fontWeight: '600', color: amberDark }}>
                  {osConfirmationInfo.displayName}
                </span>
              </div>
              {osConfirmationInfo.riskLevel && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>Riesgo:</span>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    backgroundColor: osConfirmationInfo.riskLevel === 'high' ? '#fee2e2' : osConfirmationInfo.riskLevel === 'medium' ? '#fef3c7' : '#dcfce7',
                    color: osConfirmationInfo.riskLevel === 'high' ? '#dc2626' : osConfirmationInfo.riskLevel === 'medium' ? '#d97706' : '#16a34a'
                  }}>
                    {osConfirmationInfo.riskLevel === 'high' ? 'ALTO' : osConfirmationInfo.riskLevel === 'medium' ? 'MEDIO' : 'BAJO'}
                  </span>
                </div>
              )}
              {osConfirmationInfo.message && (
                <div style={{ fontSize: '14px', color: '#374151', lineHeight: '1.6' }}>
                  {osConfirmationInfo.message}
                </div>
              )}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  onClick={() => onConfirmOsAction?.(osConfirmationInfo.confirmationId, osConfirmationInfo.capabilityKey)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#16a34a',
                    color: 'white',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  ✓ Confirmar ejecución
                </button>
                <button
                  onClick={() => onCancelOsAction?.()}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: 'white',
                    color: '#374151',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    border: '1px solid #d1d5db',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </>
        )}

        {/* FIX 124 + FIX 125: Setup required section with repair button */}
        {effectiveStatus === 'setup_required' && (
          <>
            <div style={{ ...resultLabelStyle, color: colors.dark }}>
              <span style={{ ...dividerStyle, backgroundColor: '#fecdd3' }} />
              <span>OpenClaw requiere configuración</span>
              <span style={{ ...dividerStyle, backgroundColor: '#fecdd3' }} />
            </div>
            <div style={{
              backgroundColor: roseBg,
              padding: '20px 24px',
              borderRadius: '12px',
              border: `1px solid ${rose}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '28px' }}>🔧</span>
                <span style={{ fontSize: '15px', fontWeight: '600', color: roseDark }}>
                  Se requiere configuración adicional
                </span>
              </div>
              <div style={{ fontSize: '14px', color: '#374151', lineHeight: '1.6' }}>
                OpenClaw necesita ser configurado o emparejado antes de ejecutar esta acción.
                Por favor, completa la configuración para continuar.
              </div>
              {(reason || statusResolution?.reason) && (
                <div style={{
                  fontSize: '13px',
                  color: '#6b7280',
                  backgroundColor: 'white',
                  padding: '12px',
                  borderRadius: '8px',
                  fontFamily: 'ui-monospace, monospace'
                }}>
                  Detalle: {reason || statusResolution?.reason}
                </div>
              )}
              {repairError && (
                <div style={{
                  fontSize: '13px',
                  color: '#dc2626',
                  backgroundColor: '#fef2f2',
                  padding: '12px',
                  borderRadius: '8px'
                }}>
                  {repairError}
                </div>
              )}
              <div style={{ marginTop: '8px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {/* FIX 125: Botón principal de reparación */}
                {repairInfo && (
                  <button
                    onClick={handleStartRepair}
                    disabled={startingRepair}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 20px',
                      backgroundColor: '#2563eb',
                      color: 'white',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      border: 'none',
                      cursor: startingRepair ? 'not-allowed' : 'pointer',
                      opacity: startingRepair ? 0.7 : 1
                    }}
                  >
                    {startingRepair ? '⏳ Iniciando...' : '🔧 Resolver permisos de OpenClaw'}
                  </button>
                )}
                <a
                  href="/control/setup"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    backgroundColor: repairInfo ? '#f3f4f6' : rose,
                    color: repairInfo ? '#374151' : 'white',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: repairInfo ? '500' : '600',
                    textDecoration: 'none',
                    border: repairInfo ? '1px solid #d1d5db' : 'none'
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    window.history.pushState({}, '', '/control/setup')
                    window.dispatchEvent(new PopStateEvent('popstate'))
                  }}
                >
                  {repairInfo ? 'Ir a Configuración' : '🔧 Ir a Configuración →'}
                </a>
                {/* FIX 125: Fallback local si está disponible */}
                {onLocalFallback && (
                  <button
                    onClick={onLocalFallback}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 20px',
                      backgroundColor: 'white',
                      color: '#374151',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      border: '1px solid #d1d5db',
                      cursor: 'pointer'
                    }}
                  >
                    💻 Ejecutar localmente
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* FIX 122 + FIX 125: Reauthorization required section with repair button */}
        {effectiveStatus === 'reauthorization_required' && (
          <>
            <div style={{ ...resultLabelStyle, color: colors.dark }}>
              <span style={{ ...dividerStyle, backgroundColor: '#fecdd3' }} />
              <span>OpenClaw requiere reautorización</span>
              <span style={{ ...dividerStyle, backgroundColor: '#fecdd3' }} />
            </div>
            <div style={{
              backgroundColor: roseBg,
              padding: '20px 24px',
              borderRadius: '12px',
              border: `1px solid ${rose}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '28px' }}>🔐</span>
                <span style={{ fontSize: '15px', fontWeight: '600', color: roseDark }}>
                  Se requiere autorización adicional
                </span>
              </div>
              <div style={{ fontSize: '14px', color: '#374151', lineHeight: '1.6' }}>
                El dispositivo o la acción solicitada requiere permisos que no han sido otorgados.
                Por favor, reautoriza OpenClaw para continuar.
              </div>
              {(reason || statusResolution?.reason) && (
                <div style={{
                  fontSize: '13px',
                  color: '#6b7280',
                  backgroundColor: 'white',
                  padding: '12px',
                  borderRadius: '8px',
                  fontFamily: 'ui-monospace, monospace'
                }}>
                  Detalle: {reason || statusResolution?.reason}
                </div>
              )}
              {repairError && (
                <div style={{
                  fontSize: '13px',
                  color: '#dc2626',
                  backgroundColor: '#fef2f2',
                  padding: '12px',
                  borderRadius: '8px'
                }}>
                  {repairError}
                </div>
              )}
              <div style={{ marginTop: '8px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {/* FIX 125: Botón principal de reparación */}
                {repairInfo && (
                  <button
                    onClick={handleStartRepair}
                    disabled={startingRepair}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 20px',
                      backgroundColor: '#2563eb',
                      color: 'white',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      border: 'none',
                      cursor: startingRepair ? 'not-allowed' : 'pointer',
                      opacity: startingRepair ? 0.7 : 1
                    }}
                  >
                    {startingRepair ? '⏳ Iniciando...' : '🔧 Resolver permisos de OpenClaw'}
                  </button>
                )}
                <a
                  href="/control/setup"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    backgroundColor: repairInfo ? '#f3f4f6' : rose,
                    color: repairInfo ? '#374151' : 'white',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: repairInfo ? '500' : '600',
                    textDecoration: 'none',
                    border: repairInfo ? '1px solid #d1d5db' : 'none'
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    window.history.pushState({}, '', '/control/setup')
                    window.dispatchEvent(new PopStateEvent('popstate'))
                  }}
                >
                  {repairInfo ? 'Ir a Configuración' : '🔑 Ir a Configuración →'}
                </a>
                {/* FIX 125: Fallback local si está disponible */}
                {onLocalFallback && (
                  <button
                    onClick={onLocalFallback}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 20px',
                      backgroundColor: 'white',
                      color: '#374151',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      border: '1px solid #d1d5db',
                      cursor: 'pointer'
                    }}
                  >
                    💻 Ejecutar localmente
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* FIX 111: Use OutputViewer for normalized result display */}
        {showResult && useOutputViewer && rawResult && (
          <OutputViewer
            rawResponse={rawResult}
            onConfirmAction={onConfirmOsAction}
            onCancelAction={onCancelOsAction}
          />
        )}

        {/* Legacy: String result display (when no rawResult) */}
        {showResult && !useOutputViewer && (
          <>
            <div style={resultLabelStyle}>
              <span style={dividerStyle} />
              <span>Resultado de la ejecución</span>
              <span style={dividerStyle} />
            </div>
            <div style={resultStyle}>
              {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
            </div>
          </>
        )}

        {(effectiveStatus === 'blocked' || effectiveStatus === 'error') && reason && (
          <>
            <div style={{ ...resultLabelStyle, color: colors.dark }}>
              <span style={{ ...dividerStyle, backgroundColor: effectiveStatus === 'blocked' ? '#fecaca' : '#e5e7eb' }} />
              <span>{getReasonLabel()}</span>
              <span style={{ ...dividerStyle, backgroundColor: effectiveStatus === 'blocked' ? '#fecaca' : '#e5e7eb' }} />
            </div>
            <div style={reasonStyle}>
              {reason}
            </div>
          </>
        )}

        {/* FEATURE 090 + FIX 103: Mostrar info de propuesta de tool con aprobación inline */}
        {effectiveStatus === 'missing_capability' && toolProposalInfo && (
          <>
            <div style={{ ...resultLabelStyle, color: colors.dark }}>
              <span style={{ ...dividerStyle, backgroundColor: '#ddd6fe' }} />
              <span>Propuesta de herramienta</span>
              <span style={{ ...dividerStyle, backgroundColor: '#ddd6fe' }} />
            </div>
            <div style={{
              backgroundColor: approveResult === 'success' ? '#dcfce7' : '#f5f3ff',
              padding: '20px 24px',
              borderRadius: '12px',
              border: `1px solid ${approveResult === 'success' ? '#16a34a' : '#7c3aed'}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              transition: 'all 0.3s ease'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Tool sugerida:</span>
                <span style={{ fontSize: '15px', fontWeight: '600', color: approveResult === 'success' ? '#16a34a' : '#7c3aed', fontFamily: 'monospace' }}>
                  {toolProposalInfo.proposedTool}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Riesgo:</span>
                <span style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  backgroundColor: toolProposalInfo.riskLevel === 'high' ? '#fee2e2' : toolProposalInfo.riskLevel === 'medium' ? '#fef3c7' : '#dcfce7',
                  color: toolProposalInfo.riskLevel === 'high' ? '#dc2626' : toolProposalInfo.riskLevel === 'medium' ? '#d97706' : '#16a34a'
                }}>
                  {toolProposalInfo.riskLevel === 'high' ? 'ALTO' : toolProposalInfo.riskLevel === 'medium' ? 'MEDIO' : 'BAJO'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Capacidad:</span>
                <span style={{ fontSize: '14px', color: '#374151', fontFamily: 'monospace' }}>
                  {toolProposalInfo.missingCapability}
                </span>
              </div>

              {/* FIX 103: Botones de acción inline */}
              <div style={{ marginTop: '8px', paddingTop: '12px', borderTop: '1px solid #ddd6fe', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {/* Si ya se aprobó, mostrar éxito y botón de reintentar */}
                {approveResult === 'success' ? (
                  <>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 20px',
                      backgroundColor: '#dcfce7',
                      color: '#16a34a',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      border: '1px solid #16a34a'
                    }}>
                      ✓ Aprobada
                    </div>
                    {onRetry && (
                      <button
                        onClick={onRetry}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 20px',
                          backgroundColor: '#2563eb',
                          color: 'white',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '500',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        🔄 Reintentar acción
                      </button>
                    )}
                  </>
                ) : approveResult === 'error' ? (
                  <>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 20px',
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      border: '1px solid #dc2626'
                    }}>
                      ✕ {approveError || 'Error al aprobar'}
                    </div>
                    <button
                      onClick={handleApproveInline}
                      disabled={approving}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        backgroundColor: '#16a34a',
                        color: 'white',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        border: 'none',
                        cursor: approving ? 'not-allowed' : 'pointer',
                        opacity: approving ? 0.7 : 1
                      }}
                    >
                      {approving ? 'Reintentando...' : 'Reintentar aprobar'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleApproveInline}
                      disabled={approving}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        backgroundColor: '#16a34a',
                        color: 'white',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        border: 'none',
                        cursor: approving ? 'not-allowed' : 'pointer',
                        opacity: approving ? 0.7 : 1
                      }}
                    >
                      {approving ? 'Aprobando...' : '✓ Aprobar ahora'}
                    </button>
                    <a
                      href="/control/tools"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        backgroundColor: '#f3f4f6',
                        color: '#374151',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        fontSize: '14px',
                        fontWeight: '500',
                        border: '1px solid #e5e7eb'
                      }}
                      onClick={(e) => {
                        e.preventDefault()
                        window.history.pushState({}, '', '/control/tools')
                        window.dispatchEvent(new PopStateEvent('popstate'))
                      }}
                    >
                      Ver detalle →
                    </a>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {decisionLog && decisionLog.length > 0 && (
        <div style={footerStyle}>
          <button
            style={detailsButtonStyle}
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? '▲ Ocultar proceso' : '▼ Ver cómo se tomó la decisión'}
          </button>

          {showDetails && (
            <div style={detailsStyle}>
              {decisionLog.map((log, i) => (
                <div key={i} style={{ padding: '4px 0' }}>{log}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
