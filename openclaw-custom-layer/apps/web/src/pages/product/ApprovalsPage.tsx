/**
 * Approvals Page - Approval Center
 * P2: Product Experience Layer
 *
 * Central approval management for OS tools, purchases, etc.
 */

import { useState, useEffect } from 'react'
import { useApprovalEvents, useRuntimeWs } from '../../hooks/useRuntimeWs'

interface ApprovalRequest {
  id: string
  action: string
  reason: string
  workflowId?: string
  nodeId?: string
  requiredBy: string
  status: 'pending' | 'approved' | 'denied'
  createdAt: string
  expiresAt?: string
  metadata?: Record<string, unknown>
}

export function ApprovalsPage() {
  const { isConnected } = useRuntimeWs()
  const { lastEvent } = useApprovalEvents()

  const [approvals, setApprovals] = useState<ApprovalRequest[]>([])
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')

  // Listen for live approval events
  useEffect(() => {
    if (lastEvent) {
      const event = lastEvent.frame.event
      const payload = lastEvent.payload as ApprovalRequest & { approvalId: string }

      if (event === 'approval:required') {
        const newApproval: ApprovalRequest = {
          id: payload.approvalId,
          action: payload.action,
          reason: payload.reason,
          workflowId: payload.workflowId,
          requiredBy: payload.requiredBy,
          status: 'pending',
          createdAt: new Date().toISOString(),
          expiresAt: payload.expiresAt,
          metadata: payload.metadata
        }
        setApprovals(prev => [newApproval, ...prev.filter(a => a.id !== newApproval.id)])
      }
    }
  }, [lastEvent])

  const handleApproval = (id: string, action: 'approve' | 'deny') => {
    setApprovals(prev =>
      prev.map(a => a.id === id ? { ...a, status: action === 'approve' ? 'approved' : 'denied' } : a)
    )
  }

  const filteredApprovals = filter === 'pending'
    ? approvals.filter(a => a.status === 'pending')
    : approvals

  const pendingCount = approvals.filter(a => a.status === 'pending').length

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '20px',
    marginBottom: '12px'
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a' }}>Aprobaciones</h1>
          {pendingCount > 0 && (
            <span style={{
              padding: '4px 12px',
              borderRadius: '20px',
              backgroundColor: '#fef3c7',
              color: '#d97706',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              {pendingCount} pendientes
            </span>
          )}
          {isConnected && (
            <span style={{
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: '600',
              backgroundColor: '#dcfce7',
              color: '#16a34a'
            }}>
              LIVE
            </span>
          )}
        </div>
        <p style={{ color: '#64748b' }}>Centro de aprobaciones para acciones sensibles</p>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button
          onClick={() => setFilter('pending')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: filter === 'pending' ? '#0f172a' : '#f1f5f9',
            color: filter === 'pending' ? 'white' : '#64748b',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          Pendientes ({pendingCount})
        </button>
        <button
          onClick={() => setFilter('all')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: filter === 'all' ? '#0f172a' : '#f1f5f9',
            color: filter === 'all' ? 'white' : '#64748b',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          Todas ({approvals.length})
        </button>
      </div>

      {/* Approvals List */}
      {filteredApprovals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
          <div>No hay aprobaciones pendientes</div>
        </div>
      ) : (
        <div>
          {filteredApprovals.map(approval => (
            <div key={approval.id} style={{
              ...cardStyle,
              borderColor: approval.status === 'pending' ? '#fcd34d' : '#e2e8f0',
              backgroundColor: approval.status === 'pending' ? '#fffbeb' : 'white'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontWeight: '600', color: '#0f172a' }}>{approval.action}</span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      backgroundColor: approval.status === 'pending' ? '#fef3c7' :
                        (approval.status === 'approved' ? '#dcfce7' : '#fee2e2'),
                      color: approval.status === 'pending' ? '#d97706' :
                        (approval.status === 'approved' ? '#16a34a' : '#dc2626')
                    }}>
                      {approval.status === 'pending' ? 'Pendiente' :
                        (approval.status === 'approved' ? 'Aprobada' : 'Denegada')}
                    </span>
                  </div>
                  <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
                    {approval.reason}
                  </div>
                  {approval.workflowId && (
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                      Workflow: {approval.workflowId.slice(0, 20)}...
                    </div>
                  )}
                </div>

                {approval.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleApproval(approval.id, 'approve')}
                      style={{
                        padding: '8px 16px',
                        fontSize: '13px',
                        backgroundColor: '#16a34a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      ✓ Aprobar
                    </button>
                    <button
                      onClick={() => handleApproval(approval.id, 'deny')}
                      style={{
                        padding: '8px 16px',
                        fontSize: '13px',
                        backgroundColor: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      ✕ Denegar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
