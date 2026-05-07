/**
 * Notifications Page
 * P2: Product Experience Layer
 *
 * Notification center for all system events.
 */

import { useState, useEffect } from 'react'
import { useNotificationEvents, useRuntimeWs } from '../../hooks/useRuntimeWs'

interface Notification {
  id: string
  type: 'info' | 'warning' | 'error' | 'success'
  title: string
  message: string
  timestamp: string
  read: boolean
  category: 'runtime' | 'workflow' | 'approval' | 'validation' | 'queue' | 'setup'
}

export function NotificationsPage() {
  const { isConnected } = useRuntimeWs()
  const { lastEvent } = useNotificationEvents()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filter, setFilter] = useState<'all' | 'unread'>('unread')

  // Listen for live notifications
  useEffect(() => {
    if (lastEvent?.payload) {
      const payload = lastEvent.payload as Notification & { notificationId: string }
      const newNotif: Notification = {
        id: payload.notificationId || payload.id,
        type: payload.type || 'info',
        title: payload.title || 'Notification',
        message: payload.message || '',
        timestamp: payload.timestamp || new Date().toISOString(),
        read: false,
        category: 'runtime'
      }
      setNotifications(prev => [newNotif, ...prev.slice(0, 99)])
    }
  }, [lastEvent])

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'success': return '✓'
      case 'warning': return '⚠'
      case 'error': return '✕'
      default: return 'ℹ'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success': return { bg: '#dcfce7', text: '#16a34a' }
      case 'warning': return { bg: '#fef3c7', text: '#d97706' }
      case 'error': return { bg: '#fee2e2', text: '#dc2626' }
      default: return { bg: '#dbeafe', text: '#2563eb' }
    }
  }

  const filteredNotifications = filter === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a' }}>Notificaciones</h1>
            {unreadCount > 0 && (
              <span style={{
                padding: '4px 12px',
                borderRadius: '20px',
                backgroundColor: '#3b82f6',
                color: 'white',
                fontSize: '13px',
                fontWeight: '600'
              }}>
                {unreadCount} nuevas
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
          <p style={{ color: '#64748b' }}>Centro de notificaciones del sistema</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f1f5f9',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#475569',
              cursor: 'pointer'
            }}
          >
            Marcar todas como leídas
          </button>
        )}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button
          onClick={() => setFilter('unread')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: filter === 'unread' ? '#0f172a' : '#f1f5f9',
            color: filter === 'unread' ? 'white' : '#64748b',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          Sin leer ({unreadCount})
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
          Todas ({notifications.length})
        </button>
      </div>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔔</div>
          <div>No hay notificaciones {filter === 'unread' && 'sin leer'}</div>
        </div>
      ) : (
        <div>
          {filteredNotifications.map(notification => {
            const typeColor = getTypeColor(notification.type)
            return (
              <div
                key={notification.id}
                onClick={() => markRead(notification.id)}
                style={{
                  backgroundColor: notification.read ? 'white' : '#f8fafc',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  padding: '16px 20px',
                  marginBottom: '8px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: typeColor.bg,
                    color: typeColor.text,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    flexShrink: 0
                  }}>
                    {getTypeIcon(notification.type)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', color: '#0f172a', marginBottom: '4px' }}>
                      {notification.title}
                    </div>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>
                      {notification.message}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
                      {new Date(notification.timestamp).toLocaleString('es-ES')}
                    </div>
                  </div>
                  {!notification.read && (
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#3b82f6',
                      flexShrink: 0
                    }} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
