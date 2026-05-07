/**
 * NotificationPanel Component
 * P1.2: Live WebSocket notifications and approvals
 *
 * Displays notifications and approval requests in real-time.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNotificationEvents, useApprovalEvents, useRuntimeWs } from '../../hooks/useRuntimeWs'

/**
 * Notification types
 */
interface Notification {
  id: string
  type: 'info' | 'warning' | 'error' | 'success' | 'action'
  title: string
  message: string
  timestamp: string
  read: boolean
  actionUrl?: string
  actionLabel?: string
  persistent?: boolean
}

/**
 * Approval request types
 */
interface ApprovalRequest {
  id: string
  workflowId?: string
  nodeId?: string
  action: string
  reason: string
  requiredBy: string
  expiresAt?: string
  status: 'pending' | 'approved' | 'denied'
  timestamp: string
  metadata?: Record<string, unknown>
}

/**
 * Props for NotificationPanel
 */
interface NotificationPanelProps {
  /** Whether panel is visible */
  isOpen: boolean
  /** Close handler */
  onClose: () => void
  /** Position */
  position?: 'top-right' | 'bottom-right'
}

/**
 * Get notification icon
 */
function getNotificationIcon(type: Notification['type']): string {
  switch (type) {
    case 'success': return '✓'
    case 'warning': return '⚠'
    case 'error': return '✕'
    case 'action': return '⚡'
    default: return 'ℹ'
  }
}

/**
 * Get notification color
 */
function getNotificationColor(type: Notification['type']): string {
  switch (type) {
    case 'success': return '#16a34a'
    case 'warning': return '#d97706'
    case 'error': return '#dc2626'
    case 'action': return '#7c3aed'
    default: return '#2563eb'
  }
}

/**
 * NotificationPanel component
 */
