# P6.9R - Multistep Execution Self Audit

**Fecha:** 2026-05-11
**Autor:** Claude
**Estado:** Verificado

---

## Audit: runSimpleAgentTask Usage

| File | Line | Usage | Safe? | Fix Applied |
|------|------|-------|-------|-------------|
| `execution-policy/intent-classifier.ts` | 324 | Comment only | ✅ OK | N/A |
| `orchestrator/service.ts` | 233 | Definition + Guard | ✅ OK | Has guard |
| `orchestrator/service.ts` | 373 | New executeProviderTask | ✅ OK | Bypass function |
| `orchestrator/routes.ts` | 18 | Import | ✅ OK | Entry point |
| `orchestrator/routes.ts` | 610 | Fallback execution | ✅ OK | After queue check |
| `orchestrator/routes.ts` | 1134 | Fallback execution | ✅ OK | After queue check |
| `composite-tasks/executor.ts` | - | REMOVED | ✅ FIXED | Now uses executeProviderTask |
| `dag-execution/executor.ts` | - | REMOVED | ✅ FIXED | Now uses executeProviderTask |
| `runtime-queue/execution-integration.ts` | - | REMOVED | ✅ FIXED | Now uses executeProviderTask |
| `tasks/routes.ts` | 199 | Direct execution | ✅ OK | Entry point with guard |

---

## Audit: 'pending' Status Usage

| File | Line | Context | Safe? | Fix Applied |
|------|------|---------|-------|-------------|
| `orchestrator/routes.ts` | 345 | Queue status | ✅ FIXED | Now uses 'queued' |
| `orchestrator/routes.ts` | 1583 | Queue status (stream) | ✅ FIXED | Now uses 'queued' |
| Other lines | - | Proposals/steps | ✅ OK | Different context |

---

## Audit: 'queued' Status Support

| Component | Supports 'queued'? | Notes |
|-----------|-------------------|-------|
| TaskStatus type | ✅ YES | Added in P6.9R |
| HumanTaskState type | ✅ YES | Already existed |
| syncThreadWithTask() | ✅ YES | Added queued mapping |
| completeTask() | ✅ YES | Works with new status |

---

## Verified Flows

### Flow 1: Multistep Task via Queue

```
User: "busca programa freeware y descarga"
  ↓
classifyIntent() → install_download_action
  ↓
classifyExecutionMode() → queued_workflow, useQueue=true
  ↓
buildCompositeExecutionPlan() → Plan with steps
  ↓
enqueueCompositeTask() → Job created
  ↓
compositeTaskHandler → executeCompositePlan()
  ↓
executeStep() → executeOpenClawStep()
  ↓
executeProviderTask() → ✅ NO GUARD (internal)
  ↓
Task executed successfully
```

### Flow 2: Simple Task via Entry Point

```
User: "cuál es la capital de Francia"
  ↓
classifyIntent() → simple_question
  ↓
classifyExecutionMode() → simple_completion, useQueue=false
  ↓
runSimpleAgentTask() → ✅ GUARD OK (simple task)
  ↓
Task executed successfully
```

### Flow 3: Attempt to Bypass Guard

```
Code: runSimpleAgentTask({ message: "descarga X" })
  ↓
classifyIntent() → install_download_action
  ↓
classifyExecutionMode() → queued_workflow, useQueue=true
  ↓
GUARD TRIGGERS → ❌ Blocked
  ↓
Error: "Multistep tasks must use queue/workflow system"
```

---

## Remaining Issues (Deferred)

| Issue | Priority | Status |
|-------|----------|--------|
| WS events for queue progress | P2 | Deferred |
| Evidence enforcement | P2 | Deferred |
| Artifact validation | P2 | Deferred |
| Download flow validation | P3 | Deferred |

---

## Verification Results

| Test | Result |
|------|--------|
| npm run check (api) | ✅ PASS |
| npm run build (api) | ✅ PASS |
| Guard blocks multistep at entry | ✅ |
| Internal executors bypass guard | ✅ |
| 'queued' status flows correctly | ✅ |
| Thread sync handles 'queued' | ✅ |

---

## Conclusion

The critical bug where queue executors would fail due to the guard has been fixed. All internal executors now use `executeProviderTask()` which bypasses the multistep guard while entry points still protect against direct multistep execution.
