/**
 * Conversational Task Detail Page
 * P6.6: Human Interaction Layer, Task Threads & Conversational Control
 *
 * Shows detailed task information with a conversational interface.
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigation } from '../../hooks/useNavigation'
import { api, type GranClawTask, type TaskThread } from '../../services/api'
import { OutputsRenderer, ArtifactsRenderer } from '../../components/results/ResultRenderers'
import { ThreadTimeline, ThreadChatInput, HumanTaskStateBadge, canReceiveInput } from '../../components/threads'
// P6.6: Actions now handled through thread API

interface ConversationalTaskDetailProps {
  taskId: string
}

export function ConversationalTaskDetail({ taskId }: ConversationalTaskDetailProps) {
  const { navigate } = useNavigation()
  const [task, setTask] = useState<GranClawTask | null>(null)
  const [thread, setThread] = useState<TaskThread | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showLegacyView, setShowLegacyView] = useState(false)
  const timelineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadTaskAndThread()
  }, [taskId])

  // Auto-scroll timeline on new messages
  useEffect(() => {
    if (timelineRef.current && thread?.messages) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight
    }
  }, [thread?.messages?.length])

  const loadTaskAndThread = async () => {
    setLoading(true)
    setError(null)

    try {
      // Load task
      const taskResponse = await api.getTask(taskId)
      if (taskResponse.success && taskResponse.data) {
        setTask(taskResponse.data)
      } else {
        setError(taskResponse.error || 'Error cargando tarea')
        setLoading(false)
        return
      }

      // Try to load existing thread
      const threadResponse = await api.getThreadByTask(taskId)
      if (threadResponse.success && threadResponse.data) {
        setThread(threadResponse.data)
      } else {
        // Create new thread if none exists
        const createResponse = await api.createThread({
          tenantId: taskResponse.data.tenantId,
          title: taskResponse.data.input.substring(0, 100),
          taskId: taskId,
          initialMessage: taskResponse.data.input
        })
        if (createResponse.success && createResponse.data) {
          setThread(createResponse.data)
        }
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
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {thread && <HumanTaskStateBadge state={thread.status} size="sm" />}
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                ID: {task.id}
              </span>
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
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  Sin conversacion disponible
                </div>
              )}
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
                {thread.status === 'failed' && (
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
