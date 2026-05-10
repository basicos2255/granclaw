/**
 * Human Task State Badge Component
 * P6.6: Human Interaction Layer, Task Threads & Conversational Control
 *
 * Displays human-readable task states with appropriate styling.
 */

import type { HumanTaskState } from '../../services/api'

interface HumanTaskStateBadgeProps {
  state: HumanTaskState
  size?: 'sm' | 'md' | 'lg'
}

interface StateConfig {
  label: string
  bgColor: string
  textColor: string
  icon: string
  pulse?: boolean
}

const stateConfigs: Record<HumanTaskState, StateConfig> = {
  thinking: {
    label: 'Pensando...',
    bgColor: '#dbeafe',
    textColor: '#1d4ed8',
    icon: '🤔',
    pulse: true
  },
  queued: {
    label: 'En cola',
    bgColor: '#f1f5f9',
    textColor: '#475569',
    icon: '⏳'
  },
  executing: {
    label: 'Ejecutando',
    bgColor: '#dbeafe',
    textColor: '#2563eb',
    icon: '▶️',
    pulse: true
  },
  waiting_approval: {
    label: 'Esperando aprobación',
    bgColor: '#fef3c7',
    textColor: '#d97706',
    icon: '⚠️',
    pulse: true
  },
  waiting_user_input: {
    label: 'Esperando respuesta',
    bgColor: '#e0e7ff',
    textColor: '#4338ca',
    icon: '💬',
    pulse: true
  },
  paused: {
    label: 'Pausada',
    bgColor: '#f3e8ff',
    textColor: '#7c3aed',
    icon: '⏸️'
  },
  completed: {
    label: 'Completada',
    bgColor: '#dcfce7',
    textColor: '#16a34a',
    icon: '✅'
  },
  failed: {
    label: 'Fallida',
    bgColor: '#fee2e2',
    textColor: '#dc2626',
    icon: '❌'
  },
  needs_repair: {
    label: 'Requiere reparación',
    bgColor: '#ffedd5',
    textColor: '#ea580c',
    icon: '🔧'
  },
  cancelled: {
    label: 'Cancelada',
    bgColor: '#f1f5f9',
    textColor: '#64748b',
    icon: '🚫'
  }
}

export function HumanTaskStateBadge({ state, size = 'md' }: HumanTaskStateBadgeProps) {
  const config = stateConfigs[state] || {
    label: state,
    bgColor: '#f3f4f6',
    textColor: '#6b7280',
    icon: '❓'
  }

  const sizes = {
    sm: { padding: '4px 8px', fontSize: '11px', iconSize: '12px' },
    md: { padding: '6px 12px', fontSize: '13px', iconSize: '14px' },
    lg: { padding: '8px 16px', fontSize: '14px', iconSize: '16px' }
  }

  const sizeConfig = sizes[size]

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: sizeConfig.padding,
        backgroundColor: config.bgColor,
        color: config.textColor,
        borderRadius: '20px',
        fontSize: sizeConfig.fontSize,
        fontWeight: '600',
        animation: config.pulse ? 'pulse 2s infinite' : undefined
      }}
    >
      <span style={{ fontSize: sizeConfig.iconSize }}>{config.icon}</span>
      {config.label}
      {config.pulse && (
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
        `}</style>
      )}
    </span>
  )
}

/**
 * Get the human-readable label for a state
 */
export function getStateLabel(state: HumanTaskState): string {
  return stateConfigs[state]?.label || state
}

/**
 * Check if state indicates task is active
 */
export function isActiveState(state: HumanTaskState): boolean {
  return ['thinking', 'queued', 'executing', 'waiting_approval', 'waiting_user_input'].includes(state)
}

/**
 * Check if state indicates task can receive user input
 */
export function canReceiveInput(state: HumanTaskState): boolean {
  return ['executing', 'waiting_approval', 'waiting_user_input', 'paused', 'needs_repair'].includes(state)
}
