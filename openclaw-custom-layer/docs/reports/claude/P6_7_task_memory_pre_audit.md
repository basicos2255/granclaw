# P6.7 - Task Memory Pre-Audit Report

**Fecha:** 2026-05-10
**Autor:** Claude
**Estado:** Completado

---

## Resumen Ejecutivo

Se ha detectado un **BUG CRITICO** en el sistema de task-memory que causa que las tareas obtengan status "success" sin ejecucion real.

### Problema Principal

Task-memory esta actuando como **execution cache** en lugar de **planner accelerator**:

| Esperado | Actual |
|----------|--------|
| Pattern found → Get learned strategy | Pattern found → Mark success |
| Execute strategy steps | Skip execution |
| Validate outputs/artifacts | No validation |
| Then mark success | Premature success |

---

## Bugs Encontrados

### BUG 1: Premature Success en executor.ts

**Archivo:** `composite-tasks/executor.ts:92-110`

```typescript
case 'task_memory': {
  const memoryCheck = checkTaskMemory({...})

  if (memoryCheck.canReuse && memoryCheck.pattern) {
    const execPlan = getExecutionPlanFromPattern({...})

    // BUG: Records success WITHOUT executing the steps!
    recordPatternExecution(execPlan.patternId, true, execPlan.estimatedDuration)

    return {
      success: true,  // PREMATURE SUCCESS!
      result: {
        fromTaskMemory: true,
        steps: execPlan.steps  // NEVER EXECUTED!
      }
    }
  }
}
```

**Impacto:** Las tareas que coinciden con un pattern en task-memory se marcan como exitosas sin ejecutar ningun paso real.

---

### BUG 2: Sin Modelo ExecutionEvidence

**Problema:** No existe un modelo que capture evidencia de ejecucion real:
- No hay `provider` de ejecucion
- No hay `workerId`
- No hay `startedAt`/`completedAt` reales
- No hay `actionsExecuted` count
- No hay `outputsGenerated` validation
- No hay `artifactsGenerated` validation

**Archivos afectados:**
- `task-memory/types.ts` - Falta ExecutionEvidence
- `tasks/types.ts` - TaskStatus sin estados intermedios

---

### BUG 3: completeTask() Sin Validacion

**Archivo:** `tasks/service.ts:97-137`

```typescript
export function completeTask(
  id: string,
  status: TaskStatus,
  result?: unknown,
  // ...
): GranClawTask | null {
  // NO VALIDATION of outputs/artifacts!
  // Sets success without checking if task actually produced results
  return updateTask(id, {
    status,  // Can be 'success' without evidence
    // ...
  })
}
```

---

### BUG 4: TaskStatus Sin Estados Semanticos

**Archivo:** `tasks/types.ts:13`

```typescript
export type TaskStatus = 'pending' | 'running' | 'success' | 'blocked' | 'error' | 'unconfirmed'
```

**Falta:**
- `planning` - AI analizando input
- `reusing_strategy` - Reutilizando pattern
- `executing` - Corriendo pasos
- `validating` - Verificando resultados
- `needs_artifacts` - Esperando artifacts
- `needs_outputs` - Esperando outputs

---

### BUG 5: Pattern Reuse vs Execution Confundidos

**Archivo:** `orchestrator/task-memory-integration.ts`

El sistema tiene guards correctos:
- `executionConfirmed` flag requerido para `savePattern()`
- `learnFromExecution()` requiere `finalUiStatus === 'executed'`

**PERO** el bug esta en como se USA el pattern:
- `checkTaskMemory()` → returns `canReuse: true`
- `getExecutionPlanFromPattern()` → returns steps (no execution)
- El caller en `executor.ts` trata esto como ejecucion completada

---

## Flujo Actual (Buggy)

```
User: "Busca programa freeware y descarga"
    ↓
1. checkTaskMemory({input}) → pattern found, canReuse: true
    ↓
2. getExecutionPlanFromPattern() → returns learned steps
    ↓
3. recordPatternExecution(patternId, true) ← BUG: No execution happened!
    ↓
4. return { success: true, fromTaskMemory: true }
    ↓
5. Task status → 'success' ← FALSE SUCCESS!
    ↓
Result: No download, no artifacts, no real execution
```

---

## Flujo Correcto (Propuesto)

```
User: "Busca programa freeware y descarga"
    ↓
1. checkTaskMemory({input}) → pattern found
    ↓
2. status → 'reusing_strategy'
    ↓
3. getExecutionPlanFromPattern() → returns learned steps
    ↓
4. status → 'executing'
    ↓
5. ACTUALLY EXECUTE each step via OpenClaw/capabilities
    ↓
6. status → 'validating'
    ↓
7. validateExecutionEvidence({
     artifactsGenerated: true,  // For downloads
     outputsGenerated: true     // For searches
   })
    ↓
8. IF valid: recordPatternExecution(success=true), status → 'success'
   IF invalid: status → 'needs_artifacts' or 'needs_outputs'
```

---

## Archivos a Modificar

### Backend

| Archivo | Cambio |
|---------|--------|
| `task-memory/types.ts` | Add ExecutionEvidence type |
| `task-memory/service.ts` | Add execution validation |
| `tasks/types.ts` | Add semantic TaskStatus values |
| `tasks/service.ts` | Add completeTaskWithEvidence() |
| `composite-tasks/executor.ts` | Fix task_memory step execution |
| `orchestrator/task-memory-integration.ts` | Add evidence collection |
| `workflow-validation/service.ts` | Add artifact/output requirements |

### Frontend

| Archivo | Cambio |
|---------|--------|
| `components/threads/HumanTaskStateBadge.tsx` | Add new states |
| `services/api.ts` | Update TaskStatus type |

---

## Siguiente: FASE B-O

1. **FASE B:** Crear ExecutionEvidence type
2. **FASE C:** Implement execution guarantee rule
3. **FASE D:** Wire evidence collection into executor
4. **FASE E:** Fix memory reuse to require execution
5. **FASE F-G:** Add required artifact/output rules by action type
6. **FASE H-I:** Add semantic states + validation enforcement
7. **FASE J-L:** UI honesty + automation safety
8. **FASE M:** Verification
9. **FASE N:** Self audit
10. **FASE O:** Documentation

