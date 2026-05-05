/**
 * StatusBar - Barra de estado/debug al final del contenido
 * FEATURE 074: Execution Guarantees & Status Bar
 * FEATURE 075: Debug Snapshot & Bottom Status Bar (no fixed)
 */

import { useState } from 'react'
import type { DebugSnapshot } from './DebugPanel'

/**
 * Estado del adaptador
 */
interface AdapterStatus {
  openclawConfigured: boolean
  restConfigured: boolean
  wsConfigured: boolean
}

/**
 * Paso de ejecucion
 */
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

interface StatusBarProps {
  // Estado de ejecucion
  isExecuting: boolean
  executionPhase?: 'evaluating' | 'connecting' | 'executing' | 'completed' | 'error'

  // Resultados
  allowed?: boolean
  source?: string
  executionDurationMs?: number
  executionTrace?: ExecutionTraceStep[]
  adapterStatus?: AdapterStatus
  warning?: string
  error?: string

  // FEATURE 075: Debug snapshot
  debugSnapshot?: DebugSnapshot
  requestId?: string
}

/**
 * Obtener icono segun source
 */
function getSourceIcon(source: string): string {
  switch (source) {
    case 'openclaw': return '\u2713'  // ✓
    case 'tool': return '\u2699'      // ⚙
    case 'mock': return '\u26A0'      // ⚠
    case 'fallback': return '\u26A0'  // ⚠
    default: return '\u2753'          // ❓
  }
}

/**
 * Obtener texto corto de source
 */
function getSourceShort(source: string): string {
  switch (source) {
    case 'openclaw': return 'OpenClaw'
    case 'tool': return 'Tool'
    case 'mock': return 'Mock'
    case 'fallback': return 'Fallback'
    case 'unknown': return '?'
    default: return source
  }
}

/**
 * Obtener color segun source
 */
function getSourceColor(source: string): string {
  switch (source) {
    case 'openclaw': return '#059669'  // green
    case 'tool': return '#2563eb'      // blue
    case 'mock': return '#d97706'      // amber
    case 'fallback': return '#d97706'  // amber
    default: return '#64748b'          // gray
  }
}

