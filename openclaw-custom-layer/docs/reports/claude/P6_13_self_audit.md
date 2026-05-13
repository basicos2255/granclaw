# P6.13 Self Audit Report

**Date**: 2026-05-13
**Auditor**: Claude Code
**Phase**: M - Self Audit Final

## Verification Checklist

### 1. "via validation" as final message
**Before**: Task error showed only "via validation" without explanation
**After**: Shows `failureExplanation.title` and `failureExplanation.humanMessage`
**Status**: ✅ FIXED

### 2. Error generico sin reason
**Before**: `task.error` was empty for validation failures
**After**: `failureExplanation` provides:
- `title` - Human-readable title
- `humanMessage` - Full explanation
- `technicalMessage` - Technical details
- `code` - Canonical failure code
**Status**: ✅ FIXED

### 3. validation_failed sin explanation
**Before**: Task status was `error`, source was `validation`, no details
**After**: `buildFailureExplanation()` creates full explanation with:
- Failure reason code
- Human message
- Recovery actions
- Capability information
**Status**: ✅ FIXED

### 4. Missing artifact sin recovery action
**Before**: "artifacts required but not generated" - no actions
**After**: Recovery actions include:
- "Configurar descarga" (for download)
- "Reintentar con navegador"
- "Proporcionar URL"
- "Ver detalles"
**Status**: ✅ FIXED

### 5. Download task sin capability check
**Before**: Download tasks would fail without clear explanation
**After**: Capability readiness system provides:
- `GET /capabilities/readiness` - All capabilities status
- `GET /capabilities/:cap/readiness` - Specific capability status
- `POST /capabilities/:cap/test` - Test capability
- `CAPABILITY_IMPLEMENTATION_STATUS` map with implementation details
**Status**: ✅ FIXED

### 6. Random software download sin approval
**Note**: Safety is handled at planning level via `isStepSafeForSimpleExecution()` from P6.11R
The failure explanation now shows appropriate message when download capability is not available.
**Status**: ✅ COVERED (via P6.11R + capability readiness)

### 7. Fake artifact
**Before**: No check for whether artifact was real
**After**: If capability is not implemented (`CAPABILITY_IMPLEMENTATION_STATUS[type].implemented = false`), task fails with clear message: "La capacidad X aún no está implementada en GranClaw"
**Status**: ✅ FIXED

### 8. Success sin artifact
**Before**: Task could complete without required artifacts
**After**: `validateExecutionEvidence()` + `buildFailureExplanation()` ensures:
- Missing artifact = `missing_required_artifact` code
- Human message explains what was needed
- Recovery actions suggest alternatives
**Status**: ✅ FIXED (via P6.7 evidence validation + P6.13 explanation)

## Code Audit

### Tasks Service (service.ts)
```typescript
// P6.13: Build failure explanation when validation fails
const failureExplanation = !validation.canMarkSuccess
  ? buildFailureExplanation(
      validation.missingEvidence,
      validation.warnings,
      actionType,
      source,
      existingTask?.input
    )
  : undefined
```
**Integrated in**: `completeTaskWithEvidence()`, `completeTask()`

### Failure Reason Mapping (service.ts)
```typescript
function determineFailureCode(missingEvidence, warnings): ValidationFailureReason
// Maps technical strings to canonical codes:
// - "artifacts required" -> missing_required_artifact
// - "outputs required" -> missing_required_output
// - "no actions executed" -> no_actions_executed
// etc.
```

### Capability Readiness (capabilities/service.ts)
```typescript
const CAPABILITY_IMPLEMENTATION_STATUS: Record<string, {
  implemented: boolean  // true = working, false = stub
  provider?: string
  requiresApproval: boolean
  limitations?: string[]
  missingSetup?: string[]
}>
```

**Capabilities mapped**:
- browser: NOT IMPLEMENTED (requires Playwright)
- download: NOT IMPLEMENTED (requires browser)
- filesystem: IMPLEMENTED
- install_app: NOT IMPLEMENTED
- web_search: IMPLEMENTED
- ftp, email, whatsapp, calendar, screenshot, clipboard: NOT IMPLEMENTED

### Frontend Types (api.ts)
```typescript
export interface TaskFailureExplanation {
  code: string
  title: string
  humanMessage: string
  technicalMessage?: string
  capability?: string
  requiredArtifact?: string
  recoveryActions: RecoveryAction[]
  canRetry: boolean
  canRepair: boolean
  canReplan: boolean
}
```

### TasksPage UX
```tsx
{task.failureExplanation ? (
  <div>
    <div style={{ fontWeight: '600', color: '#991b1b' }}>
      {task.failureExplanation.title}
    </div>
    <div style={{ color: '#7f1d1d' }}>
      {task.failureExplanation.humanMessage}
    </div>
  </div>
) : task.error ? ...}
```

### TaskDetailPage UX
Shows full explanation with sections:
- "Qué pasó" - title
- Human message
- "Qué faltó" - capability, artifact, output badges
- "Qué puedes hacer" - recovery action buttons
- "Detalles técnicos" - collapsed technical info

## New API Endpoints

| Method | Endpoint | Handler |
|--------|----------|---------|
| GET | /capabilities/readiness | handleGetAllCapabilitiesReadiness |
| GET | /capabilities/:cap/readiness | handleGetCapabilityReadiness |
| POST | /capabilities/:cap/test | handleTestCapability |

## Files Modified

| File | Changes |
|------|---------|
| tasks/types.ts | +80 lines: ValidationFailureReason, RecoveryAction, TaskFailureExplanation |
| tasks/service.ts | +280 lines: buildFailureExplanation, helper functions |
| capabilities/types.ts | +45 lines: SystemCapabilityType, CapabilityReadiness |
| capabilities/service.ts | +150 lines: readiness functions, implementation map |
| capabilities/routes.ts | +90 lines: readiness endpoints |
| capabilities/index.ts | +6 exports |
| index.ts | +10 lines: route registration |
| web/api.ts | +30 lines: RecoveryAction, TaskFailureExplanation |
| TasksPage.tsx | +30 lines: failure explanation display |
| TaskDetailPage.tsx | +100 lines: full explanation section |

## Verification Results

| Check | Result |
|-------|--------|
| npm run check (api) | ✅ PASS |
| npm run check (web) | ✅ PASS |
| npm run build (api) | ✅ PASS |

## Remaining Considerations

1. **Download capability**: Not actually implemented - returns "capability_not_implemented"
2. **Browser capability**: Not actually implemented - returns "capability_not_implemented"
3. **Safety for random downloads**: Handled by P6.11R guards + capability_not_implemented message

## Conclusion

P6.13 successfully transforms cryptic "via validation" errors into human-readable explanations with:
- Clear failure titles
- Understandable messages
- Actionable recovery options
- Technical details for debugging

Users now understand WHY tasks failed and WHAT they can do about it.
