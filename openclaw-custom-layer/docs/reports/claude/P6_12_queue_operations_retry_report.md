# P6.12 — Queue Operations, Retry Semantics & Runtime Recovery Controls

**Date**: 2026-05-13
**Status**: COMPLETED
**Auditor**: Claude Code

## Executive Summary

P6.12 resolves the 404 error on task retry operations by implementing a complete set of task lifecycle endpoints. The UI can now successfully retry, cancel, and repair tasks using the `/tasks/:id/*` pattern. Queue-level operations remain available at `/queue/jobs/:id/*` for debugging.

## Problem Statement

The UI was attempting to retry tasks via:
```
POST /queue/jobs/${taskId}/retry
```

This returned **404 Not Found** because:
1. The endpoint didn't exist
2. Tasks use task IDs, not job IDs
3. The conceptual model mixes tasks (logical) with jobs (queue-level)

## Solution Architecture

### Dual-Layer Design

```
┌─────────────────────────────────────────────────────────────┐
│                     TASK LAYER (Primary)                     │
│  POST /tasks/:id/retry   - Retry with intelligent semantics │
│  POST /tasks/:id/cancel  - Cancel task and associated jobs  │
│  POST /tasks/:id/repair  - Reconcile task state             │
│  GET  /tasks/:id/truth   - Get authoritative state          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   QUEUE LAYER (Secondary)                    │
│  POST /queue/jobs/:id/retry   - Raw job retry               │
│  POST /queue/jobs/:id/cancel  - Raw job cancel              │
│  POST /queue/dead-letter/:id/requeue - Requeue dead jobs    │
└─────────────────────────────────────────────────────────────┘
```

### Retry Semantics

The `determineRetryMode()` function intelligently selects the best retry strategy:

| Condition | Mode | Behavior |
|-----------|------|----------|
| Has valid planId | retry_same_plan | Requeue existing plan |
| Requires queue | retry_replan | Create new plan |
| Has failed step | retry_from_failed_step | Resume from failure |
| Safe for simple | retry_as_simple | Direct execution |
| Default | retry_replan | Full replanning |

## Implementation Details

### New Handlers (tasks/routes.ts)

#### handleRetryTask
```typescript
export function handleRetryTask(
  req: IncomingMessage,
  res: ServerResponse,
  taskId: string,
  context: AuthContext | null
): void
```
- Validates task exists and is in failed/error state
- Determines retry mode based on task state
- For queue tasks: enqueues new job with updated retry count
- For simple tasks: executes via runSimpleAgentTask
- Emits WebSocket events for real-time UI updates

#### handleCancelTask
```typescript
export function handleCancelTask(
  _req: IncomingMessage,
  res: ServerResponse,
  taskId: string,
  context: AuthContext | null
): void
```
- Cancels task by ID
- Attempts to cancel associated queue job
- Updates task status to 'cancelled'
- Emits task:cancel events

#### handleRepairTask
```typescript
export function handleRepairTask(
  _req: IncomingMessage,
  res: ServerResponse,
  taskId: string,
  context: AuthContext | null
): void
```
- Reconciles task with thread and result states
- Detects orphaned threads, missing results
- Returns repair report with issues and fixes applied

#### handleGetTaskTruth
```typescript
export function handleGetTaskTruth(
  _req: IncomingMessage,
  res: ServerResponse,
  taskId: string,
  context: AuthContext | null
): void
```
- Returns authoritative task state
- Includes task, thread, job, and result status
- Useful for debugging state inconsistencies

### Queue Handler (runtime-queue/routes.ts)

#### handleRetryJob
```typescript
export function handleRetryJob(
  req: IncomingMessage,
  res: ServerResponse,
  jobId: string,
  context: AuthContext | null
): void
```
- If jobId starts with "task-", suggests using /tasks endpoint
- Otherwise clones job and requeues
- Useful for raw queue-level retry operations

### Type Extensions (tasks/types.ts)

```typescript
// GranClawTask additions
threadId?: string      // Associated thread for conversation
retryCount?: number    // Number of retry attempts
lastRetryJobId?: string // Most recent retry job ID

// UpdateTaskInput additions
threadId?: string
retryCount?: number
lastRetryJobId?: string
```

### Frontend Updates (actions.ts)

```typescript
// Changed from /queue/jobs/:id/retry to /tasks/:id/retry
export async function retryTask(taskId: string, options?: { mode?: string })

// New functions
export async function cancelTask(taskId: string)
export async function repairTask(taskId: string)
export async function getTaskTruth(taskId: string)
```

## Files Modified

| File | Changes |
|------|---------|
| apps/api/src/modules/tasks/routes.ts | +400 lines: 4 new handlers |
| apps/api/src/modules/tasks/types.ts | +6 lines: new properties |
| apps/api/src/modules/tasks/index.ts | +4 exports |
| apps/api/src/modules/runtime-queue/routes.ts | +80 lines: handleRetryJob |
| apps/api/src/index.ts | +20 lines: route registration |
| apps/web/src/services/actions.ts | +120 lines: 4 functions |

## Verification Results

| Check | Result |
|-------|--------|
| npm run check (api) | ✅ PASS |
| npm run check (web) | ✅ PASS |
| npm run build (api) | ✅ PASS |

## WebSocket Events

| Event | Payload | When Emitted |
|-------|---------|--------------|
| task:retry:started | taskId, jobId, retryMode, planId | Retry enqueued |
| task:retry:completed | taskId, success, retryMode | Simple retry done |
| task:cancel:started | taskId, jobId | Cancel initiated |
| task:cancel:completed | taskId, status | Cancel finished |
| job:retried | jobId, originalId | Queue job retried |

## Security Considerations

1. **Authentication Required**: All handlers require valid AuthContext
2. **Tenant Isolation**: Tasks filtered by tenantId from context
3. **State Validation**: Only failed/error tasks can be retried
4. **Dangerous Ops Blocked**: isStepSafeForSimpleExecution still applies

## Migration Notes

### Frontend
- Change all `/queue/jobs/${taskId}/retry` calls to `/tasks/${taskId}/retry`
- Use new `retryTask()`, `cancelTask()`, `repairTask()` functions

### Existing Queue Operations
- `/queue/jobs/:id/retry` still works for raw job IDs
- Will suggest using /tasks endpoint for task-prefixed IDs

## Reports Generated

1. `P6_12_queue_operations_audit.md` - Initial endpoint audit
2. `P6_12_self_audit.md` - Final verification
3. `P6_12_queue_operations_retry_report.md` - This report

## Conclusion

P6.12 successfully resolves the 404 error and establishes a clean separation between task-level and queue-level operations. The UI now has full retry, cancel, and repair capabilities with intelligent retry semantics that adapt to task state.
