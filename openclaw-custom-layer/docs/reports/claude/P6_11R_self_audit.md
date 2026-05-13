# P6.11R Self Audit Report

**Date**: 2026-05-13
**Auditor**: Claude Code
**Phase**: I - Self Audit Final

## runSimpleAgentTask Callers Analysis

### Location: tasks/routes.ts:219
```typescript
const taskResult = await runSimpleAgentTask({
  message: step.input,
  tenantId
})
```
**Status**: SAFE (P6.11R Protected)
**Protection**: `isStepSafeForSimpleExecution()` check at line 208
**Notes**: Only reasoning/analysis steps can reach this call. Download/install/browser/deploy steps are blocked.

### Location: orchestrator/service.ts:233
```typescript
export async function runSimpleAgentTask(input: RunTaskInput): Promise<RunTaskResult>
```
**Status**: DEFINITION ONLY
**Protection**: Internal guard at line 258 (`executionMode.useQueue`)
**Notes**: This function has its own guard that blocks multistep tasks.

### Location: orchestrator/routes.ts:703
```typescript
const result = await runSimpleAgentTask(taskInput)
```
**Status**: SAFE
**Protection**: Guard at line 272 (`if (executionMode.useQueue && routeDecision.provider === 'openclaw')`)
**Notes**: Only reached when useQueue=false.

### Location: orchestrator/routes.ts:1276
```typescript
const result = await runSimpleAgentTask(taskInput)
```
**Status**: SAFE
**Protection**: Guard at line 1216-1261 blocks if useQueue=true
**Notes**: Only reached as last fallback when useQueue=false.

## Fallback Patterns Status

### ELIMINATED (P6.11 + P6.11R):
| Location | Original Pattern | New Behavior |
|----------|-----------------|--------------|
| routes.ts:317 | Planner failed -> direct execution | Return error, NO fallback |
| routes.ts:439 | Queue failed -> direct execution | Return error, NO fallback |
| routes.ts:464 | Queue failed (edge case) | Return error, NO fallback |
| routes.ts:1700 | Planner failed (stream) -> streaming | Return error, NO fallback |
| routes.ts:1818 | Queue failed (stream) -> streaming | Return error, NO fallback |
| routes.ts:1843 | Queue failed (stream, edge) -> streaming | Return error, NO fallback |

### REMAINING (Safe / Different Context):
| Location | Pattern | Status |
|----------|---------|--------|
| service.ts:171 | Tool execution fallback to internal | SAFE - Internal tools only |
| routes.ts:2239 | Fallback to OpenClaw streaming | SAFE - Different context (GranClaw capability fallback) |
| composite-tasks/routes.ts:269 | DAG build failed -> legacy | SAFE - Different module |

## Script Executable Status

**File**: scripts/granclaw-dev.sh
**Git Mode**: 100755 (executable)
**package.json**: Uses `sh ./scripts/granclaw-dev.sh` (robust cross-platform)

## New Guards Added (P6.11R)

### mustUseQueue() Helper
```typescript
export function mustUseQueue(
  intent: IntentClassification,
  executionMode: ExecutionModeResult
): boolean
```
**Location**: execution-policy/intent-classifier.ts
**Usage**: Centralized check for all routes

### isStepSafeForSimpleExecution() Helper
```typescript
export function isStepSafeForSimpleExecution(stepDescription: string): boolean
```
**Location**: execution-policy/intent-classifier.ts
**Usage**: tasks/routes.ts step execution validation

### Streaming Route Final Guard
```typescript
if (executionMode.useQueue) {
  console.log(`[GranClaw Stream P6.11R] CRITICAL: Multistep task reached streaming fallback - blocking`)
  // Return error, not fallback
}
```
**Location**: routes.ts:1873-1912
**Purpose**: Final safety net for streaming route

## Verification Results

- `npm run check`: PASS (API and Web)
- `npm run build`: PASS (API)
- Script mode: 100755 (executable)

## Conclusion

All P6.11R objectives achieved:
1. Streaming route fallbacks eliminated
2. tasks/routes.ts step execution protected
3. Script made executable
4. Parity between normal and streaming routes
5. Centralized guards created