export function NotificationPanel({ isOpen, onClose, position = 'top-right' }: NotificationPanelProps) {
  const { isConnected } = useRuntimeWs()
  const { lastEvent: notificationEvent } = useNotificationEvents()
  const { lastEvent: approvalEvent } = useApprovalEvents()

  // State
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([])
  const [activeTab, setActiveTab] = useState<'notifications' | 'approvals'>('notifications')
  const [loading, setLoading] = useState(false)

  // Handle incoming notification events
  useEffect(() => {
    if (notificationEvent?.payload) {
      const payload = notificationEvent.payload as Notification & { notificationId: string }
      const newNotification: Notification = {
        id: payload.notificationId || payload.id,
        type: payload.type || 'info',
        title: payload.title || 'Notification',
        message: payload.message || '',
        timestamp: payload.timestamp || new Date().toISOString(),
        read: false,
        actionUrl: payload.actionUrl,
        actionLabel: payload.actionLabel,
        persistent: payload.persistent
      }

      setNotifications(prev => [newNotification, ...prev.slice(0, 49)]) // Keep last 50
    }
  }, [notificationEvent])

  // Handle incoming approval events
  useEffect(() => {
    if (approvalEvent?.payload) {
      const event = approvalEvent.frame.event
      const payload = approvalEvent.payload as ApprovalRequest & { approvalId: string }

      if (event === 'approval:required') {
        const newApproval: ApprovalRequest = {
          id: payload.approvalId || payload.id,
          workflowId: payload.workflowId,
          nodeId: payload.nodeId,
          action: payload.action || 'unknown',
          reason: payload.reason || '',
          requiredBy: payload.requiredBy || '',
          expiresAt: payload.expiresAt,
          status: 'pending',
          timestamp: payload.timestamp || new Date().toISOString(),
          metadata: payload.metadata
        }

        setApprovals(prev => [newApproval, ...prev.filter(a => a.id !== newApproval.id)])
      } else if (event === 'approval:granted' || event === 'approval:denied') {
        const status = event === 'approval:granted' ? 'approved' : 'denied'
        setApprovals(prev =>
          prev.map(a => a.id === payload.approvalId ? { ...a, status } : a)
        )
      }
    }
  }, [approvalEvent])

  // Mark notification as read
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
  }, [])

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  // Handle approval action
  const handleApproval = useCallback(async (approvalId: string, action: 'approve' | 'deny') => {
    try {
      setLoading(true)
      // TODO: Call API to approve/deny
      // For now, update local state
      setApprovals(prev =>
        prev.map(a => a.id === approvalId ? { ...a, status: action === 'approve' ? 'approved' : 'denied' } : a)
      )
    } catch (err) {
      console.error('Error handling approval:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Dismiss approval
  const dismissApproval = useCallback((id: string) => {
    setApprovals(prev => prev.filter(a => a.id !== id))
  }, [])

  // Count unread/pending
  const unreadCount = notifications.filter(n => !n.read).length
  const pendingApprovalsCount = approvals.filter(a => a.status === 'pending').length

  if (!isOpen) return null

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    top: position === 'top-right' ? '70px' : 'auto',
    bottom: position === 'bottom-right' ? '20px' : 'auto',
    right: '20px',
    width: '380px',
    maxHeight: '500px',
    backgroundColor: 'white',
    borderRadius: '16px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
    border: '1px solid #e5e7eb',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  }

  const headerStyle: React.CSSProperties = {
    padding: '16px 20px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  }

  const tabsStyle: React.CSSProperties = {
    display: 'flex',
    borderBottom: '1px solid #e5e7eb'
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '12px',
    textAlign: 'center',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: active ? '600' : '400',
    color: active ? '#2563eb' : '#6b7280',
    backgroundColor: active ? '#f8fafc' : 'transparent',
    borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
    transition: 'all 0.15s'
  })

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '8px'
  }

  const emptyStyle: React.CSSProperties = {
    padding: '40px 20px',
    textAlign: 'center',
    color: '#9ca3af'
  }

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)

    if (minutes < 1) return 'Ahora'
    if (minutes < 60) return `${minutes}m`
    if (hours < 24) return `${hours}h`
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999
        }}
        onClick={onClose}
      />

      <div style={panelStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px', fontWeight: '600' }}>Notificaciones</span>
            {isConnected && (
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#16a34a',
                animation: 'pulse 2s infinite'
              }} />
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div style={tabsStyle}>
          <div
            style={tabStyle(activeTab === 'notifications')}
            onClick={() => setActiveTab('notifications')}
          >
            Notificaciones {unreadCount > 0 && `(${unreadCount})`}
          </div>
          <div
            style={tabStyle(activeTab === 'approvals')}
            onClick={() => setActiveTab('approvals')}
          >
            Aprobaciones {pendingApprovalsCount > 0 && `(${pendingApprovalsCount})`}
          </div>
        </div>

        {/* Content */}
        <div style={contentStyle}>
          {activeTab === 'notifications' ? (
            notifications.length === 0 ? (
              <div style={emptyStyle}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔔</div>
                <div>Sin notificaciones</div>
              </div>
            ) : (
              <>
                {unreadCount > 0 && (
                  <button
                    onClick={clearAll}
                    style={{
                      width: '100%',
                      padding: '8px',
                      marginBottom: '8px',
                      backgroundColor: '#f3f4f6',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#6b7280',
                      cursor: 'pointer'
                    }}
                  >
                    Limpiar todas
                  </button>
                )}
                {notifications.map(notification => (
                  <div
                    key={notification.id}
                    onClick={() => markAsRead(notification.id)}
                    style={{
                      padding: '12px',
                      marginBottom: '8px',
                      backgroundColor: notification.read ? 'white' : '#f8fafc',
                      borderRadius: '12px',
                      border: `1px solid ${notification.read ? '#e5e7eb' : getNotificationColor(notification.type)}20`,
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: `${getNotificationColor(notification.type)}15`,
                        color: getNotificationColor(notification.type),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        flexShrink: 0
                      }}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#111827',
                          marginBottom: '2px'
                        }}>
                          {notification.title}
                        </div>
                        <div style={{
                          fontSize: '13px',
                          color: '#6b7280',
                          lineHeight: '1.4'
                        }}>
                          {notification.message}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: '#9ca3af',
                          marginTop: '4px'
                        }}>
                          {formatTime(notification.timestamp)}
                        </div>
                      </div>
                      {!notification.read && (
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: getNotificationColor(notification.type),
                          flexShrink: 0
                        }} />
                      )}
                    </div>
                  </div>
                ))}
              </>
            )
          ) : (
            approvals.length === 0 ? (
              <div style={emptyStyle}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>✓</div>
                <div>Sin aprobaciones pendientes</div>
              </div>
            ) : (
              approvals.map(approval => (
                <div
                  key={approval.id}
                  style={{
                    padding: '14px',
                    marginBottom: '8px',
                    backgroundColor: approval.status === 'pending' ? '#fef3c7' : 'white',
                    borderRadius: '12px',
                    border: `1px solid ${approval.status === 'pending' ? '#fcd34d' : '#e5e7eb'}`
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#111827'
                    }}>
                      {approval.action}
                    </div>
                    <div style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: '600',
                      backgroundColor: approval.status === 'pending' ? '#fef3c7' : (approval.status === 'approved' ? '#dcfce7' : '#fee2e2'),
                      color: approval.status === 'pending' ? '#d97706' : (approval.status === 'approved' ? '#16a34a' : '#dc2626')
                    }}>
                      {approval.status === 'pending' ? 'Pendiente' : (approval.status === 'approved' ? 'Aprobada' : 'Denegada')}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: '#6b7280',
                    marginBottom: '8px'
                  }}>
                    {approval.reason}
                  </div>
                  {approval.workflowId && (
                    <div style={{
                      fontSize: '11px',
                      color: '#9ca3af',
                      fontFamily: 'monospace',
                      marginBottom: '8px'
                    }}>
                      Workflow: {approval.workflowId.slice(0, 20)}...
                    </div>
                  )}

                  {approval.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <button
                        onClick={() => handleApproval(approval.id, 'approve')}
                        disabled={loading}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          backgroundColor: '#16a34a',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '500',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          opacity: loading ? 0.6 : 1
                        }}
                      >
                        ✓ Aprobar
                      </button>
                      <button
                        onClick={() => handleApproval(approval.id, 'deny')}
                        disabled={loading}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          backgroundColor: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '500',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          opacity: loading ? 0.6 : 1
                        }}
                      >
                        ✕ Denegar
                      </button>
                    </div>
                  )}

                  {approval.status !== 'pending' && (
                    <button
                      onClick={() => dismissApproval(approval.id)}
                      style={{
                        width: '100%',
                        padding: '6px',
                        marginTop: '8px',
                        backgroundColor: '#f3f4f6',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#6b7280',
                        cursor: 'pointer'
                      }}
                    >
                      Descartar
                    </button>
                  )}

                  <div style={{
                    fontSize: '11px',
                    color: '#9ca3af',
                    marginTop: '8px'
                  }}>
                    {formatTime(approval.timestamp)}
                  </div>
                </div>
              ))
            )
          )}
        </div>

        {/* CSS for animations */}
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </div>
    </>
  )
}

