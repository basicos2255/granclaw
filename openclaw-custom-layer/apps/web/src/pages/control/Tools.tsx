/**
 * Tools Page - Propuestas de herramientas y capacidades
 * FEATURE 090: Tool Proposal System v1
 * FEATURE 091: Approved Capabilities v1
 * FIX 092: UX Feedback improvements
 * FIX 105: Canonical Capability Groups & Cleanup
 */

import { useState, useEffect, useMemo } from 'react'
import { api, type ToolProposal, type ApprovedCapability } from '../../services/api'

// FIX 092: Notice type for toast
interface Notice {
  message: string
  type: 'success' | 'error'
}

// FIX 105: Tool group aggregated by capabilityKey
interface ToolGroup {
  capabilityKey: string
  displayName: string
  proposals: ToolProposal[]
  capability?: ApprovedCapability
  status: 'pending' | 'active' | 'inactive' | 'rejected' | 'archived'
  riskLevel: string
  latestRequestedAction: string
  count: number
}

// FIX 105: Normalize capabilityKey in frontend
function normalizeKey(input: string): string {
  if (!input) return 'unknown'
  return input.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_')
}

export function Tools() {
  const [proposals, setProposals] = useState<ToolProposal[]>([])
  const [capabilities, setCapabilities] = useState<ApprovedCapability[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState<ToolGroup | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [cleaningUp, setCleaningUp] = useState(false)

  useEffect(() => {
    loadData()

    // FIX 105: Listen for session expired event
    const handleSessionExpired = () => {
      setNotice({ message: 'Sesion expirada. Inicia sesion de nuevo.', type: 'error' })
    }
    window.addEventListener('session-expired', handleSessionExpired)
    return () => window.removeEventListener('session-expired', handleSessionExpired)
  }, [])

  // Auto-hide notice after 3 seconds
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [notice])

  const loadData = async () => {
    setLoading(true)
    try {
      const [proposalsRes, capabilitiesRes] = await Promise.all([
        api.getToolProposals(),
        api.getCapabilities()
      ])
      if (proposalsRes.success && proposalsRes.data) {
        setProposals(proposalsRes.data)
      }
      if (capabilitiesRes.success && capabilitiesRes.data) {
        setCapabilities(capabilitiesRes.data)
      }
    } catch {
      setNotice({ message: 'Error cargando datos', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // FIX 105: Get capability by capabilityKey (not proposalId)
  const getCapabilityForKey = (capabilityKey: string): ApprovedCapability | undefined => {
    const normalized = normalizeKey(capabilityKey)
    return capabilities.find(c => normalizeKey(c.capabilityKey) === normalized)
  }

  // FIX 105: Group proposals by capabilityKey
  const toolGroups = useMemo((): ToolGroup[] => {
    const groupMap = new Map<string, ToolGroup>()

    // Group proposals by capabilityKey
    for (const p of proposals) {
      const key = normalizeKey(p.capabilityKey || p.proposedToolName)

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          capabilityKey: key,
          displayName: p.proposedToolName || key,
          proposals: [],
          capability: undefined,
          status: 'pending',
          riskLevel: p.riskLevel,
          latestRequestedAction: p.requestedAction,
          count: 0
        })
      }

      const group = groupMap.get(key)!
      group.proposals.push(p)
      group.count++

      // Update with most recent
      if (new Date(p.createdAt) > new Date(group.latestRequestedAction)) {
        group.latestRequestedAction = p.requestedAction
      }
    }

    // Add capabilities and determine status
    for (const group of groupMap.values()) {
      const cap = getCapabilityForKey(group.capabilityKey)
      group.capability = cap

      // Determine group status
      const hasApproved = group.proposals.some(p => p.status === 'approved')
      const hasPending = group.proposals.some(p => p.status === 'pending')
      const allRejected = group.proposals.every(p => p.status === 'rejected' || p.status === 'archived')

      if (cap) {
        group.status = cap.enabled ? 'active' : 'inactive'
      } else if (hasApproved) {
        group.status = 'active' // Should have cap, edge case
      } else if (hasPending) {
        group.status = 'pending'
      } else if (allRejected) {
        group.status = 'rejected'
      }
    }

    // Sort: pending first, then active, inactive, rejected
    const statusOrder = { pending: 0, active: 1, inactive: 2, rejected: 3, archived: 4 }
    return Array.from(groupMap.values()).sort((a, b) => {
      return statusOrder[a.status] - statusOrder[b.status]
    })
  }, [proposals, capabilities])

  // Action handlers
  const handleApprove = async (proposalId: string) => {
    if (actionLoading) return
    setActionLoading(proposalId)
    try {
      const response = await api.approveToolProposal(proposalId)
      if (response.success) {
        setSelectedGroup(null)
        setNotice({ message: 'Capacidad aprobada', type: 'success' })
        await loadData()
      } else {
        setNotice({ message: response.error || 'Error al aprobar', type: 'error' })
      }
    } catch {
      setNotice({ message: 'Error al aprobar', type: 'error' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (proposalId: string) => {
    if (actionLoading) return
    setActionLoading(proposalId)
    try {
      const response = await api.rejectToolProposal(proposalId)
      if (response.success) {
        setSelectedGroup(null)
        setNotice({ message: 'Propuesta rechazada', type: 'success' })
        await loadData()
      } else {
        setNotice({ message: response.error || 'Error al rechazar', type: 'error' })
      }
    } catch {
      setNotice({ message: 'Error al rechazar', type: 'error' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleCapability = async (capabilityId: string, enable: boolean) => {
    if (actionLoading) return
    setActionLoading(capabilityId)
    try {
      const response = enable
        ? await api.enableCapability(capabilityId)
        : await api.disableCapability(capabilityId)
      if (response.success) {
        setNotice({ message: enable ? 'Capacidad activada' : 'Capacidad desactivada', type: 'success' })
        await loadData()
      } else {
        setNotice({ message: response.error || 'Error', type: 'error' })
      }
    } catch {
      setNotice({ message: 'Error al cambiar estado', type: 'error' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteCapability = async (capabilityId: string) => {
    if (actionLoading) return
    setActionLoading(capabilityId)
    try {
      const response = await api.deleteCapability(capabilityId)
      if (response.success) {
        setSelectedGroup(null)
        setNotice({ message: 'Capacidad eliminada', type: 'success' })
        await loadData()
      } else {
        setNotice({ message: response.error || 'Error al eliminar', type: 'error' })
      }
    } catch {
      setNotice({ message: 'Error al eliminar', type: 'error' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleArchive = async (proposalId: string) => {
    if (actionLoading) return
    setActionLoading(proposalId)
    try {
      const response = await api.archiveToolProposal(proposalId)
      if (response.success) {
        setNotice({ message: 'Propuesta archivada', type: 'success' })
        await loadData()
      } else {
        setNotice({ message: response.error || 'Error al archivar', type: 'error' })
      }
    } catch {
      setNotice({ message: 'Error al archivar', type: 'error' })
    } finally {
      setActionLoading(null)
    }
  }

  // FIX 105: Cleanup duplicates
  const handleCleanup = async () => {
    if (cleaningUp) return
    setCleaningUp(true)
    try {
      const response = await api.cleanupToolProposals()
      if (response.success && response.data) {
        const { archivedProposals, deletedCapabilities } = response.data
        setNotice({
          message: `Limpieza completa: ${archivedProposals} archivadas, ${deletedCapabilities} eliminadas`,
          type: 'success'
        })
        await loadData()
      } else {
        setNotice({ message: response.error || 'Error al limpiar', type: 'error' })
      }
    } catch {
      setNotice({ message: 'Error al limpiar duplicados', type: 'error' })
    } finally {
      setCleaningUp(false)
    }
  }

  // Status colors and labels
  const getStatusStyle = (status: ToolGroup['status']) => {
    switch (status) {
      case 'pending': return { bg: '#f5f3ff', border: '#7c3aed', text: '#7c3aed', label: 'PENDIENTE' }
      case 'active': return { bg: '#dcfce7', border: '#16a34a', text: '#16a34a', label: 'ACTIVA' }
      case 'inactive': return { bg: '#fef3c7', border: '#d97706', text: '#d97706', label: 'INACTIVA' }
      case 'rejected': return { bg: '#fee2e2', border: '#dc2626', text: '#dc2626', label: 'RECHAZADA' }
      case 'archived': return { bg: '#f3f4f6', border: '#6b7280', text: '#6b7280', label: 'ARCHIVADA' }
    }
  }

  const getRiskStyle = (risk: string) => {
    switch (risk) {
      case 'high': return { bg: '#fee2e2', text: '#dc2626', label: 'ALTO' }
      case 'medium': return { bg: '#fef3c7', text: '#d97706', label: 'MEDIO' }
      case 'low': return { bg: '#dcfce7', text: '#16a34a', label: 'BAJO' }
      default: return { bg: '#f3f4f6', text: '#6b7280', label: risk.toUpperCase() }
    }
  }

  // Styles
  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: '#f9fafb',
    position: 'relative'
  }

  const containerStyle: React.CSSProperties = {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '48px 24px'
  }

  const headerStyle: React.CSSProperties = {
    marginBottom: '40px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap'
  }

  const buttonRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px'
  }

  const buttonStyle = (variant: 'primary' | 'secondary' | 'danger', disabled?: boolean): React.CSSProperties => ({
    padding: '10px 20px',
    backgroundColor: variant === 'primary' ? '#7c3aed' : variant === 'danger' ? '#dc2626' : '#f3f4f6',
    color: variant === 'secondary' ? '#374151' : 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    opacity: disabled ? 0.7 : 1
  })

  const cardStyle = (status: ToolGroup['status']): React.CSSProperties => {
    const style = getStatusStyle(status)
    return {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '20px',
      backgroundColor: status === 'pending' ? 'white' : style.bg,
      borderRadius: '14px',
      border: `2px solid ${style.border}`,
      cursor: 'pointer',
      transition: 'transform 0.1s ease'
    }
  }

  const noticeStyle: React.CSSProperties = {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '14px 28px',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '500',
    zIndex: 2000,
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    backgroundColor: notice?.type === 'success' ? '#16a34a' : '#dc2626',
    color: 'white'
  }

  // Get primary pending proposal for approve/reject actions
  const getPrimaryProposal = (group: ToolGroup): ToolProposal | null => {
    return group.proposals.find(p => p.status === 'pending') || null
  }

  return (
    <div style={pageStyle}>
      {notice && <div style={noticeStyle}>{notice.message}</div>}

      <div style={containerStyle}>
        <div style={headerStyle}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#111827', marginBottom: '12px' }}>
              Herramientas
            </h1>
            <p style={{ fontSize: '18px', color: '#6b7280', lineHeight: '1.6' }}>
              Gestiona las capacidades de GranClaw agrupadas por tipo
            </p>
          </div>
          <div style={buttonRowStyle}>
            <button
              style={buttonStyle('secondary', cleaningUp)}
              onClick={handleCleanup}
              disabled={cleaningUp}
              title="Limpia duplicados y archiva propuestas obsoletas"
            >
              {cleaningUp ? 'Limpiando...' : 'Limpiar duplicados'}
            </button>
            <button
              style={buttonStyle('primary', loading)}
              onClick={loadData}
              disabled={loading}
            >
              {loading ? 'Cargando...' : 'Actualizar'}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
            Cargando herramientas...
          </div>
        ) : toolGroups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>🧩</div>
            <div style={{ color: '#6b7280', fontSize: '16px' }}>Sin herramientas</div>
            <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '8px' }}>
              Las propuestas aparecen cuando GranClaw detecta una accion que no puede ejecutar
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {toolGroups.map((group) => {
              const statusStyle = getStatusStyle(group.status)
              const riskStyle = getRiskStyle(group.riskLevel)
              const primaryProposal = getPrimaryProposal(group)

              return (
                <div
                  key={group.capabilityKey}
                  style={cardStyle(group.status)}
                  onClick={() => setSelectedGroup(group)}
                >
                  {/* Header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '44px', height: '44px', borderRadius: '50%',
                        backgroundColor: statusStyle.bg, border: `2px solid ${statusStyle.border}`,
                        fontSize: '20px', flexShrink: 0
                      }}>
                        🧩
                      </div>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>
                          {group.displayName}
                        </div>
                        <div style={{ fontSize: '13px', color: '#6b7280', fontFamily: 'monospace' }}>
                          {group.capabilityKey}
                        </div>
                      </div>
                    </div>

                    {/* Status and risk badges */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '12px',
                        backgroundColor: riskStyle.bg, color: riskStyle.text
                      }}>
                        {riskStyle.label}
                      </span>
                      <span style={{
                        fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '12px',
                        backgroundColor: statusStyle.bg, color: statusStyle.text
                      }}>
                        {statusStyle.label}
                      </span>
                      {group.count > 1 && (
                        <span style={{
                          fontSize: '11px', fontWeight: '500', padding: '2px 8px', borderRadius: '12px',
                          backgroundColor: '#e5e7eb', color: '#6b7280'
                        }}>
                          {group.count} solicitudes
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>
                    {group.latestRequestedAction}
                  </div>

                  {/* FIX 105: Action buttons directly on card */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }} onClick={e => e.stopPropagation()}>
                    {group.status === 'pending' && primaryProposal && (
                      <>
                        <button
                          style={buttonStyle('primary', !!actionLoading)}
                          onClick={() => handleApprove(primaryProposal.id)}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === primaryProposal.id ? '...' : 'Aprobar'}
                        </button>
                        <button
                          style={buttonStyle('danger', !!actionLoading)}
                          onClick={() => handleReject(primaryProposal.id)}
                          disabled={!!actionLoading}
                        >
                          Rechazar
                        </button>
                      </>
                    )}

                    {group.status === 'active' && group.capability && (
                      <>
                        <button
                          style={buttonStyle('danger', !!actionLoading)}
                          onClick={() => handleToggleCapability(group.capability!.id, false)}
                          disabled={!!actionLoading}
                        >
                          Desactivar
                        </button>
                        <button
                          style={buttonStyle('secondary', !!actionLoading)}
                          onClick={() => handleDeleteCapability(group.capability!.id)}
                          disabled={!!actionLoading}
                        >
                          Eliminar
                        </button>
                      </>
                    )}

                    {group.status === 'inactive' && group.capability && (
                      <>
                        <button
                          style={buttonStyle('primary', !!actionLoading)}
                          onClick={() => handleToggleCapability(group.capability!.id, true)}
                          disabled={!!actionLoading}
                        >
                          Activar
                        </button>
                        <button
                          style={buttonStyle('secondary', !!actionLoading)}
                          onClick={() => handleDeleteCapability(group.capability!.id)}
                          disabled={!!actionLoading}
                        >
                          Eliminar
                        </button>
                      </>
                    )}

                    {group.status === 'rejected' && primaryProposal && (
                      <button
                        style={buttonStyle('secondary', !!actionLoading)}
                        onClick={() => handleArchive(primaryProposal.id)}
                        disabled={!!actionLoading}
                      >
                        Archivar
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Detail modal */}
        {selectedGroup && (
          <div
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1000
            }}
            onClick={() => !actionLoading && setSelectedGroup(null)}
          >
            <div
              style={{
                backgroundColor: 'white', borderRadius: '16px', padding: '32px',
                maxWidth: '600px', width: '90%', maxHeight: '80vh', overflow: 'auto'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
                  {selectedGroup.displayName}
                </h2>
                <button
                  style={buttonStyle('secondary', !!actionLoading)}
                  onClick={() => setSelectedGroup(null)}
                  disabled={!!actionLoading}
                >
                  Cerrar
                </button>
              </div>

              {/* Group info */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <span style={{
                    fontSize: '12px', fontWeight: '600', padding: '4px 12px', borderRadius: '12px',
                    backgroundColor: getStatusStyle(selectedGroup.status).bg,
                    color: getStatusStyle(selectedGroup.status).text
                  }}>
                    {getStatusStyle(selectedGroup.status).label}
                  </span>
                  <span style={{
                    fontSize: '12px', fontWeight: '600', padding: '4px 12px', borderRadius: '12px',
                    backgroundColor: getRiskStyle(selectedGroup.riskLevel).bg,
                    color: getRiskStyle(selectedGroup.riskLevel).text
                  }}>
                    Riesgo {getRiskStyle(selectedGroup.riskLevel).label}
                  </span>
                </div>

                <p style={{ fontSize: '14px', color: '#6b7280', fontFamily: 'monospace', margin: '8px 0' }}>
                  capabilityKey: {selectedGroup.capabilityKey}
                </p>

                {selectedGroup.capability && (
                  <p style={{ fontSize: '14px', color: '#6b7280', fontFamily: 'monospace', margin: '8px 0' }}>
                    capabilityId: {selectedGroup.capability.id}
                  </p>
                )}
              </div>

              {/* Proposals list */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
                  Solicitudes ({selectedGroup.count})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedGroup.proposals.map(p => (
                    <div
                      key={p.id}
                      style={{
                        padding: '12px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '8px',
                        fontSize: '13px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '500', color: '#374151' }}>
                          {p.requestedAction.slice(0, 50)}{p.requestedAction.length > 50 ? '...' : ''}
                        </span>
                        <span style={{
                          fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '12px',
                          backgroundColor: p.status === 'approved' ? '#dcfce7' :
                            p.status === 'pending' ? '#f5f3ff' :
                              p.status === 'rejected' ? '#fee2e2' : '#f3f4f6',
                          color: p.status === 'approved' ? '#16a34a' :
                            p.status === 'pending' ? '#7c3aed' :
                              p.status === 'rejected' ? '#dc2626' : '#6b7280'
                        }}>
                          {p.status.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                        {new Date(p.createdAt).toLocaleString('es-ES')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions in modal */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                {selectedGroup.status === 'pending' && (() => {
                  const pp = getPrimaryProposal(selectedGroup)
                  if (!pp) return null
                  return (
                    <>
                      <button
                        style={buttonStyle('danger', !!actionLoading)}
                        onClick={() => handleReject(pp.id)}
                        disabled={!!actionLoading}
                      >
                        Rechazar
                      </button>
                      <button
                        style={buttonStyle('primary', !!actionLoading)}
                        onClick={() => handleApprove(pp.id)}
                        disabled={!!actionLoading}
                      >
                        Aprobar
                      </button>
                    </>
                  )
                })()}

                {(selectedGroup.status === 'active' || selectedGroup.status === 'inactive') && selectedGroup.capability && (
                  <>
                    <button
                      style={buttonStyle('secondary', !!actionLoading)}
                      onClick={() => handleDeleteCapability(selectedGroup.capability!.id)}
                      disabled={!!actionLoading}
                    >
                      Eliminar
                    </button>
                    <button
                      style={buttonStyle(selectedGroup.status === 'active' ? 'danger' : 'primary', !!actionLoading)}
                      onClick={() => handleToggleCapability(
                        selectedGroup.capability!.id,
                        selectedGroup.status !== 'active'
                      )}
                      disabled={!!actionLoading}
                    >
                      {selectedGroup.status === 'active' ? 'Desactivar' : 'Activar'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
