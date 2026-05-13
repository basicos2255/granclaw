# P6.13 Validation Explainability Audit

**Date**: 2026-05-13
**Auditor**: Claude Code
**Phase**: A - Validation Failures Audit

## Summary of Findings

The system correctly validates execution evidence but fails to communicate validation failures in a human-understandable way.

## Failure Patterns Found

| Failure | Current Message | Missing Explanation | Needed UX | Fix Location |
|---------|-----------------|---------------------|-----------|--------------|
| Validation failed | `source: 'validation'`, no error text | What evidence was missing | Human-readable error + recovery actions | tasks/service.ts, TasksPage.tsx |
| Missing artifact | `reason: 'artifacts required but not generated'` | What artifact was needed, what capability was tried | "No se generó archivo. Capability X no está configurada." | task-memory/types.ts, UI |
| Missing output | `reason: 'outputs required but not generated'` | What output was expected | "No se obtuvo resultado esperado." | task-memory/types.ts, UI |
| No actions executed | `reason: 'no actions executed'` | Why no actions ran | "La tarea no pudo ejecutar ninguna acción. Puede que falte configuración." | UI |
| Provider mock | `warning: 'Executed via mock provider'` | Real provider not available | "Se usó simulación. El provider real no está configurado." | UI |
| Download failed | Task status error, source validation | Why download didn't work | "No se pudo descargar. ¿Está configurado el navegador?" | New capability check |
| Browser failed | Task status error | Browser not available | "El navegador no está disponible." | New capability check |

## Code Path Analysis

### 1. Evidence Validation (task-memory/types.ts:378)

```typescript
function validateExecutionEvidence(input): ValidateEvidenceResult {
  // Checks: executionId, provider, timestamps, actions, artifacts, outputs
  // Returns: { valid, canMarkSuccess, missingEvidence[], warnings[], suggestedState }
}
```

**Problem**: `missingEvidence` contains technical strings like `'artifacts required but not generated'` - not user-friendly.

### 2. Task Completion (tasks/service.ts:204)

```typescript
function completeTaskWithEvidence(input): CompleteTaskWithEvidenceResult {
  // Sets: reason = validation.missingEvidence.join(', ')
}
```

**Problem**: The `reason` field gets joined missing evidence but is never displayed to user in a helpful way.

### 3. Orchestrator Error Source (orchestrator/routes.ts:301, 1684)

```typescript
debugSnapshot.source = 'validation'  // P6.11: Use 'validation' for planner failures
```

**Problem**: "validation" as source tells user nothing about what failed or why.

### 4. UI Display (TasksPage.tsx:311-361)

```tsx
{task.provider && (
  <span>via {task.provider}</span>
)}
// ...
{task.error && (
  <div>Error: {task.error}</div>
)}
```

**Problem**:
- Shows `via validation` but doesn't explain what validation means
- Shows `task.error` but for validation failures, error might be empty
- Never shows `task.reason` which contains the actual failure info

## Capabilities Status

### download_file
- Defined in: composite-tasks/planner.ts, task-memory, dag-execution
- Worker: NOT IMPLEMENTED (no real download worker)
- Validation: Requires artifacts (workflow-validation/artifact-checks.ts:50)

### browser (navigate, click, etc)
- Defined in: channels/browser/index.ts
- Status: Stub implementation, requires Playwright not installed
- Channel registry: Listed but not really functional

## Missing Components

1. **ValidationFailureReason enum** - Canonical failure codes
2. **TaskFailureExplanation model** - Human + technical messages
3. **Capability readiness endpoint** - GET /capabilities/:id/readiness
4. **Recovery actions mapping** - What user can do for each failure
5. **Download test endpoint** - POST /capabilities/download/test
6. **UI error explanation component** - Shows what failed + actions

## Files to Modify

| File | Changes |
|------|---------|
| modules/tasks/types.ts | Add ValidationFailureReason, TaskFailureExplanation |
| modules/tasks/service.ts | Return enriched failure explanation |
| modules/capabilities/service.ts | Add getCapabilityReadiness() |
| modules/capabilities/routes.ts | Add /capabilities/:id/readiness endpoint |
| apps/web/src/pages/product/TasksPage.tsx | Show failure explanation, not just "via validation" |
| apps/web/src/pages/product/TaskDetailPage.tsx | Show full failure details + recovery actions |