export function StatusBar({
  isExecuting,
  executionPhase,
  allowed,
  source,
  executionDurationMs,
  executionTrace,
  adapterStatus,
  warning,
  error,
  debugSnapshot,
  requestId
}: StatusBarProps) {
  const [expanded, setExpanded] = useState(false)

  // Sin ejecucion activa
  if (!isExecuting && allowed === undefined && !debugSnapshot) {
    return (
      <div style={{
        marginTop: '24px',
        padding: '12px 16px',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        fontSize: '13px',
        color: '#94a3b8',
        textAlign: 'center'
      }}>
        Sin ejecución activa
      </div>
    )
  }

  // Determinar estado visual
  const hasResult = allowed !== undefined
  const hasTrace = executionTrace && executionTrace.length > 0
  const isMock = source === 'mock' || source === 'fallback'
  const executionConfirmed = debugSnapshot?.executionConfirmed ?? (hasTrace && !isMock)
  const hasWarning = !!warning || (hasResult && !hasTrace) || isMock || (hasResult && !executionConfirmed)
  const hasError = !!error || (hasResult && allowed === false)

  // Colores
  const bgColor = hasError ? '#fef2f2' : hasWarning ? '#fffbeb' : hasResult ? '#ecfdf5' : '#f8fafc'
  const borderColor = hasError ? '#fecaca' : hasWarning ? '#fde68a' : hasResult ? '#a7f3d0' : '#e2e8f0'
  const textColor = hasError ? '#dc2626' : hasWarning ? '#d97706' : hasResult ? '#059669' : '#64748b'

  // Texto principal - FEATURE 075: resumen claro
  let statusParts: string[] = ['GranClaw']

  if (isExecuting) {
    switch (executionPhase) {
      case 'evaluating': statusParts.push('Evaluando...'); break
      case 'connecting': statusParts.push('Conectando...'); break
      case 'executing': statusParts.push('Ejecutando...'); break
      default: statusParts.push('Procesando...')
    }
  } else if (hasError) {
    statusParts.push(allowed === false ? 'Bloqueado' : 'Error')
  } else if (hasResult) {
    statusParts.push('Permitido')
    if (debugSnapshot?.orchestratorCalled) {
      statusParts.push('Orquestador OK')
    }
    if (source && source !== 'unknown') {
      statusParts.push(getSourceShort(source))
    }
    if (!executionConfirmed) {
      statusParts.push('Ejecución no confirmada')
    }
    if (!hasTrace) {
      statusParts.push('Trace ausente')
    }
  }

  // Barra NO fixed - al final del contenido
  const barStyle: React.CSSProperties = {
    marginTop: '24px',
    backgroundColor: bgColor,
    borderRadius: '8px',
    border: `1px solid ${borderColor}`,
    padding: '12px 16px',
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  }

  const compactStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap'
  }

  const leftStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  }

  const statusStyle: React.CSSProperties = {
    fontWeight: '600',
    color: textColor,
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  }

  const separatorStyle: React.CSSProperties = {
    color: '#cbd5e1'
  }

  const buttonStyle: React.CSSProperties = {
    padding: '4px 10px',
    fontSize: '12px',
    backgroundColor: 'white',
    border: `1px solid ${borderColor}`,
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#475569'
  }

  const expandedStyle: React.CSSProperties = {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: 'white',
    borderRadius: '8px',
    border: `1px solid ${borderColor}`,
    fontSize: '12px'
  }

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '12px'
  }

  const itemStyle: React.CSSProperties = {
    padding: '8px',
    backgroundColor: '#f8fafc',
    borderRadius: '4px'
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: '4px'
  }

  const valueStyle: React.CSSProperties = {
    color: '#1e293b',
    fontWeight: '500'
  }

  return (
    <div style={barStyle}>
      <div style={compactStyle}>
        <div style={leftStyle}>
          <span style={statusStyle}>
            {statusParts.map((part, i) => (
              <span key={i}>
                {i > 0 && <span style={separatorStyle}> · </span>}
                {part}
              </span>
            ))}
          </span>

          {executionDurationMs !== undefined && (
            <>
              <span style={separatorStyle}>·</span>
              <span style={{ color: '#64748b' }}>{(executionDurationMs / 1000).toFixed(2)}s</span>
            </>
          )}

          {source && source !== 'unknown' && (
            <>
              <span style={separatorStyle}>·</span>
              <span style={{ color: getSourceColor(source) }}>
                {getSourceIcon(source)}
              </span>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {(requestId || debugSnapshot?.requestId) && (
            <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
              {(requestId || debugSnapshot?.requestId || '').slice(0, 16)}
            </span>
          )}
          <button style={buttonStyle} onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Ocultar' : 'Detalles'}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={expandedStyle}>
          <div style={gridStyle}>
            <div style={itemStyle}>
              <div style={labelStyle}>Estado</div>
              <div style={{ ...valueStyle, color: textColor }}>
                {hasError ? (allowed === false ? 'Bloqueado' : 'Error') : 'Permitido'}
              </div>
            </div>

            <div style={itemStyle}>
              <div style={labelStyle}>Fuente</div>
              <div style={{ ...valueStyle, color: source ? getSourceColor(source) : '#64748b' }}>
                {source ? getSourceShort(source) : 'N/A'}
              </div>
            </div>

            <div style={itemStyle}>
              <div style={labelStyle}>Confirmado</div>
              <div style={{ ...valueStyle, color: executionConfirmed ? '#059669' : '#d97706' }}>
                {executionConfirmed ? 'Sí' : 'No'}
              </div>
            </div>

            <div style={itemStyle}>
              <div style={labelStyle}>Trace</div>
              <div style={{ ...valueStyle, color: hasTrace ? '#059669' : '#d97706' }}>
                {hasTrace ? `${executionTrace?.length} pasos` : 'Ausente'}
              </div>
            </div>

            <div style={itemStyle}>
              <div style={labelStyle}>Duración</div>
              <div style={valueStyle}>
                {executionDurationMs !== undefined ? `${executionDurationMs}ms` : 'N/A'}
              </div>
            </div>

            {adapterStatus && (
              <div style={itemStyle}>
                <div style={labelStyle}>Adaptadores</div>
                <div style={valueStyle}>
                  REST: {adapterStatus.restConfigured ? '✓' : '✗'}
                  {' | '}
                  WS: {adapterStatus.wsConfigured ? '✓' : '✗'}
                </div>
              </div>
            )}
          </div>

          {warning && (
            <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#fffbeb', borderRadius: '4px', color: '#d97706' }}>
              <strong>{'\u26A0'}</strong> {warning}
            </div>
          )}

          {error && (
            <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#fef2f2', borderRadius: '4px', color: '#dc2626' }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {hasTrace && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ ...labelStyle, marginBottom: '8px' }}>Trace de ejecución</div>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '11px', color: '#475569' }}>
                {executionTrace?.map((step, i) => (
                  <div key={step.id || i} style={{ padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: step.status === 'success' ? '#059669' : step.status === 'error' ? '#dc2626' : '#64748b' }}>
                      {step.status === 'success' ? '\u2714' : step.status === 'error' ? '\u274C' : step.status === 'blocked' ? '\u26D4' : '\u2022'}
                    </span>
                    {' '}
                    {step.label}
                    {step.durationMs !== undefined && (
                      <span style={{ color: '#94a3b8', marginLeft: '8px' }}>({step.durationMs}ms)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