/**
 * NotificationBell component - shows bell icon with badge
 */
interface NotificationBellProps {
  onClick: () => void
  unreadCount?: number
}

export function NotificationBell({ onClick, unreadCount = 0 }: NotificationBellProps) {
  const { isConnected } = useRuntimeWs()

  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        background: 'none',
        border: 'none',
        fontSize: '22px',
        cursor: 'pointer',
        padding: '8px',
        borderRadius: '8px',
        transition: 'background-color 0.15s'
      }}
      title={isConnected ? 'Notificaciones (Live)' : 'Notificaciones'}
    >
      🔔
      {unreadCount > 0 && (
        <span style={{
          position: 'absolute',
          top: '4px',
          right: '4px',
          minWidth: '18px',
          height: '18px',
          padding: '0 5px',
          borderRadius: '9px',
          backgroundColor: '#dc2626',
          color: 'white',
          fontSize: '11px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
      {isConnected && (
        <span style={{
          position: 'absolute',
          bottom: '4px',
          right: '4px',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: '#16a34a',
          border: '2px solid white'
        }} />
      )}
    </button>
  )
}

/**
 * Hook for managing notification panel state
 */
export function useNotificationPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const { lastEvent: notificationEvent } = useNotificationEvents()
  const { lastEvent: approvalEvent } = useApprovalEvents()
  const [unreadCount, setUnreadCount] = useState(0)

  // Track unread count
  useEffect(() => {
    if (notificationEvent) {
      setUnreadCount(prev => prev + 1)
    }
  }, [notificationEvent])

  useEffect(() => {
    if (approvalEvent?.frame.event === 'approval:required') {
      setUnreadCount(prev => prev + 1)
    }
  }, [approvalEvent])

  const open = useCallback(() => {
    setIsOpen(true)
    setUnreadCount(0)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  const toggle = useCallback(() => {
    if (isOpen) {
      close()
    } else {
      open()
    }
  }, [isOpen, open, close])

  return {
    isOpen,
    open,
    close,
    toggle,
    unreadCount
  }
}
