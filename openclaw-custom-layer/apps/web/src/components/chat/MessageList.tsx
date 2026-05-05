/**
 * MessageList component
 * FIX 036: Product UX - auto-scroll, source labels, better styling
 */

import { useEffect, useRef } from 'react'
import type { ChatMessage } from './types'

interface MessageListProps {
  messages: ChatMessage[]
  loading: boolean
}

/**
 * Format source label discretely
 */
function formatSourceLabel(source?: string, toolId?: string): string {
  if (!source) return ''
  switch (source) {
    case 'openclaw':
      return 'OpenClaw'
    case 'tool':
      return toolId ? `Tool: ${toolId}` : 'Tool'
    case 'mock':
      return 'Fallback'
    default:
      return ''
  }
}

export function MessageList({ messages, loading }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      padding: '16px',
      overflowY: 'auto',
      flex: 1,
      gap: '12px'
    }}>
      {messages.length === 0 && !loading && (
        <div style={{
          textAlign: 'center',
          color: '#999',
          padding: '40px 20px'
        }}>
          Escribe un mensaje para comenzar
        </div>
      )}

      {messages.map((msg, idx) => {
        const isUser = msg.role === 'user'
        const sourceLabel = !isUser ? formatSourceLabel(msg.source, msg.toolId) : ''

        return (
          <div
            key={idx}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: isUser ? 'flex-end' : 'flex-start'
            }}
          >
            <div style={{
              padding: '10px 14px',
              borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              maxWidth: '75%',
              backgroundColor: isUser ? '#007bff' : '#f0f0f0',
              color: isUser ? 'white' : '#333',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}>
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {msg.content}
              </div>
            </div>
            {sourceLabel && (
              <span style={{
                fontSize: '11px',
                color: '#999',
                marginTop: '4px',
                paddingLeft: '4px'
              }}>
                {sourceLabel}
              </span>
            )}
          </div>
        )
      })}

      {loading && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start'
        }}>
          <div style={{
            padding: '10px 14px',
            borderRadius: '16px 16px 16px 4px',
            backgroundColor: '#f0f0f0',
            color: '#666'
          }}>
            <span style={{ display: 'inline-flex', gap: '4px' }}>
              <span>Escribiendo</span>
              <span className="typing-dots">...</span>
            </span>
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  )
}
