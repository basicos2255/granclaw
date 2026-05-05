/**
 * DebugPanel - Panel de depuracion de ejecucion
 * FEATURE 075: Debug Snapshot & Bottom Status Bar
 * FEATURE 080: Task System v1 - mostrar taskId
 * FIX 124.1: Show statusResolution section
 */

import { useState } from 'react'
import type { StatusResolution } from './SecurityResultPanel'

/**
 * FEATURE 075: Debug Snapshot del backend
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
  source?: 'openclaw' | 'tool' | 'mock' | 'fallback' | 'unknown'
  executionConfirmed: boolean
  tracePresent: boolean
  error?: string
}

interface DebugPanelProps {
  debugSnapshot?: DebugSnapshot
  collapsed?: boolean
  // FEATURE 080: Task ID
  taskId?: string
  // FIX 124.1: Status resolution
  statusResolution?: StatusResolution
}

/**
 * Texto humano para boolean/undefined
 */
function boolText(val: boolean | undefined): string {
  if (val === undefined) return 'Desconocido'
  return val ? 'Sí' : 'No'
}

/**
 * Texto humano para source
 */
function sourceText(source?: string): string {
  switch (source) {
    case 'openclaw': return 'OpenClaw'
    case 'tool': return 'Herramienta'
    case 'mock': return 'Mock/Fallback'
    case 'fallback': return 'Mock/Fallback'
    case 'unknown': return 'Desconocida'
    default: return source || 'Desconocida'
  }
}

