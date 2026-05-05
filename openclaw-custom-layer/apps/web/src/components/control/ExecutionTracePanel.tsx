/**
 * ExecutionTracePanel - Muestra flujo real de ejecucion
 * FEATURE 073: Real execution trace
 * FEATURE 074: Warning fuerte si no hay trace
 */

import { useState } from 'react'

/**
 * Tipo de paso de ejecucion (debe coincidir con backend)
 * FEATURE 074: Añadido durationMs
 */
interface ExecutionTraceStep {
  id: string
  timestamp: string
  stage: 'hub' | 'orchestrator' | 'openclaw' | 'tool' | 'result' | 'error'
  status: 'pending' | 'running' | 'success' | 'blocked' | 'error'
  label: string
  detail?: string
  raw?: unknown
  durationMs?: number
}

interface ExecutionTracePanelProps {
  trace?: ExecutionTraceStep[]
  hubDecision?: string[]
  source?: string
}

/**
 * Icono segun status
 */
function getStatusIcon(status: ExecutionTraceStep['status']): string {
  switch (status) {
    case 'success': return '\u2714'  // ✔
    case 'blocked': return '\u26D4'  // ⛔
    case 'error': return '\u274C'    // ❌
    case 'running': return '\u23F3'  // ⏳
    case 'pending': return '\u25CB'  // ○
    default: return '\u2022'         // •
  }
}

/**
 * Color segun status
 */
function getStatusColor(status: ExecutionTraceStep['status']): string {
  switch (status) {
    case 'success': return '#059669'  // green
    case 'blocked': return '#dc2626'  // red
    case 'error': return '#dc2626'    // red
    case 'running': return '#2563eb'  // blue
    case 'pending': return '#64748b'  // gray
    default: return '#64748b'
  }
}

export function ExecutionTracePanel({ trace, hubDecision, source }: ExecutionTracePanelProps) {
  const [showTechnical, setShowTechnical] = useState(false)

  // FEATURE 074: Warning fuerte si no hay trace
  if (!trace || trace.length === 0) {
    return (
      <div style={{
        marginTop: '24px',
        padding: '20px',
        backgroundColor: '#fffbeb',
        borderRadius: '12px',
        border: '1px solid #fde68a',
        textAlign: 'center',
        color: '#92400e',
        fontSize: '14px'
      }}>
        <div style={{ fontSize: '20px', marginBottom: '8px' }}>{'\u26A0'}</div>
        <strong>No se recibio trazabilidad real de esta ejecucion.</strong>
        <div style={{ marginTop: '8px', fontSize: '13px', color: '#a16207' }}>
          Esto puede indicar un problema de instrumentacion en el backend.
        </div>
      </div>
    )
  }

  const containerStyle: React.CSSProperties = {
    marginTop: '24px',
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    overflow: 'hidden'
  }

  const headerStyle: React.CSSProperties = {
    padding: '16px 20px',
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: '600',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  }

  const stepsStyle: React.CSSProperties = {
    padding: '16px 20px'
  }

  const stepStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '8px 0',
    borderBottom: '1px solid #f1f5f9'
  }

  const stepIconStyle = (status: ExecutionTraceStep['status']): React.CSSProperties => ({
    fontSize: '16px',
    color: getStatusColor(status),
    minWidth: '20px',
    textAlign: 'center'
  })

  const stepContentStyle: React.CSSProperties = {
    flex: 1
  }

  const stepLabelStyle = (status: ExecutionTraceStep['status']): React.CSSProperties => ({
    fontSize: '14px',
    fontWeight: '500',
    color: status === 'error' || status === 'blocked' ? '#dc2626' : '#1e293b'
  })

  const stepDetailStyle: React.CSSProperties = {
    fontSize: '13px',
    color: '#64748b',
    marginTop: '2px'
  }

  const technicalButtonStyle: React.CSSProperties = {
    padding: '6px 12px',
    fontSize: '12px',
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    cursor: 'pointer',
    color: '#64748b'
  }

  const technicalPanelStyle: React.CSSProperties = {
    padding: '16px 20px',
    backgroundColor: '#f8fafc',
    borderTop: '1px solid #e2e8f0',
    fontSize: '12px',
    fontFamily: 'ui-monospace, monospace',
    color: '#475569'
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>Como se ejecuto</span>
        <button
          style={technicalButtonStyle}
          onClick={() => setShowTechnical(!showTechnical)}
        >
          {showTechnical ? 'Ocultar detalles' : 'Ver detalles tecnicos'}
        </button>
      </div>

      <div style={stepsStyle}>
        {trace.map((step, index) => (
          <div key={step.id || index} style={stepStyle}>
            <span style={stepIconStyle(step.status)}>
              {getStatusIcon(step.status)}
            </span>
            <div style={stepContentStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={stepLabelStyle(step.status)}>
                  {step.label}
                </span>
                {/* FEATURE 074: Mostrar duracion si existe */}
                {step.durationMs !== undefined && (
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                    ({step.durationMs}ms)
                  </span>
                )}
              </div>
              {step.detail && (
                <div style={stepDetailStyle}>
                  {step.detail}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showTechnical && (
        <div style={technicalPanelStyle}>
          <div style={{ marginBottom: '12px' }}>
            <strong>Source:</strong> {source || 'N/A'}
          </div>
          {hubDecision && hubDecision.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <strong>Hub Decision Log:</strong>
              <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                {hubDecision.map((log, i) => (
                  <li key={i}>{log}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <strong>Raw Trace:</strong>
            <pre style={{
              margin: '8px 0 0',
              padding: '12px',
              backgroundColor: 'white',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              overflow: 'auto',
              maxHeight: '200px',
              fontSize: '11px'
            }}>
              {JSON.stringify(trace, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
