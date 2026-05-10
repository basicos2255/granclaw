/**
 * Thread Timeline Component
 * P6.6: Human Interaction Layer, Task Threads & Conversational Control
 *
 * Displays a conversational timeline of messages in a task thread.
 */

import type { ThreadMessage } from '../../services/api'
import { OutputsRenderer, ArtifactsRenderer } from '../results/ResultRenderers'

interface ThreadTimelineProps {
  messages: ThreadMessage[]
  onApprove?: (approvalId: string) => void
  onReject?: (approvalId: string) => void
}

export function ThreadTimeline({ messages, onApprove, onReject }: ThreadTimelineProps) {
  const getMessageStyle = (role: string): React.CSSProperties => {
    const base: React.CSSProperties = {
      padding: '12px 16px',
      borderRadius: '12px',
      marginBottom: '12px',
      maxWidth: '85%'
    }

    switch (role) {
      case 'user':
        return {
          ...base,
          backgroundColor: '#3b82f6',
          color: 'white',
          marginLeft: 'auto',
          borderBottomRightRadius: '4px'
        }
      case 'assistant':
        return {
          ...base,
          backgroundColor: '#f1f5f9',
          color: '#0f172a',
          marginRight: 'auto',
          borderBottomLeftRadius: '4px'
        }
      case 'runtime':
        return {
          ...base,
          backgroundColor: '#fef3c7',
          color: '#92400e',
          marginRight: 'auto',
          border: '1px solid #fcd34d',
          borderBottomLeftRadius: '4px'
        }
      case 'system':
        return {
          ...base,
          backgroundColor: '#e2e8f0',
          color: '#475569',
          margin: '0 auto',
          textAlign: 'center',
          fontSize: '13px',
          fontStyle: 'italic'
        }
      default:
        return base
    }
  }

  const getRoleLabel = (role: string): string => {
    switch (role) {
      case 'user': return 'Tú'
      case 'assistant': return 'GranClaw'
      case 'runtime': return 'Sistema'
      case 'system': return ''
      default: return role
    }
  }

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '16px 0' }}>
      {messages.map((message) => (
        <div key={message.id} style={getMessageStyle(message.role)}>
          {/* Role label for non-user messages */}
          {message.role !== 'user' && message.role !== 'system' && (
            <div style={{
              fontSize: '11px',
              fontWeight: '600',
              marginBottom: '4px',
              opacity: 0.7,
              textTransform: 'uppercase'
            }}>
              {getRoleLabel(message.role)}
            </div>
          )}

          {/* Message content */}
          <div style={{ whiteSpace: 'pre-wrap' }}>
            {message.content}
          </div>

          {/* Workflow step badge */}
          {message.workflowStep && (
            <div style={{
              marginTop: '8px',
              padding: '6px 10px',
              backgroundColor: message.role === 'user' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)',
              borderRadius: '6px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor:
                  message.workflowStep.status === 'completed' ? '#22c55e' :
                  message.workflowStep.status === 'running' ? '#3b82f6' :
                  message.workflowStep.status === 'failed' ? '#ef4444' :
                  '#94a3b8'
              }} />
              <span>{message.workflowStep.stepName}</span>
            </div>
          )}

          {/* Explanation */}
          {message.explanation && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              backgroundColor: message.role === 'user' ? 'rgba(255,255,255,0.1)' : '#f8fafc',
              borderRadius: '8px',
              fontSize: '13px'
            }}>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                {message.explanation.what}
              </div>
              <div style={{ color: message.role === 'user' ? 'rgba(255,255,255,0.8)' : '#64748b', marginBottom: '8px' }}>
                {message.explanation.why}
              </div>
              {message.explanation.nextSteps.length > 0 && (
                <div>
                  <div style={{ fontWeight: '500', marginBottom: '4px' }}>Siguientes pasos:</div>
                  <ul style={{ margin: 0, paddingLeft: '20px' }}>
                    {message.explanation.nextSteps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Pending approval */}
          {message.pendingApproval && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              backgroundColor: '#fef3c7',
              borderRadius: '8px',
              border: '1px solid #fcd34d'
            }}>
              <div style={{ fontWeight: '600', color: '#92400e', marginBottom: '8px' }}>
                Requiere aprobación
              </div>
              <div style={{ color: '#78350f', marginBottom: '8px' }}>
                {message.pendingApproval.description}
              </div>
              {message.pendingApproval.risks && message.pendingApproval.risks.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontWeight: '500', color: '#dc2626', fontSize: '12px' }}>Riesgos:</div>
                  <ul style={{ margin: '4px 0', paddingLeft: '16px', fontSize: '12px', color: '#b91c1c' }}>
                    {message.pendingApproval.risks.map((risk, idx) => (
                      <li key={idx}>{risk}</li>
                    ))}
                  </ul>
                </div>
              )}
              {onApprove && onReject && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => onApprove(message.pendingApproval!.id)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#22c55e',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Aprobar
                  </button>
                  <button
                    onClick={() => onReject(message.pendingApproval!.id)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Rechazar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Outputs */}
          {message.outputs && message.outputs.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <OutputsRenderer outputs={message.outputs} />
            </div>
          )}

          {/* Artifacts */}
          {message.artifacts && message.artifacts.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <ArtifactsRenderer artifacts={message.artifacts} />
            </div>
          )}

          {/* Timestamp */}
          <div style={{
            marginTop: '6px',
            fontSize: '10px',
            opacity: 0.6,
            textAlign: message.role === 'user' ? 'right' : 'left'
          }}>
            {formatTime(message.timestamp)}
          </div>
        </div>
      ))}
    </div>
  )
}
