# P6.12 Queue Operations Audit Report

**Date**: 2026-05-13
**Auditor**: Claude Code
**Phase**: A - Operations Audit

## Problem Statement

The UI attempts to retry failed tasks via:
```
POST /queue/jobs/${taskId}/retry
```

This returns 404 because the endpoint doesn't exist.

## Current Endpoint Inventory

### Runtime Queue Routes (runtime-queue/routes.ts)

| Endpoint | Handler | Status |
|----------|---------|--------|
| GET /queue/stats | handleGetQueueStats | EXISTS |
| GET /queue/jobs | handleListJobs | EXISTS |
| GET /queue/jobs/:id | handleGetJob | EXISTS |
| POST /queue/jobs/:id/cancel | handleCancelJob | EXISTS |
| POST /queue/pause | handlePauseQueue | EXISTS |
| POST /queue/resume | handleResumeQueue | EXISTS |
| GET /queue/dead-letter | handleListDeadLetter | EXISTS |
| POST /queue/dead-letter/:id/requeue | handleRequeueDeadLetter | EXISTS |
| DELETE /queue/dead-letter/:id | handleDeleteDeadLetter | EXISTS |
| **POST /queue/jobs/:id/retry** | - | **MISSING** |

### Task Routes (tasks/routes.ts)

| Endpoint | Handler | Status |
|----------|---------|--------|
| GET /tasks | handleGetTasks | EXISTS |
| GET /tasks/:id | handleGetTaskById | EXISTS |
| GET /tasks/:id/result | handleGetTaskResult | EXISTS |
| POST /tasks/:id/steps | handleExecuteSteps | EXISTS |
| POST /tasks/:id/reconcile | handleReconcileTask | EXISTS |
| POST /tasks/reconcile-all | handleReconcileAllTasks | EXISTS |
| **POST /tasks/:id/retry** | - | **MISSING** |
| **POST /tasks/:id/cancel** | - | **MISSING** |
| **POST /tasks/:id/repair** | - | **MISSING** |

### Frontend API Calls (services/actions.ts)

| Function | Endpoint Called | Status |
|----------|----------------|--------|
| retryTask(taskId) | POST /queue/jobs/${taskId}/retry | **BROKEN - 404** |
| cancelTask(taskId) | POST /queue/jobs/${taskId}/cancel | WORKS (if job exists) |

## Root Cause Analysis

1. **Missing Endpoint**: POST /queue/jobs/:id/retry is not registered in index.ts
2. **Wrong Endpoint**: Frontend uses queue/jobs route with taskId, not jobId
3. **No Task Retry**: There's no POST /tasks/:id/retry endpoint at all
4. **Semantic Confusion**: taskId vs jobId not properly handled

## Required Implementation

### Phase B-D: New Endpoints Needed

1. **POST /tasks/:id/retry** (Primary - UI should use this)
   - Load original task
   - Determine retry mode
   - Create new queue job linked to task
   - Update task status
   - Emit WebSocket events

2. **POST /queue/jobs/:id/retry** (Secondary - technical/admin)
   - Find job by jobId
   - If jobId looks like taskId, redirect to task retry
   - Clone job payload
   - Create new retry job

3. **POST /tasks/:id/cancel**
   - Cancel task and associated job/thread

4. **POST /tasks/:id/repair**
   - Repair task/thread/job inconsistencies

### Phase H: Frontend Fix

Change `retryTask()` to call `/tasks/${taskId}/retry` instead of `/queue/jobs/${taskId}/retry`

## Files to Modify

| File | Changes |
|------|---------|
| apps/api/src/modules/runtime-queue/routes.ts | Add handleRetryJob |
| apps/api/src/modules/tasks/routes.ts | Add handleRetryTask, handleCancelTask, handleRepairTask |
| apps/api/src/modules/runtime-queue/index.ts | Export handleRetryJob |
| apps/api/src/modules/tasks/index.ts | Export new handlers |
| apps/api/src/index.ts | Register new routes |
| apps/web/src/services/actions.ts | Fix endpoint URLs |

## Risk Assessment

| Issue | Risk | Impact |
|-------|------|--------|
| Missing retry endpoint | HIGH | Users cannot retry failed tasks |
| Wrong endpoint URL | HIGH | 404 errors in production |
| No task-job linking on retry | MEDIUM | Lost correlation |
| No WS events on retry | LOW | UI doesn't update in real-time |
