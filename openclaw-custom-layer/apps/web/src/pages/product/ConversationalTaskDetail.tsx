/**
 * Conversational Task Detail Page
 * P6.6: Human Interaction Layer, Task Threads & Conversational Control
 * P6.17: Live Task Updates, Execution Truth & Polling
 *
 * Shows detailed task information with a conversational interface.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigation } from '../../hooks/useNavigation'
import { api, type GranClawTask, type TaskThread } from '../../services/api'
import { OutputsRenderer, ArtifactsRenderer } from '../../components/results/ResultRenderers'
import { ThreadTimeline, ThreadChatInput, HumanTaskStateBadge, canReceiveInput } from '../../components/threads'
// P6.6: Actions now handled through thread API

interface ConversationalTaskDetailProps {
  taskId: string
}

/**
 * P6.17: Extract reconciliation from task (top-level or nested in result)
 */
interface ReconciliationInfo {
  phase: string
  isSuccess: boolean
  reason: string
  executionStatus?: string
  validationFailedSteps?: string[]
  validatedSteps?: string[]
  completedSteps?: string[]
}

function getReconciliation(task: GranClawTask): ReconciliationInfo | null {
  // Try top-level first (P6.16+)
  if (task.reconciliation) {
    return task.reconciliation as ReconciliationInfo
  }
  // Fallback: nested in result._reconciliation
  const result = task.result as Record<string, unknown> | undefined
  if (result && result._reconciliation) {
    return result._reconciliation as ReconciliationInfo
  }
  return null
}

/**
 * P6.17: Get task status badge info
 */
function getTaskStatusInfo(status: string): { bg: string; color: string; label: string } {
  switch (status) {
    case 'success':
      return { bg: '#dcfce7', color: '#16a34a', label: 'Completada' }
    case 'running':
      return { bg: '#dbeafe', color: '#2563eb', label: 'Ejecutando' }
    case 'queued':
      return { bg: '#e0e7ff', color: '#4f46e5', label: 'En cola' }
    case 'blocked':
      return { bg: '#fee2e2', color: '#dc2626', label: 'Bloqueada' }
    case 'error':
      return { bg: '#fef3c7', color: '#d97706', label: 'Error' }
    case 'unconfirmed':
      return { bg: '#f3e8ff', color: '#7c3aed', label: 'Sin confirmar' }
    case 'pending':
      return { bg: '#f1f5f9', color: '#64748b', label: 'Pendiente' }
    default:
      return { bg: '#f3f4f6', color: '#6b7280', label: status }
  }
}

/**
 * P6.17: Get execution status badge info
 */
function getExecStatusInfo(execStatus: string | undefined): { bg: string; color: string; label: string } | null {
  switch (execStatus) {
    case 'completed':
      return { bg: '#dcfce7', color: '#16a34a', label: 'Completado' }
    case 'partial':
      return { bg: '#fef3c7', color: '#d97706', label: 'Parcial' }
    case 'failed':
      return { bg: '#fee2e2', color: '#dc2626', label: 'Fallido' }
    case 'blocked':
      return { bg: '#fee2e2', color: '#dc2626', label: 'Bloqueado' }
    case 'validation_failed':
      return { bg: '#fef3c7', color: '#d97706', label: 'Validación falló' }
    default:
      return null
  }
}

