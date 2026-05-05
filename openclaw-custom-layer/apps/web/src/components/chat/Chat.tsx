/**
 * Chat component
 * FIX 036: Product UX - sessions, better styling, error handling
 * FIX 037: Real response rendering, better error handling
 * FIX 038: Session contract fix - no invented sessionId, correct response.data parsing
 */

import { useState } from 'react'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { api } from '../../services/api'
import type { ChatMessage } from './types'

/**
 * Format result to string
 * FIX 037: Mejor extracción de contenido de diferentes formatos
 */
function formatResult(result: unknown): string {
  if (result === null || result === undefined) {
    return 'Sin respuesta'
  }
  if (typeof result === 'string') {
    return result
  }
  if (typeof result === 'object' && result !== null) {
    const obj = result as Record<string, unknown>

    // OpenAI chat completions format
    if (Array.isArray(obj.choices) && obj.choices.length > 0) {
      const choice = obj.choices[0] as Record<string, unknown>
      if (choice.message && typeof choice.message === 'object') {
        const msg = choice.message as Record<string, unknown>
        if (typeof msg.content === 'string') {
          return msg.content
        }
      }
      // Delta format (streaming)
      if (choice.delta && typeof choice.delta === 'object') {
        const delta = choice.delta as Record<string, unknown>
        if (typeof delta.content === 'string') {
          return delta.content
        }
      }
    }

    // Direct content fields
    if (typeof obj.content === 'string') return obj.content
    if (typeof obj.response === 'string') return obj.response
    if (typeof obj.text === 'string') return obj.text
    if (typeof obj.message === 'string') return obj.message
    if (typeof obj.output === 'string') return obj.output

    // Tool result format
    if (typeof obj.result === 'string') return obj.result
    if (obj.result && typeof obj.result === 'object') {
      return formatResult(obj.result)
    }
  }

  // Fallback: JSON stringified
  return JSON.stringify(result, null, 2)
}

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)

  const handleClear = () => {
    setMessages([])
  }

  const handleSend = async (message: string) => {
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: Date.now()
    }
    setMessages((prev) => [...prev, userMessage])
    setLoading(true)

    try {
      // FIX 038: No enviar sessionId inventado - solo message
      const response = await api.run(message)

      // Debug log temporal
      console.log('[CHAT] orchestrator response', response)

      let content = ''
      let source: ChatMessage['source'] = undefined
      let toolId: string | undefined = undefined

      // FIX 038: Manejar response.data wrapper
      // La respuesta puede venir como { success, data: { success, result, ... } }
      // o directamente como { success, result, ... }
      const responseAny = response as unknown as Record<string, unknown>
      const payload = (responseAny.data as Record<string, unknown>) || responseAny

      if (payload && payload.success === true) {
        content = formatResult(payload.result)
        source = payload.source as ChatMessage['source']
        toolId = payload.toolId as string | undefined
      } else if (payload && payload.success === false) {
        // Backend devolvió error explícito
        const errorMsg = (payload.error as string) || 'Error del sistema'
        content = `Error: ${errorMsg}`
        console.error('[CHAT] backend error', payload)
      } else if (payload && typeof payload === 'object') {
        // Respuesta inesperada pero válida - intentar extraer algo
        console.warn('[CHAT] unexpected response format', payload)
        content = formatResult(payload)
      } else {
        content = 'No se obtuvo respuesta del servidor'
        console.error('[CHAT] empty or invalid response', response)
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content,
        source,
        toolId,
        timestamp: Date.now()
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      console.error('[CHAT] request failed', err)
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `Error de conexión: ${err instanceof Error ? err.message : 'Error desconocido'}`,
        timestamp: Date.now()
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      maxHeight: '700px',
      border: '1px solid #e0e0e0',
      borderRadius: '12px',
      backgroundColor: '#fff',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid #e0e0e0',
        backgroundColor: '#fafafa'
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>GranClaw</h3>
          <small style={{ color: '#888', fontSize: '12px' }}>Asistente</small>
        </div>
        <button
          onClick={handleClear}
          style={{
            padding: '6px 12px',
            fontSize: '13px',
            backgroundColor: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Limpiar
        </button>
      </div>

      {/* Messages */}
      <MessageList messages={messages} loading={loading} />

      {/* Input */}
      <MessageInput onSend={handleSend} disabled={loading} />
    </div>
  )
}
