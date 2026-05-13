# P6.11R Guard Closure Audit Report

**Date**: 2026-05-13
**Auditor**: Claude Code
**Phase**: A - Real Route Audit

## Summary

Audit of all locations where `useQueue=true` could potentially reach `runSimpleAgentTask` or streaming simple fallback.

## Critical Findings

### 1. orchestrator/routes.ts - Streaming Route Fallback (CRITICAL)

| Location | Route Type | Can useQueue reach simple fallback? | Risk | Fix |
|----------|------------|-------------------------------------|------|-----|
| Line 1673 | Streaming | YES - When planner fails | HIGH | Block, return planning_failed |
| Line 1768 | Streaming | YES - When queue fails | HIGH | Block, return queue_failed |

**Details**:
- When `executionMode.useQueue=true` and planner fails (line 1673), code logs "Planner failed... falling back to streaming" and continues to normal streaming execution at line 1779.
- When queue fails (line 1768), code logs "Queue failed, falling back to streaming" and continues to streaming execution.
- This violates P6.11 principle: when useQueue=true, NO fallback to simple/streaming execution.

### 2. tasks/routes.ts - Step Execution (MEDIUM)

| Location | Route Type | Can useQueue reach simple fallback? | Risk | Fix |
|----------|------------|-------------------------------------|------|-----|
| Line 201 | Step execution | YES - All steps use runSimpleAgentTask | MEDIUM | Check step type, only allow reasoning/simple steps |

**Details**:
- `executeStepsSequentially()` calls `runSimpleAgentTask()` for ALL steps regardless of step type.
- If step is download/install/browser/deploy, this could execute dangerous actions directly.
- Should verify step type before calling runSimpleAgentTask.

### 3. orchestrator/routes.ts - runSimpleAgentTask Callers (SAFE)

| Location | Route Type | Protected? | Risk | Status |
|----------|------------|------------|------|--------|
| Line 703 | Normal openclaw | YES - After useQueue check at 272 | LOW | SAFE |
| Line 1276 | Fallback | YES - Guard at line 1216 | LOW | SAFE |

**Details**:
- Line 703: Only reached if `executionMode.useQueue=false` (checked at line 272)
- Line 1276: Protected by explicit guard at line 1216 that returns error if useQueue=true

### 4. scripts/granclaw-dev.sh - Not Executable (LOW)

| Location | Issue | Risk | Fix |
|----------|-------|------|-----|
| scripts/granclaw-dev.sh | Mode 100644 (not executable) | LOW | git update-index --chmod=+x |

**Details**:
- Git shows `100644` mode instead of `100755`
- npm scripts use `./scripts/granclaw-dev.sh` which requires executable permission
- On Windows this works but on Linux/Mac will fail with "Permission denied"

## Pattern Search Results

### runSimpleAgentTask callers:
1. `tasks/routes.ts:201` - Step execution (NEEDS FIX)
2. `orchestrator/service.ts:233` - Definition only
3. `orchestrator/routes.ts:703` - Normal route (SAFE)
4. `orchestrator/routes.ts:1276` - Fallback route (SAFE)

### Fallback patterns found:
1. `routes.ts:1673` - "Planner failed... falling back to streaming" (NEEDS FIX)
2. `routes.ts:1768` - "Queue failed, falling back to streaming" (NEEDS FIX)
3. `routes.ts:2096` - "Fallback to OpenClaw streaming" (contextual, safe)

### useQueue patterns:
- `intent-classifier.ts:361,363,375,387,405,415,427` - Mode definitions (OK)
- `orchestrator/routes.ts:210,272,1215,1216,1608,1655` - Usage checks (OK)
- `orchestrator/service.ts:258` - Guard in runSimpleAgentTask (OK)

## Required Changes

### Phase B: Streaming Route Parity
- Line 1673: Return planning_failed event, NOT fallback
- Line 1768: Return queue_failed event, NOT fallback
- Must mirror non-streaming behavior exactly

### Phase C: Centralize Guard Helper
- Create `mustUseQueue(intent, executionMode): boolean`
- Use in all routes and retry paths

### Phase D: Tasks Routes Legacy
- Add step type validation before runSimpleAgentTask
- Only allow reasoning/simple_completion steps
- Block download/install/browser/deploy steps

### Phase G: Dev Script
- `git update-index --chmod=+x scripts/granclaw-dev.sh`

## Conclusion

P6.11 successfully closed the normal route holes but left streaming route vulnerable. This audit identifies 4 locations requiring immediate fixes.
