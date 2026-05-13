# P6.12 Self Audit Report

**Date**: 2026-05-13
**Auditor**: Claude Code
**Phase**: N - Self Audit Final

## Endpoint Mapping Verification

### Task Operations (Primary)

| Endpoint | Handler | File | Status |
|----------|---------|------|--------|
| POST /tasks/:id/retry | handleRetryTask | tasks/routes.ts:382 | ✅ WIRED |
| POST /tasks/:id/cancel | handleCancelTask | tasks/routes.ts:620 | ✅ WIRED |
| POST /tasks/:id/repair | handleRepairTask | tasks/routes.ts:700 | ✅ WIRED |
| GET /tasks/:id/truth | handleGetTaskTruth | tasks/routes.ts:780 | ✅ WIRED |

### Queue Operations (Secondary)

| Endpoint | Handler | File | Status |
|----------|---------|------|--------|
| POST /queue/jobs/:id/retry | handleRetryJob | runtime-queue/routes.ts:520 | ✅ WIRED |
| POST /queue/jobs/:id/cancel | handleCancelJob | runtime-queue/routes.ts (existing) | ✅ EXISTING |
| POST /queue/dead-letter/:id/requeue | handleRequeueDeadLetter | runtime-queue/routes.ts (existing) | ✅ EXISTING |

## Frontend API Consistency

| Function | Endpoint Used | Status |
|----------|---------------|--------|
| retryTask() | /tasks/:id/retry | ✅ CORRECT |
| cancelTask() | /tasks/:id/cancel | ✅ CORRECT |
| repairTask() | /tasks/:id/repair | ✅ CORRECT |
| getTaskTruth() | /tasks/:id/truth | ✅ CORRECT |

## Retry Semantics Implementation

### determineRetryMode() Logic
```typescript
function determineRetryMode(task: GranClawTask): { mode: RetryMode; reason: string }
```

| Condition | Retry Mode | Reason |
|-----------|------------|--------|
| Task not failed/error | retry_same_plan | Task not in failed state |
| Has existing planId | retry_same_plan | Reuse existing plan |
| useQueue required | retry_replan | Task requires queue execution |
| Has failed step in trace | retry_from_failed_step | Resume from failure point |
| Safe for simple execution | retry_as_simple | Direct re-execution |
| Default | retry_replan | Full replanning |

## Type Additions

### GranClawTask (types.ts)
```typescript
// P6.12: Retry and thread tracking
threadId?: string
retryCount?: number
lastRetryJobId?: string
```

### UpdateTaskInput (types.ts)
```typescript
// P6.12: Retry tracking fields
threadId?: string
retryCount?: number
lastRetryJobId?: string
```

## Index.ts Route Registration

### GET Dynamic Routes
- `/tasks/:id/truth` → handleGetTaskTruth (line 394)

### POST Dynamic Routes (postDynamicRoutes)
- `/tasks/:id/retry` → handleRetryTask (line 571)
- `/tasks/:id/cancel` → handleCancelTask (line 575)
- `/tasks/:id/repair` → handleRepairTask (line 579)

### POST Dynamic Routes (postDynamicRoutesQueue)
- `/queue/jobs/:id/retry` → handleRetryJob (line 637)

## WebSocket Events Emitted

| Event | Location | Trigger |
|-------|----------|---------|
| task:retry:started | tasks/routes.ts | When retry job is enqueued |
| task:retry:completed | tasks/routes.ts | When simple retry completes |
| task:cancel:started | tasks/routes.ts | When cancel initiated |
| task:cancel:completed | tasks/routes.ts | When cancel finished |
| job:retried | runtime-queue/routes.ts | When queue job retried |

## Verification Results

| Check | Result |
|-------|--------|
| npm run check (api) | ✅ PASS |
| npm run check (web) | ✅ PASS |
| npm run build (api) | ✅ PASS |

## Error Fixes Applied

1. **runtime-queue/routes.ts:544** - `queue.getJob()` → `queue.get()`
2. **runtime-queue/routes.ts:23** - Added `emitQueueEvent` import
3. **tasks/routes.ts:360** - Fixed type casting for executionTrace
4. **tasks/routes.ts:530** - Fixed addMessage() to use single object parameter
5. **tasks/routes.ts:577** - Fixed TaskOutput type for outputs array
6. **tasks/routes.ts:822-823** - Changed `attempts`/`error` to `retryCount`/`lastError`

## 404 Resolution Verification

### Before P6.12
```
POST /queue/jobs/${taskId}/retry → 404 Not Found
```

### After P6.12
```
POST /tasks/${taskId}/retry → 200 OK (primary)
POST /queue/jobs/${jobId}/retry → 200 OK (secondary with suggestion to use /tasks)
```

## Conclusion

All P6.12 objectives achieved:
1. ✅ 404 on retry endpoint resolved
2. ✅ Task operations use `/tasks/:id/*` pattern
3. ✅ Queue operations available at `/queue/jobs/:id/*`
4. ✅ Frontend updated to use correct endpoints
5. ✅ Retry semantics with multiple modes implemented
6. ✅ Task truth endpoint for reconciliation
7. ✅ WebSocket events for operational visibility
8. ✅ All TypeScript checks pass
9. ✅ Build succeeds
