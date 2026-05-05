/**
 * MessageInput component
 * FIX 036: Enter to send, Shift+Enter for newline, textarea for multiline
 */

import { useState, type KeyboardEvent, type FormEvent } from 'react'

interface MessageInputProps {
  onSend: (message: string) => void
  disabled: boolean
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [value, setValue] = useState('')

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault()
    const trimmed = value.trim()
    if (trimmed && !disabled) {
      onSend(trimmed)
      setValue('')
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter without Shift sends message
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    // Shift+Enter allows newline (default behavior)
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        gap: '8px',
        padding: '12px 16px',
        borderTop: '1px solid #e0e0e0',
        backgroundColor: '#fafafa'
      }}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escribe un mensaje... (Enter para enviar)"
        disabled={disabled}
        rows={1}
        style={{
          flex: 1,
          padding: '10px 14px',
          fontSize: '15px',
          border: '1px solid #ddd',
          borderRadius: '20px',
          outline: 'none',
          resize: 'none',
          fontFamily: 'inherit',
          minHeight: '40px',
          maxHeight: '120px',
          overflow: 'auto'
        }}
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        style={{
          padding: '10px 20px',
          fontSize: '15px',
          backgroundColor: disabled || !value.trim() ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '20px',
          cursor: disabled || !value.trim() ? 'not-allowed' : 'pointer',
          fontWeight: 500,
          transition: 'background-color 0.2s'
        }}
      >
        {disabled ? 'Enviando...' : 'Enviar'}
      </button>
    </form>
  )
}
