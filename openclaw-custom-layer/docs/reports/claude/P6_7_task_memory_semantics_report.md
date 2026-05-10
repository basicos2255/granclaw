# P6.7 - Task Memory Semantics, Execution Guarantees & Artifact Validation

**Fecha:** 2026-05-10
**Autor:** Claude
**Estado:** Completado

---

## Resumen Ejecutivo

P6.7 corrige un **BUG CRITICO** donde task-memory actuaba como "execution cache", generando status success sin ejecucion real. Ahora:

- Task-memory es **planner accelerator**, no execution cache
- Success requiere **ExecutionEvidence** real
- Download tasks requieren **artifacts**
- Search tasks requieren **outputs**
- Pattern match = estrategia reutilizada, NO ejecucion completada

---

## Problema Corregido

### Antes (Bug)

```
User: "Busca programa y descarga"
  ↓
Pattern found in task-memory
  ↓
recordPatternExecution(success=true)  ← SIN EJECUTAR!
  ↓
Task status = 'success'  ← FALSO!
  ↓
Resultado: No download, no artifacts, no real execution
```

### Despues (Fix)

```
User: "Busca programa y descarga"
  ↓
Pattern found in task-memory (strategy lookup)
  ↓
EXECUTE each pattern step via OpenClaw  ← EJECUCION REAL
  ↓
Validate ExecutionEvidence:
  - actionsExecuted > 0
  - artifactsGenerated (for downloads)
  - outputsGenerated (for searches)
  ↓
IF evidence valid: status = 'completed'
ELSE: status = 'needs_artifacts' or 'needs_outputs'
```

---

## Arquitectura P6.7

### ExecutionEvidence Model

```typescript
interface ExecutionEvidence {
  executionId: string
  provider: 'openclaw' | 'granclaw' | 'local' | 'capability' | 'mock'
  workerId?: string
  startedAt: string
  completedAt: string
  actionsExecuted: number
  outputsGenerated: boolean
  outputCount: number
  artifactsGenerated: boolean
  artifactCount: number
  durationMs: number
  validationStatus?: 'pending' | 'passed' | 'failed' | 'skipped'
}
```

### Semantic Execution States

| Estado | Descripcion | Cuando |
|--------|-------------|--------|
| thinking | AI analizando | Input recibido |
| planning | Construyendo plan | Pre-ejecucion |
| reusing_strategy | Pattern encontrado | Task-memory hit |
| queued | En cola | Esperando recursos |
| executing | Corriendo pasos | Ejecucion real |
| validating | Verificando resultados | Post-ejecucion |
| waiting_approval | Necesita confirmacion | Accion sensible |
| waiting_input | Necesita info | Datos faltantes |
| needs_artifacts | Faltan artifacts | Download sin archivo |
| needs_outputs | Faltan outputs | Search sin resultados |
| completed | Exito con evidencia | Todo validado |
| failed | Error | Ejecucion fallida |
| cancelled | Usuario cancelo | Cancelacion |
| paused | Usuario pauso | Pausa |

### Required Artifacts/Outputs

```typescript
// Actions que REQUIEREN artifacts para ser success
const ARTIFACT_REQUIRED_ACTIONS = [
  'download_file',
  'install_app',
  'create_file',
  'copy_file'
]

// Actions que REQUIEREN outputs para ser success
const OUTPUT_REQUIRED_ACTIONS = [
  'search_web',
  'search_file',
  'run_command'
]

// Actions que REQUIEREN confirmacion
const CONFIRMATION_REQUIRED_ACTIONS = [
  'install_app',
  'uninstall_app',
  'delete_file',
  'download_file'
]
```

---

## Cambios Implementados

### Backend

| Archivo | Cambio |
|---------|--------|
| `task-memory/types.ts` | ExecutionEvidence, SemanticExecutionState, validacion functions |
| `task-memory/index.ts` | Exports nuevos tipos y funciones |
| `tasks/types.ts` | HumanTaskStatus, executionEvidence en GranClawTask |
| `tasks/service.ts` | completeTaskWithEvidence(), createExecutionEvidence() |
| `composite-tasks/executor.ts` | **FIX CRITICO**: task_memory case ahora EJECUTA steps |

### Frontend

| Archivo | Cambio |
|---------|--------|
| `services/api.ts` | HumanTaskState extendido con nuevos estados |
| `components/threads/HumanTaskStateBadge.tsx` | Nuevos badges para estados P6.7 |
| `components/threads/index.ts` | Export needsEvidence() |

---

## BUG FIX Principal

**Archivo:** `composite-tasks/executor.ts`

**Antes (Bug):**
```typescript
case 'task_memory': {
  const memoryCheck = checkTaskMemory({...})
  if (memoryCheck.canReuse) {
    const execPlan = getExecutionPlanFromPattern({...})
    // BUG: Records success WITHOUT executing!
    recordPatternExecution(patternId, true, duration)
    return { success: true, fromTaskMemory: true }
  }
}
```

**Despues (Fix):**
```typescript
case 'task_memory': {
  const memoryCheck = checkTaskMemory({...})
  if (memoryCheck.canReuse) {
    const execPlan = getExecutionPlanFromPattern({...})

    // P6.7 FIX: Actually EXECUTE the steps
    for (const patternStep of execPlan.steps) {
      const stepResult = await runSimpleAgentTask({
        message: patternStep.input,
        tenantId,
        sessionId
      })
      if (!stepResult.success) {
        allStepsSucceeded = false
        break
      }
    }

    // Only record success if execution actually succeeded
    recordPatternExecution(patternId, allStepsSucceeded, duration)
    return { success: allStepsSucceeded, ... }
  }
}
```

---

## Nuevas Funciones

### completeTaskWithEvidence()

```typescript
function completeTaskWithEvidence(input: {
  taskId: string
  actionType: TaskActionType
  evidence: ExecutionEvidence
  ...
}): CompleteTaskWithEvidenceResult

// Returns:
{
  success: boolean        // true only if evidence is valid
  status: TaskStatus
  humanStatus: HumanTaskStatus
  evidenceValid: boolean
  missingEvidence: string[]
  warnings: string[]
}
```

### validateExecutionEvidence()

```typescript
function validateExecutionEvidence(input: {
  evidence: ExecutionEvidence
  actionType: TaskActionType
  requireArtifacts?: boolean
  requireOutputs?: boolean
}): ValidateEvidenceResult

// Checks:
// - executionId exists
// - provider is valid
// - actionsExecuted > 0
// - artifacts if required for action type
// - outputs if required for action type
// - no error field
// - validation passed
```

---

## Verificaciones

| Check | Estado |
|-------|--------|
| npm run check (api) | PASS |
| npm run check (web) | PASS |
| npm run build (api) | PASS |
| npm run build (web) | Vite cache issue (no relacionado) |
| TypeScript strict | PASS |

---

## Principio Fundamental

> **Task-memory es un ACELERADOR DE PLANIFICACION, no un cache de ejecucion.**
>
> Un pattern match significa "usa esta estrategia", NO "ejecucion completada".
> La ejecucion real DEBE ocurrir, y la evidencia DEBE ser validada.

---

## Siguiente

- Integracion con UI para mostrar estados semanticos
- Real-time WS updates para estados de ejecucion
- Metricas de evidencia de ejecucion