export function ConversationalTaskDetail({ taskId }: ConversationalTaskDetailProps) {
  const { navigate } = useNavigation()
  const [task, setTask] = useState<GranClawTask | null>(null)
  const [thread, setThread] = useState<TaskThread | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showLegacyView, setShowLegacyView] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<string>('')
  const timelineRef = useRef<HTMLDivElement>(null)

  // P6.17: Load task only (for polling)
  const loadTaskOnly = useCallback(async () => {
    try {
      const taskResponse = await api.getTask(taskId)
      if (taskResponse.success && taskResponse.data) {
        setTask(taskResponse.data)
        setLastRefresh(new Date().toLocaleTimeString())
      }
    } catch {
      // Silent fail for polling
    }
  }, [taskId])

  useEffect(() => {
    loadTaskAndThread()
  }, [taskId])

  // P6.17: Auto-refresh for running/queued tasks (every 2 seconds)
  useEffect(() => {
    if (task && (task.status === 'running' || task.status === 'queued')) {
      const interval = setInterval(() => {
        loadTaskOnly()
      }, 2000)
      return () => clearInterval(interval)
    }
  }, [task?.status, loadTaskOnly])

  // Auto-scroll timeline on new messages
  useEffect(() => {
    if (timelineRef.current && thread?.messages) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight
    }
  }, [thread?.messages?.length])

  /**
   * P6.17R7: Determine if we should auto-create a thread for this task
   * Blocked tasks and tasks with failureExplanation should NOT auto-create threads
   * to preserve the failure panel display
   */
  const shouldAutoCreateThread = (taskData: GranClawTask): boolean => {
    // Don't auto-create for blocked tasks
    if (taskData.status === 'blocked') return false
    // Don't auto-create if task has failure explanation (capability gate, etc)
    if (taskData.failureExplanation) return false
    // Don't auto-create for terminal error states with failure explanation
    if (taskData.status === 'error' && taskData.source === 'capability_gate') return false
    // Allow for other states (running, queued, success, etc)
    return true
  }

  const loadTaskAndThread = async () => {
    setLoading(true)
    setError(null)

    try {
      // Load task first
      const taskResponse = await api.getTask(taskId)
      if (taskResponse.success && taskResponse.data) {
        setTask(taskResponse.data)
      } else {
        setError(taskResponse.error || 'Error cargando tarea')
        setLoading(false)
        return
      }

      const taskData = taskResponse.data

      // Try to load existing thread
      const threadResponse = await api.getThreadByTask(taskId)
      if (threadResponse.success && threadResponse.data) {
        setThread(threadResponse.data)
      } else {
        // P6.17R7: Only auto-create thread if task is not blocked/failed
        if (shouldAutoCreateThread(taskData)) {
          const createResponse = await api.createThread({
            tenantId: taskData.tenantId,
            title: taskData.input.substring(0, 100),
            taskId: taskId,
            initialMessage: taskData.input
          })
          if (createResponse.success && createResponse.data) {
            setThread(createResponse.data)
          }
        }
        // P6.17R7: For blocked/failed tasks, leave thread=null to show failure panel
      }
    } catch (err) {
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async (message: string) => {
    if (!thread) return

    setActionLoading(true)
    try {
      const response = await api.addThreadMessage(thread.id, message)
      if (response.success && response.data) {
        // Reload thread to get updated messages
        const threadResponse = await api.getThread(thread.id)
        if (threadResponse.success && threadResponse.data) {
          setThread(threadResponse.data)
        }
      }
    } catch (err) {
      console.error('Error sending message:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleApprove = async (approvalId: string) => {
    if (!thread) return

    setActionLoading(true)
    try {
      await api.resolveApproval(thread.id, approvalId, true)
      // Reload thread
      const threadResponse = await api.getThread(thread.id)
      if (threadResponse.success && threadResponse.data) {
        setThread(threadResponse.data)
      }
    } catch (err) {
      console.error('Error approving:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async (approvalId: string) => {
    if (!thread) return

    setActionLoading(true)
    try {
      await api.resolveApproval(thread.id, approvalId, false)
      // Reload thread
      const threadResponse = await api.getThread(thread.id)
      if (threadResponse.success && threadResponse.data) {
        setThread(threadResponse.data)
      }
    } catch (err) {
      console.error('Error rejecting:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handlePause = async () => {
    if (!thread) return
    await api.pauseThread(thread.id)
    loadTaskAndThread()
  }

  const handleResume = async () => {
    if (!thread) return
    await api.resumeThread(thread.id)
    loadTaskAndThread()
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    overflow: 'hidden'
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
        Cargando tarea...
      </div>
    )
  }

  if (error || !task) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ color: '#dc2626', marginBottom: '16px' }}>{error || 'Tarea no encontrada'}</div>
        <button
          onClick={() => navigate('/tasks')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Volver a Tareas
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '600px' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <button
              onClick={() => navigate('/tasks')}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: '14px',
                marginBottom: '8px',
                padding: 0
              }}
            >
              ← Volver a Tareas
            </button>
            <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px 0' }}>
              {thread?.title || task.input.substring(0, 60)}...
            </h1>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* P6.17: Task status badge */}
              {(() => {
                const statusInfo = getTaskStatusInfo(task.status)
                return (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '10px',
                    backgroundColor: statusInfo.bg,
                    color: statusInfo.color,
                    fontSize: '11px',
                    fontWeight: '600'
                  }}>
                    {statusInfo.label}
                  </span>
                )
              })()}
              {thread && <HumanTaskStateBadge state={thread.status} size="sm" />}
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                ID: {task.id}
              </span>
              {/* P6.17: Polling indicator */}
              {(task.status === 'running' || task.status === 'queued') && (
                <span style={{
                  fontSize: '11px',
                  color: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#3b82f6',
                    animation: 'pulse 1s infinite'
                  }} />
                  Auto-refresh {lastRefresh && `(${lastRefresh})`}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {thread?.status === 'paused' && (
              <button
                onClick={handleResume}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                Reanudar
              </button>
            )}
            {thread && canReceiveInput(thread.status) && thread.status !== 'paused' && (
              <button
                onClick={handlePause}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                Pausar
              </button>
            )}
            <button
              onClick={() => setShowLegacyView(!showLegacyView)}
              style={{
                padding: '8px 12px',
                backgroundColor: showLegacyView ? '#3b82f6' : '#f1f5f9',
                color: showLegacyView ? 'white' : '#475569',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              {showLegacyView ? 'Vista Conversacional' : 'Vista Tecnica'}
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {showLegacyView ? (
          /* Legacy technical view */
          <div style={{ padding: '20px', overflow: 'auto' }}>
            {/* Summary */}
            {task.summary && (
              <div style={{
                ...cardStyle,
                padding: '16px',
                marginBottom: '16px',
                backgroundColor: '#f8fafc'
              }}>
                <div style={{ fontSize: '16px', color: '#0f172a', fontWeight: '500' }}>
                  {task.summary}
                </div>
              </div>
            )}

            {/* Outputs */}
            {task.outputs && task.outputs.length > 0 && (
              <div style={{ ...cardStyle, padding: '16px', marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#475569', marginBottom: '12px' }}>
                  RESULTADOS
                </div>
                <OutputsRenderer outputs={task.outputs} />
              </div>
            )}

            {/* Artifacts */}
            {task.artifacts && task.artifacts.length > 0 && (
              <div style={{ ...cardStyle, padding: '16px', marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#475569', marginBottom: '12px' }}>
                  ARTIFACTS ({task.artifacts.length})
                </div>
                <ArtifactsRenderer artifacts={task.artifacts} />
              </div>
            )}

            {/* Error */}
            {task.error && (
              <div style={{
                ...cardStyle,
                padding: '16px',
                marginBottom: '16px',
                backgroundColor: '#fef2f2',
                borderColor: '#fecaca'
              }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#dc2626', marginBottom: '8px' }}>
                  ERROR
                </div>
                <div style={{ color: '#991b1b', fontSize: '14px' }}>
                  {task.error}
                </div>
              </div>
            )}

            {/* P6.17: Execution Truth / Reconciliation Section */}
            {(() => {
              const recon = getReconciliation(task)
              if (!recon) return null
              return (
                <div style={{
                  ...cardStyle,
                  padding: '16px',
                  marginBottom: '16px',
                  backgroundColor: recon.isSuccess ? '#f0fdf4' : '#fef2f2',
                  borderColor: recon.isSuccess ? '#bbf7d0' : '#fecaca',
                  borderLeftWidth: '4px',
                  borderLeftColor: recon.isSuccess ? '#22c55e' : '#ef4444'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#475569', marginBottom: '12px' }}>
                    EXECUTION TRUTH (P6.17)
                  </div>

                  {/* Status badges */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    {recon.executionStatus && (() => {
                      const execInfo = getExecStatusInfo(recon.executionStatus)
                      return execInfo ? (
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          backgroundColor: execInfo.bg,
                          color: execInfo.color,
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {execInfo.label}
                        </span>
                      ) : null
                    })()}

                    {recon.completedSteps && (
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        fontSize: '12px'
                      }}>
                        {recon.completedSteps.length} pasos completados
                      </span>
                    )}

                    {recon.validatedSteps && recon.validatedSteps.length > 0 && (
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        backgroundColor: '#dcfce7',
                        color: '#16a34a',
                        fontSize: '12px'
                      }}>
                        {recon.validatedSteps.length} validados
                      </span>
                    )}

                    {recon.validationFailedSteps && recon.validationFailedSteps.length > 0 && (
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        backgroundColor: '#fee2e2',
                        color: '#dc2626',
                        fontSize: '12px'
                      }}>
                        {recon.validationFailedSteps.length} validación fallida
                      </span>
                    )}
                  </div>

                  {/* Reason */}
                  <div style={{
                    padding: '10px',
                    backgroundColor: recon.isSuccess ? '#dcfce7' : '#fee2e2',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: recon.isSuccess ? '#166534' : '#991b1b'
                  }}>
                    <strong>Razón:</strong> {recon.reason}
                  </div>

                  {/* Validation failed steps detail */}
                  {recon.validationFailedSteps && recon.validationFailedSteps.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>
                        Pasos con validación fallida:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {recon.validationFailedSteps.map((stepId, idx) => (
                          <span key={idx} style={{
                            padding: '3px 6px',
                            backgroundColor: '#fee2e2',
                            color: '#991b1b',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontFamily: 'monospace'
                          }}>
                            {stepId}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Execution Trace */}
            {task.executionTrace && task.executionTrace.length > 0 && (
              <div style={{ ...cardStyle, padding: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#475569', marginBottom: '12px' }}>
                  WORKFLOW ({task.executionTrace.length} pasos)
                </div>
                <div>
                  {task.executionTrace.map((step, idx) => (
                    <div key={step.id || idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px',
                      backgroundColor: idx % 2 ? '#f8fafc' : 'white',
                      borderRadius: '6px',
                      marginBottom: '4px'
                    }}>
                      <span style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: step.status === 'success' ? '#dcfce7' :
                                         step.status === 'error' ? '#fee2e2' : '#f1f5f9',
                        color: step.status === 'success' ? '#16a34a' :
                               step.status === 'error' ? '#dc2626' : '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {idx + 1}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '500', color: '#0f172a', fontSize: '13px' }}>
                          {step.label}
                        </div>
                        {step.detail && (
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            {step.detail}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Conversational view */
          <>
            {/* Plan section (if exists) */}
            {thread?.currentPlan && (
              <div style={{
                padding: '12px 20px',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>
                  PLAN ({thread.currentPlan.totalSteps} pasos)
                </div>
                <div style={{ fontSize: '14px', color: '#0f172a' }}>
                  {thread.currentPlan.summary}
                </div>
              </div>
            )}

            {/* P6.17R7B: Failure panel - shown ALWAYS when task has failureExplanation, regardless of thread */}
            {task?.failureExplanation && (task.status === 'blocked' || task.source === 'capability_gate' || task.failureExplanation.canRetry === false) && (
              <div style={{ padding: '20px', borderBottom: thread ? '1px solid #e2e8f0' : 'none' }}>
                <div style={{
                  maxWidth: '600px',
                  margin: '0 auto',
                  padding: '20px',
                  backgroundColor: '#fef2f2',
                  borderRadius: '12px',
                  border: '1px solid #fecaca'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '12px'
                  }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: '#fee2e2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      flexShrink: 0
                    }}>
                      🚫
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', color: '#991b1b', fontSize: '15px' }}>
                        {task.failureExplanation.title}
                      </div>
                      {task.failureExplanation.capability && (
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                          Capacidad: {task.failureExplanation.capability}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ color: '#7f1d1d', marginBottom: '12px', lineHeight: '1.5', fontSize: '14px' }}>
                    {task.failureExplanation.humanMessage}
                  </div>
                  {task.failureExplanation.recoveryActions && task.failureExplanation.recoveryActions.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: '#991b1b', marginBottom: '6px' }}>
                        Acciones recomendadas:
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '18px', color: '#7f1d1d', fontSize: '13px' }}>
                        {task.failureExplanation.recoveryActions.map((action, i) => (
                          <li key={i} style={{ marginBottom: '3px' }}>
                            <strong>{action.label}</strong>
                            {action.description && ` - ${action.description}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {task.failureExplanation.canRetry === false && (
                    <div style={{
                      padding: '10px',
                      backgroundColor: '#fee2e2',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#991b1b'
                    }}>
                      Esta tarea no puede reintentarse hasta habilitar la capacidad requerida.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div
              ref={timelineRef}
              style={{
                flex: 1,
                overflow: 'auto',
                padding: '0 20px'
              }}
            >
              {thread ? (
                <ThreadTimeline
                  messages={thread.messages}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ) : !task?.failureExplanation ? (
                /* P6.17R7B: Only show "Sin conversacion" if there's no failure panel above */
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  Sin conversacion disponible
                </div>
              ) : null}
            </div>

            {/* Chat input */}
            {thread && canReceiveInput(thread.status) && (
              <ThreadChatInput
                onSend={handleSendMessage}
                disabled={actionLoading || thread.status === 'paused'}
                placeholder={
                  thread.status === 'paused'
                    ? 'Tarea pausada. Haz clic en Reanudar para continuar.'
                    : thread.status === 'waiting_approval'
                    ? 'Responde a la solicitud de aprobacion o escribe una instruccion...'
                    : 'Escribe una instruccion para esta tarea...'
                }
              />
            )}

            {/* Completed/Failed state actions */}
            {thread && ['completed', 'failed', 'cancelled'].includes(thread.status) && (
              <div style={{
                padding: '16px 20px',
                borderTop: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                display: 'flex',
                gap: '8px',
                justifyContent: 'center'
              }}>
                {/* P6.17R5: Only show retry if canRetry is not explicitly false */}
                {thread.status === 'failed' && task?.failureExplanation?.canRetry !== false && (
                  <button
                    onClick={() => handleSendMessage('reintenta')}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    Reintentar
                  </button>
                )}
                {/* P6.17R5: Show message when retry is not available */}
                {thread.status === 'failed' && task?.failureExplanation?.canRetry === false && (
                  <span style={{ fontSize: '13px', color: '#64748b' }}>
                    No reintentable hasta habilitar capacidad
                  </span>
                )}
                <button
                  onClick={() => navigate('/tasks?create=true')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Nueva Tarea
                </button>
              </div>
            )}

            {/* P6.17R7B: Actions for blocked tasks - show regardless of thread existence */}
            {task?.status === 'blocked' && task?.failureExplanation && (
              <div style={{
                padding: '16px 20px',
                borderTop: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                display: 'flex',
                gap: '8px',
                justifyContent: 'center'
              }}>
                <button
                  onClick={() => navigate('/control/tools')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Configurar capacidades
                </button>
                <button
                  onClick={() => navigate('/tasks?create=true')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Nueva Tarea
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
