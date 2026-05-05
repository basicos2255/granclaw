/**
 * TaskInput - Input para evaluar acciones
 * FEATURE 061: UI orientada a caso de uso
 * FEATURE 062: Refinamiento visual empresarial
 * FEATURE 063: UI v3 - copy de impacto
 * FEATURE 064: UI SaaS moderna
 */

import { useState } from 'react'

interface TaskInputProps {
  onSubmit: (message: string) => void
  loading: boolean
  placeholder?: string
}

export function TaskInput({ onSubmit, loading, placeholder }: TaskInputProps) {
  const [message, setMessage] = useState('')
  const [focused, setFocused] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim() && !loading) {
      onSubmit(message.trim())
      setMessage('')
    }
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  }

  const inputStyle: React.CSSProperties = {
    padding: '22px 28px',
    fontSize: '17px',
    border: `2px solid ${focused ? '#3b82f6' : '#e2e8f0'}`,
    borderRadius: '12px',
    outline: 'none',
    transition: 'all 0.15s ease',
    backgroundColor: focused ? 'white' : '#f8fafc',
    boxShadow: focused ? '0 0 0 4px rgba(59,130,246,0.1)' : 'none'
  }

  const buttonStyle: React.CSSProperties = {
    padding: '20px 40px',
    fontSize: '16px',
    fontWeight: '600',
    backgroundColor: loading ? '#94a3b8' : '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: loading ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s ease',
    boxShadow: loading ? 'none' : '0 2px 8px rgba(37,99,235,0.25)'
  }

  return (
    <form onSubmit={handleSubmit} style={containerStyle}>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder || 'Ej: borrar datos de clientes, generar informe financiero...'}
        style={inputStyle}
        disabled={loading}
      />
      <button type="submit" style={buttonStyle} disabled={loading || !message.trim()}>
        {loading ? 'Procesando...' : 'Evaluar y ejecutar'}
      </button>
    </form>
  )
}
