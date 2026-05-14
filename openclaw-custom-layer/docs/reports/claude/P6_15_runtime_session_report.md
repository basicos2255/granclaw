# P6.15 — Queue Session Lifecycle, Executor Binding & Runtime Persistence

**Date**: 2026-05-14
**Status**: COMPLETED
**Auditor**: Claude Code

## 1. Objetivo Ejecutado

Resolver el error:
```
Session with id "queue-xxx" not found
```

Que causaba:
- Queue job quedaba retrying
- Task quedaba queued/pending
- UI mostraba "Pensando..." eternamente
- Sin artifacts ni outputs
- Sin cierre terminal

## 2. Auditoría Real del Runtime

### Módulos Auditados
- `runtime-queue/` - Queue management, execution-integration
- `sessions/` - Session service, storage
- `orchestrator/` - Service, routes
- `composite-tasks/` - Executor

### Búsqueda de Patrones
```grep
queue-              → Found in execution-integration.ts
session-            → Found in sessions/service.ts
createSession       → Found, but NOT called from queue
getSession          → Called in orchestrator/service.ts
new Map             → Found in runtime-queue/queue.ts (jobs)
```

## 3. Pipeline Map

```
Task → QueueJob → QueueSession → Executor → Provider → Result
```

| Layer | ID | Persistence | Lost on Restart? |
|-------|----|-------------|------------------|
| Task | task_xxxx | File DB | No |
| QueueJob | job_xxxx | IN-MEMORY | Yes |
| QueueSession | queue-job_xxxx | File DB (P6.15) | No |
| Thread | thread_xxxx | File DB | No |

## 4. Session Lifecycle Root Cause

### Before P6.15
```
execution-integration.ts:
  sessionId = `queue-${job.id}`     ← Created ID string only
  // NO SESSION CREATED!             ← BUG HERE
  executeProviderTask({ sessionId }) ← Passed non-existent session

orchestrator/service.ts:
  session = getSession(sessionId)    ← Looked up in storage
  if (!session) → ERROR              ← Session not found!
```

### Root Cause
The queue executor created a sessionId string but **NEVER** created the actual session object in storage.

## 5. Session Persistence

### New Function: ensureSession()
```typescript
// sessions/service.ts
export function ensureSession(
  sessionId: string,
  tenantId: string,
  initialMessage?: string
): Session {
  const existing = getSession(sessionId)
  if (existing) return existing

  const session: Session = {
    id: sessionId,  // Use provided ID, not auto-generated
    tenantId,
    messages: [...],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  storage.add('sessions', session)
  return session
}
```

## 6. Executor Binding

### Updated Handlers
All three handlers in `execution-integration.ts` now call `ensureSession()`:

```typescript
// dagExecutionHandler
const sessionId = `queue-${job.id}`
ensureSession(sessionId, job.context.tenantId)

// compositeTaskHandler
const sessionId = `queue-${job.id}`
ensureSession(sessionId, job.context.tenantId)

// simpleTaskHandler
const sessionId = payload.sessionId || `queue-${job.id}`
ensureSession(sessionId, tenantId, payload.message)
```

## 7. Recovery Model

### Current State
- Sessions are persisted to file storage
- Jobs are in-memory (lost on restart)
- Retry creates new job → new session (works)

### Future Enhancements (Out of Scope)
- Job persistence
- Session heartbeat
- Auto-recovery

## 8. Heartbeat/Lease

Not implemented in P6.15 scope. Future enhancement.

## 9. Task/Thread Reconciliation

Session now exists → `executeProviderTask()` succeeds → task completes properly.

## 10. Startup Recovery

Sessions are persisted in file storage, so they survive restart.
Jobs are in-memory, so they're lost on restart.

## 11. Casos Probados

| Case | Before | After |
|------|--------|-------|
| "descarga un programa random freeware" | Session not found | Creates queue session, executes |
| Queue job execution | Fails at session lookup | Succeeds with persisted session |
| API restart | Session lost | Session survives (persisted) |

## 12. npm run check

```
✅ API check passed
```

## 13. npm run build

```
✅ Build successful
```

## 14. Riesgos Restantes

1. **Queue Jobs In-Memory**: Jobs lost on restart (acceptable for now)
2. **No Heartbeat**: Stalled workers not detected (future enhancement)
3. **No Auto-Recovery**: Manual retry required (works with fix)

## 15. Estado PROJECT_MEMORY.md

Updated with:
- P6.15 Queue Session Lifecycle fix
- ensureSession() function
- Root cause and solution

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| sessions/service.ts | +40 líneas: ensureSession() |
| runtime-queue/execution-integration.ts | +15 líneas: ensureSession calls |

## Reportes Generados

1. `P6_15_runtime_pipeline_map.md` - Pipeline flow map
2. `P6_15_runtime_session_self_audit.md` - Self audit
3. `P6_15_runtime_session_report.md` - This report
