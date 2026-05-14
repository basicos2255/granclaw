# P6.15 — Runtime Pipeline Map

**Date**: 2026-05-14
**Auditor**: Claude Code

## Complete Pipeline Flow

```
User Request
     ↓
orchestrator/routes.ts (POST /granclaw)
     ↓
classifyIntent() → determines task type
     ↓
classifyExecutionMode() → useQueue: true/false
     ↓
[If useQueue: true]
     ↓
buildCompositeExecutionPlan() → creates plan
     ↓
enqueueCompositeTask() (runtime-queue/enqueue.ts)
     ↓
Creates QueuedJob with:
  - jobId: job_xxxx
  - payload.taskId: task_xxxx
  - context.tenantId, userId
     ↓
Queue stores job in Map (IN-MEMORY!)
     ↓
Scheduler picks up job
     ↓
execution-integration.ts handler:
  - Creates sessionId: queue-{jobId}      ← P6.15 FIX: NOW creates session
  - Calls ensureSession()                 ← P6.15 FIX: Persists to storage
  - Calls executeProviderTask()
     ↓
orchestrator/service.ts executeProviderTask():
  - getSession(sessionId)                 ← NOW WORKS!
  - Validates session exists
  - Executes task
     ↓
Result flows back to queue
     ↓
completeTask() updates task state
     ↓
WebSocket emits task:completed
     ↓
UI updates
```

## Layer-by-Layer Analysis

| Layer | ID Used | Persistence | Created By | Consumed By | Can Disappear? |
|-------|---------|-------------|------------|-------------|----------------|
| Task | `task_xxxx` | File (tasks.json) | orchestrator/routes | UI, queue, executor | No (persisted) |
| QueueJob | `job_xxxx` | **IN-MEMORY Map** | enqueueCompositeTask | scheduler | **YES (on restart)** |
| QueueSession | `queue-job_xxxx` | File (sessions.json) | P6.15: ensureSession | executeProviderTask | No (now persisted) |
| Thread | `thread_xxxx` | File (threads.json) | createThread | UI, task detail | No (persisted) |

## Root Cause (Before Fix)

```
execution-integration.ts:
  sessionId = `queue-${job.id}`           ← Created ID string
  // NO SESSION CREATED!                  ← BUG: Never called createSession()
  executeProviderTask({ sessionId })      ← Passed to executor

orchestrator/service.ts:
  session = getSession(sessionId)         ← Looked up in storage
  if (!session) → ERROR                   ← Session didn't exist!
```

## P6.15 Fix

```typescript
// execution-integration.ts (ALL handlers)

// P6.15: Create queue session BEFORE execution
const sessionId = `queue-${job.id}`
ensureSession(sessionId, job.context.tenantId, payload.message)

// Now executeProviderTask() finds the session
const result = await executeProviderTask({ sessionId, ... })
```

## Storage Analysis

| Entity | Storage Type | File | Lost on Restart? |
|--------|-------------|------|------------------|
| tasks | File DB | data/tasks.json | No |
| sessions | File DB | data/sessions.json | No |
| threads | File DB | data/threads.json | No |
| queueJobs | **IN-MEMORY Map** | None | **YES** |
| queueListeners | IN-MEMORY Map | None | YES |

## Known Remaining Issues

1. **Queue Jobs Lost on Restart**: `runtime-queue/queue.ts` uses `new Map()` for jobs
   - Jobs in-flight during restart are lost
   - Should be addressed in future work

2. **No Heartbeat**: No mechanism to detect stalled workers
   - Future enhancement for P6.16+

3. **No Auto-Recovery**: If a job fails mid-execution, no auto-retry with new session
   - Manual retry creates new job with new session (works)

## Verification Points

1. ✅ `ensureSession()` creates session if not exists
2. ✅ Queue handlers call `ensureSession()` before execution
3. ✅ Sessions are persisted to file storage
4. ✅ `executeProviderTask()` finds queue sessions
5. ✅ Build passes
