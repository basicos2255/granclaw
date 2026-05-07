/**
 * Settings Page
 * P2: Product Experience Layer
 *
 * User and system settings.
 */

import { useState } from 'react'

interface Settings {
  notifications: {
    email: boolean
    browser: boolean
    approvalAlerts: boolean
    errorAlerts: boolean
  }
  runtime: {
    autoRetry: boolean
    maxRetries: number
    timeoutMinutes: number
  }
  display: {
    language: 'es' | 'en'
    timezone: string
    dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
  }
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    notifications: {
      email: true,
      browser: true,
      approvalAlerts: true,
      errorAlerts: true
    },
    runtime: {
      autoRetry: true,
      maxRetries: 3,
      timeoutMinutes: 30
    },
    display: {
      language: 'es',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      dateFormat: 'DD/MM/YYYY'
    }
  })

  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    // TODO: Save to backend
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const updateNotification = (key: keyof Settings['notifications'], value: boolean) => {
    setSettings(prev => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: value }
    }))
  }

  const updateRuntime = (key: keyof Settings['runtime'], value: boolean | number) => {
    setSettings(prev => ({
      ...prev,
      runtime: { ...prev.runtime, [key]: value }
    }))
  }

  const updateDisplay = (key: keyof Settings['display'], value: string) => {
    setSettings(prev => ({
      ...prev,
      display: { ...prev.display, [key]: value }
    }))
  }

  const SettingSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      border: '1px solid #e2e8f0',
      padding: '24px',
      marginBottom: '16px'
    }}>
      <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#0f172a', marginBottom: '20px' }}>{title}</h2>
      {children}
    </div>
  )

  const Toggle = ({ checked, onChange, label, description }: {
    checked: boolean
    onChange: (checked: boolean) => void
    label: string
    description?: string
  }) => (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: '1px solid #f1f5f9'
    }}>
      <div>
        <div style={{ fontWeight: '500', color: '#0f172a' }}>{label}</div>
        {description && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>{description}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: '44px',
          height: '24px',
          borderRadius: '12px',
          border: 'none',
          backgroundColor: checked ? '#3b82f6' : '#e2e8f0',
          cursor: 'pointer',
          position: 'relative',
          transition: 'background-color 0.2s'
        }}
      >
        <div style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: 'white',
          position: 'absolute',
          top: '2px',
          left: checked ? '22px' : '2px',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }} />
      </button>
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Configuracion</h1>
          <p style={{ color: '#64748b' }}>Personaliza tu experiencia</p>
        </div>
        <button
          onClick={handleSave}
          style={{
            padding: '10px 20px',
            backgroundColor: saved ? '#16a34a' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
        >
          {saved ? 'Guardado' : 'Guardar Cambios'}
        </button>
      </div>

      {/* Notifications */}
      <SettingSection title="Notificaciones">
        <Toggle
          checked={settings.notifications.email}
          onChange={(v) => updateNotification('email', v)}
          label="Notificaciones por email"
          description="Recibe alertas importantes por correo electronico"
        />
        <Toggle
          checked={settings.notifications.browser}
          onChange={(v) => updateNotification('browser', v)}
          label="Notificaciones del navegador"
          description="Muestra notificaciones en el navegador"
        />
        <Toggle
          checked={settings.notifications.approvalAlerts}
          onChange={(v) => updateNotification('approvalAlerts', v)}
          label="Alertas de aprobacion"
          description="Notifica cuando hay tareas pendientes de aprobar"
        />
        <Toggle
          checked={settings.notifications.errorAlerts}
          onChange={(v) => updateNotification('errorAlerts', v)}
          label="Alertas de errores"
          description="Notifica cuando una tarea falla"
        />
      </SettingSection>

      {/* Runtime */}
      <SettingSection title="Ejecucion">
        <Toggle
          checked={settings.runtime.autoRetry}
          onChange={(v) => updateRuntime('autoRetry', v)}
          label="Reintentos automaticos"
          description="Reintenta tareas fallidas automaticamente"
        />
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 0',
          borderBottom: '1px solid #f1f5f9'
        }}>
          <div>
            <div style={{ fontWeight: '500', color: '#0f172a' }}>Maximo de reintentos</div>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Numero maximo de intentos por tarea</div>
          </div>
          <select
            value={settings.runtime.maxRetries}
            onChange={(e) => updateRuntime('maxRetries', parseInt(e.target.value))}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              fontSize: '14px',
              color: '#0f172a'
            }}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={5}>5</option>
            <option value={10}>10</option>
          </select>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 0',
          borderBottom: '1px solid #f1f5f9'
        }}>
          <div>
            <div style={{ fontWeight: '500', color: '#0f172a' }}>Timeout (minutos)</div>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Tiempo maximo de ejecucion por tarea</div>
          </div>
          <select
            value={settings.runtime.timeoutMinutes}
            onChange={(e) => updateRuntime('timeoutMinutes', parseInt(e.target.value))}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              fontSize: '14px',
              color: '#0f172a'
            }}
          >
            <option value={5}>5 min</option>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={60}>1 hora</option>
            <option value={120}>2 horas</option>
          </select>
        </div>
      </SettingSection>

      {/* Display */}
      <SettingSection title="Visualizacion">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 0',
          borderBottom: '1px solid #f1f5f9'
        }}>
          <div>
            <div style={{ fontWeight: '500', color: '#0f172a' }}>Idioma</div>
          </div>
          <select
            value={settings.display.language}
            onChange={(e) => updateDisplay('language', e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              fontSize: '14px',
              color: '#0f172a'
            }}
          >
            <option value="es">Espanol</option>
            <option value="en">English</option>
          </select>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 0',
          borderBottom: '1px solid #f1f5f9'
        }}>
          <div>
            <div style={{ fontWeight: '500', color: '#0f172a' }}>Formato de fecha</div>
          </div>
          <select
            value={settings.display.dateFormat}
            onChange={(e) => updateDisplay('dateFormat', e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              fontSize: '14px',
              color: '#0f172a'
            }}
          >
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 0'
        }}>
          <div>
            <div style={{ fontWeight: '500', color: '#0f172a' }}>Zona horaria</div>
          </div>
          <div style={{ fontSize: '14px', color: '#64748b' }}>
            {settings.display.timezone}
          </div>
        </div>
      </SettingSection>

      {/* Account Info */}
      <SettingSection title="Cuenta">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 0',
          borderBottom: '1px solid #f1f5f9'
        }}>
          <div>
            <div style={{ fontWeight: '500', color: '#0f172a' }}>Tenant ID</div>
          </div>
          <div style={{ fontSize: '14px', color: '#64748b', fontFamily: 'monospace' }}>
            default-tenant
          </div>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 0'
        }}>
          <div>
            <div style={{ fontWeight: '500', color: '#0f172a' }}>Version</div>
          </div>
          <div style={{ fontSize: '14px', color: '#64748b' }}>
            GranClaw v0.1.0 (P2)
          </div>
        </div>
      </SettingSection>
    </div>
  )
}