export function DebugPanel({ debugSnapshot, collapsed = true, taskId, statusResolution }: DebugPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed)
  const [showRaw, setShowRaw] = useState(false)

  if (!debugSnapshot) {
    return (
      <div style={{
        marginTop: '16px',
        padding: '16px',
        backgroundColor: '#fef3c7',
        borderRadius: '8px',
        border: '1px solid #fcd34d',
        fontSize: '14px',
        color: '#92400e'
      }}>
        <strong>{'\u26A0'} Sin información de depuración</strong>
        <div style={{ marginTop: '4px', fontSize: '13px' }}>
          No se recibió debugSnapshot del backend.
        </div>
      </div>
    )
  }

  const containerStyle: React.CSSProperties = {
    marginTop: '16px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    overflow: 'hidden'
  }

  const headerStyle: React.CSSProperties = {
    padding: '12px 16px',
    backgroundColor: '#f1f5f9',
    borderBottom: isCollapsed ? 'none' : '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer'
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: '600',
    color: '#475569',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  }

  const contentStyle: React.CSSProperties = {
    padding: '16px'
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #f1f5f9',
    fontSize: '13px'
  }

  const labelStyle: React.CSSProperties = {
    color: '#64748b'
  }

  const valueStyle = (ok: boolean | undefined): React.CSSProperties => ({
    fontWeight: '500',
    color: ok === true ? '#059669' : ok === false ? '#dc2626' : '#64748b'
  })

  const buttonStyle: React.CSSProperties = {
    padding: '6px 12px',
    fontSize: '12px',
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#64748b'
  }

  // Icono segun estado
  const statusIcon = debugSnapshot.executionConfirmed
    ? '\u2714'  // ✔
    : debugSnapshot.error
      ? '\u274C'  // ❌
      : '\u26A0'  // ⚠

  const statusColor = debugSnapshot.executionConfirmed
    ? '#059669'
    : debugSnapshot.error
      ? '#dc2626'
      : '#d97706'

  return (
    <div style={containerStyle}>
      <div style={headerStyle} onClick={() => setIsCollapsed(!isCollapsed)}>
        <span style={titleStyle}>
          <span style={{ color: statusColor }}>{statusIcon}</span>
          Depuración de ejecución
          <span style={{ fontWeight: '400', color: '#94a3b8', fontSize: '12px' }}>
            {debugSnapshot.requestId}
          </span>
        </span>
        <span style={{ color: '#94a3b8', fontSize: '12px' }}>
          {isCollapsed ? '\u25BC' : '\u25B2'}
        </span>
      </div>

      {!isCollapsed && (
        <div style={contentStyle}>
          <div style={rowStyle}>
            <span style={labelStyle}>Request ID</span>
            <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#1e293b' }}>
              {debugSnapshot.requestId}
            </span>
          </div>

          {/* FEATURE 080: Task ID */}
          {taskId && (
            <div style={rowStyle}>
              <span style={labelStyle}>Task ID</span>
              <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#2563eb', fontWeight: '500' }}>
                {taskId}
              </span>
            </div>
          )}

          <div style={rowStyle}>
            <span style={labelStyle}>Sesión detectada</span>
            <span style={valueStyle(debugSnapshot.sessionPresent)}>
              {boolText(debugSnapshot.sessionPresent)}
            </span>
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Hub evaluado</span>
            <span style={valueStyle(debugSnapshot.hubEvaluated)}>
              {boolText(debugSnapshot.hubEvaluated)}
            </span>
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Decisión Hub</span>
            <span style={valueStyle(debugSnapshot.hubAllowed)}>
              {debugSnapshot.hubAllowed === undefined
                ? 'N/A'
                : debugSnapshot.hubAllowed
                  ? 'Permitido'
                  : `Bloqueado${debugSnapshot.hubReason ? `: ${debugSnapshot.hubReason}` : ''}`}
            </span>
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Orquestador llamado</span>
            <span style={valueStyle(debugSnapshot.orchestratorCalled)}>
              {boolText(debugSnapshot.orchestratorCalled)}
            </span>
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>OpenClaw llamado</span>
            <span style={valueStyle(debugSnapshot.openclawCalled)}>
              {boolText(debugSnapshot.openclawCalled)}
            </span>
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Tool llamada</span>
            <span style={valueStyle(debugSnapshot.toolCalled)}>
              {boolText(debugSnapshot.toolCalled)}
            </span>
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Fuente</span>
            <span style={valueStyle(
              debugSnapshot.source === 'openclaw' || debugSnapshot.source === 'tool'
                ? true
                : debugSnapshot.source === 'unknown'
                  ? undefined
                  : false
            )}>
              {sourceText(debugSnapshot.source)}
            </span>
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Ejecución confirmada</span>
            <span style={valueStyle(debugSnapshot.executionConfirmed)}>
              {boolText(debugSnapshot.executionConfirmed)}
            </span>
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Trace presente</span>
            <span style={valueStyle(debugSnapshot.tracePresent)}>
              {boolText(debugSnapshot.tracePresent)}
            </span>
          </div>

          {debugSnapshot.error && (
            <div style={{ ...rowStyle, borderBottom: 'none' }}>
              <span style={labelStyle}>Error</span>
              <span style={{ color: '#dc2626', fontWeight: '500' }}>
                {debugSnapshot.error}
              </span>
            </div>
          )}

          {/* FIX 124.1: Status Resolution section */}
          {statusResolution && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              backgroundColor: statusResolution.severity === 'success' ? '#ecfdf5' :
                              statusResolution.severity === 'warning' ? '#fffbeb' :
                              statusResolution.severity === 'error' ? '#fef2f2' : '#f8fafc',
              borderRadius: '6px',
              border: `1px solid ${
                statusResolution.severity === 'success' ? '#a7f3d0' :
                statusResolution.severity === 'warning' ? '#fde68a' :
                statusResolution.severity === 'error' ? '#fecaca' : '#e2e8f0'
              }`
            }}>
              <div style={{ ...labelStyle, marginBottom: '8px' }}>Status Resolution (FIX 124)</div>
              <div style={rowStyle}>
                <span style={labelStyle}>Hub Decision</span>
                <span style={valueStyle(statusResolution.hubDecision === 'allowed')}>
                  {statusResolution.hubDecision === 'allowed' ? 'Permitido' : 'Bloqueado'}
                </span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>Execution Status</span>
                <span style={{ fontWeight: '500', color: '#475569' }}>
                  {statusResolution.executionStatus}
                </span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>Final UI Status</span>
                <span style={{
                  fontWeight: '600',
                  color: statusResolution.severity === 'success' ? '#059669' :
                        statusResolution.severity === 'warning' ? '#d97706' :
                        statusResolution.severity === 'error' ? '#dc2626' : '#475569'
                }}>
                  {statusResolution.title}
                </span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>Mensaje</span>
                <span style={{ color: '#475569', fontSize: '12px' }}>
                  {statusResolution.message}
                </span>
              </div>
            </div>
          )}

          <div style={{ marginTop: '12px', textAlign: 'right' }}>
            <button style={buttonStyle} onClick={() => setShowRaw(!showRaw)}>
              {showRaw ? 'Ocultar datos técnicos' : 'Ver datos técnicos'}
            </button>
          </div>

          {showRaw && (
            <pre style={{
              marginTop: '12px',
              padding: '12px',
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '11px',
              fontFamily: 'ui-monospace, monospace',
              overflow: 'auto',
              maxHeight: '200px',
              color: '#475569'
            }}>
              {JSON.stringify(debugSnapshot, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
