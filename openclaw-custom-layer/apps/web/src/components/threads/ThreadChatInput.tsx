/**
 * Thread Chat Input Component
 * P6.6: Human Interaction Layer, Task Threads & Conversational Control
 *
 * Input for sending messages to a task thread.
 */

import { useState, useRef, useEffect } from 'react'

interface ThreadChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
  quickActions?: Array<{
    label: string
    action: string
  }>
}

export function ThreadChatInput({
  onSend,
  disabled = false,
  placeholder = 'Escribe una instruccion para esta tarea...',
  quickActions = [
    { label: 'Continuar', action: 'continua' },
    { label: 'Pausar', action: 'pausa' },
    { label: 'Cancelar', action: 'cancela' }
  ]
}: ThreadChatInputProps) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`
    }
  }, [message])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim() && !disabled) {
      onSend(message.trim())
      setMessage('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleQuickAction = (action: string) => {
    if (!disabled) {
      onSend(action)
    }
  }

  return (
    <div style={{
      borderTop: '1px solid #e2e8f0',
      padding: '12px 16px',
      backgroundColor: 'white'
    }}>
      {/* Quick actions */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '12px',
        flexWrap: 'wrap'
      }}>
        {quickActions.map((qa) => (
          <button
            key={qa.action}
            onClick={() => handleQuickAction(qa.action)}
            disabled={disabled}
            style={{
              padding: '6px 12px',
              backgroundColor: disabled ? '#f1f5f9' : '#f8fafc',
              color: disabled ? '#94a3b8' : '#475569',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              fontSize: '12px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseOver={(e) => {
              if (!disabled) {
                e.currentTarget.style.backgroundColor = '#e2e8f0'
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = disabled ? '#f1f5f9' : '#f8fafc'
            }}
          >
            {qa.label}
          </button>
        ))}
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          style={{
            flex: 1,
            padding: '10px 14px',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            resize: 'none',
            fontSize: '14px',
            fontFamily: 'inherit',
            lineHeight: '1.4',
            backgroundColor: disabled ? '#f8fafc' : 'white',
            color: disabled ? '#94a3b8' : '#0f172a',
            outline: 'none',
            transition: 'border-color 0.15s'
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#3b82f6'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#e2e8f0'
          }}
        />
        <button
          type="submit"
          disabled={disabled || !message.trim()}
          style={{
            padding: '10px 20px',
            backgroundColor: disabled || !message.trim() ? '#94a3b8' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: disabled || !message.trim() ? 'not-allowed' : 'pointer',
            fontWeight: '500',
            fontSize: '14px',
            transition: 'background-color 0.15s'
          }}
          onMouseOver={(e) => {
            if (!disabled && message.trim()) {
              e.currentTarget.style.backgroundColor = '#2563eb'
            }
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = disabled || !message.trim() ? '#94a3b8' : '#3b82f6'
          }}
        >
          Enviar
        </button>
      </form>

      {/* Help text */}
      <div style={{
        marginTop: '8px',
        fontSize: '11px',
        color: '#94a3b8'
      }}>
        Presiona Enter para enviar, Shift+Enter para nueva linea
      </div>
    </div>
  )
}
