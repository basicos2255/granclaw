/**
 * Login page
 * FEATURE 072: Improved UX
 */
import { FormEvent, useState } from 'react'
import { api, setToken } from '../../services/api'

function goToControl(): void {
  window.history.pushState({}, '', '/control')
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function goToRegister(): void {
  window.history.pushState({}, '', '/register')
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const response = await api.login(email, password)

    if (!response.success || !response.data?.token) {
      setError(response.error || 'Credenciales incorrectas')
      setLoading(false)
      return
    }

    setToken(response.data.token)
    goToControl()
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f1f5f9',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
        padding: '40px'
      }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: '600',
          color: '#1e293b',
          marginTop: 0,
          marginBottom: '8px',
          textAlign: 'center'
        }}>
          GranClaw
        </h1>
        <p style={{
          color: '#64748b',
          textAlign: 'center',
          marginTop: 0,
          marginBottom: '32px'
        }}>
          Inicia sesion para continuar
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="email" style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '6px'
            }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@email.com"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 16px',
                fontSize: '15px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                outline: 'none',
                transition: 'border-color 0.15s'
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="password" style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '6px'
            }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Tu password"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 16px',
                fontSize: '15px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                outline: 'none',
                transition: 'border-color 0.15s'
              }}
            />
          </div>

          {error && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 20px',
              fontSize: '15px',
              fontWeight: '500',
              backgroundColor: loading ? '#93c5fd' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s'
            }}
          >
            {loading ? 'Iniciando sesion...' : 'Iniciar sesion'}
          </button>
        </form>

        <div style={{
          marginTop: '24px',
          textAlign: 'center',
          fontSize: '14px',
          color: '#64748b'
        }}>
          No tienes cuenta?{' '}
          <button
            type="button"
            onClick={goToRegister}
            style={{
              background: 'none',
              border: 'none',
              color: '#2563eb',
              cursor: 'pointer',
              fontWeight: '500',
              padding: 0
            }}
          >
            Registrate
          </button>
        </div>
      </div>
    </div>
  )
}
