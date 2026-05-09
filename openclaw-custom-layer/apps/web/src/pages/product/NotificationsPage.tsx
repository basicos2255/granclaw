/**
 * Notifications Page
 * P2: Product Experience Layer
 * P6.1: Functional notification actions with localStorage persistence
 *
 * Notification center for all system events.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNotificationEvents, useRuntimeWs } from '../../hooks/useRuntimeWs'

// P6.1: localStorage key for notification state
const NOTIFICATIONS_KEY = 'granclaw_notifications'
const READ_IDS_KEY = 'granclaw_read_notification_ids'

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
  const [readIds, setReadIds] = useState<Set<string>>(new Set())

  // P6.1: Load from localStorage on mount
  useEffect(() => {
    try {
      const savedNotifs = localStorage.getItem(NOTIFICATIONS_KEY)
      if (savedNotifs) {
        setNotifications(JSON.parse(savedNotifs))
      }
      const savedReadIds = localStorage.getItem(READ_IDS_KEY)
      if (savedReadIds) {
        setReadIds(new Set(JSON.parse(savedReadIds)))
      }
    } catch (err) {
      console.error('Error loading notifications from localStorage:', err)
    }
  }, [])

  // P6.1: Save to localStorage on change
  const persistNotifications = useCallback((notifs: Notification[]) => {
    try {
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifs.slice(0, 100)))
    } catch (err) {
      console.error('Error saving notifications:', err)
    }
  }, [])

  const persistReadIds = useCallback((ids: Set<string>) => {
    try {
      localStorage.setItem(READ_IDS_KEY, JSON.stringify([...ids].slice(-200)))
    } catch (err) {
      console.error('Error saving read IDs:', err)
    }
  }, [])

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
      setNotifications(prev => {
        const updated = [newNotif, ...prev.filter(n => n.id !== newNotif.id).slice(0, 99)]
        persistNotifications(updated)
        return updated
      })
    }
  }, [lastEvent, persistNotifications])

  // P6.1: Apply read state from readIds
  const notificationsWithReadState = notifications.map(n => ({
    ...n,
    read: n.read || readIds.has(n.id)
  }))

  const markAllRead = () => {
    const allIds = new Set([...readIds, ...notifications.map(n => n.id)])
    setReadIds(allIds)
    persistReadIds(allIds)
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }))
      persistNotifications(updated)
      return updated
    })
  }

  const markRead = (id: string) => {
    const newReadIds = new Set([...readIds, id])
    setReadIds(newReadIds)
    persistReadIds(newReadIds)
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n)
      persistNotifications(updated)
      return updated
    })
  }

  // P6.1: Dismiss notification
  const dismissNotification = (id: string) => {
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id)
      persistNotifications(updated)
      return updated
    })
  }

  // P6.1: Clear all notifications
  const clearAll = () => {
    setNotifications([])
    persistNotifications([])
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
    ? notificationsWithReadState.filter(n => !n.read)
    : notificationsWithReadState

  const unreadCount = notificationsWithReadState.filter(n => !n.read).length

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
        <div style={{ display: 'flex', gap: '8px' }}>
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
              Marcar todas leidas
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              style={{
                padding: '8px 16px',
                backgroundColor: '#fee2e2',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#dc2626',
                cursor: 'pointer'
              }}
            >
              Limpiar todo
            </button>
          )}
        </div>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {!notification.read && (
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#3b82f6'
                      }} />
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); dismissNotification(notification.id) }}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '4px',
                        cursor: 'pointer',
                        color: '#94a3b8',
                        fontSize: '16px',
                        lineHeight: 1,
                        borderRadius: '4px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#64748b'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                      title="Descartar"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
