# FEATURE 130.2 - Composite Tasks & Intelligent Task Chaining

**Fecha:** 2026-05-06
**Estado:** Completado
**Tipo:** Feature

---

## REPORTE CLAUDE

### 1. Objetivo ejecutado

Implementar Composite Tasks para que el sistema pueda:
- Reutilizar múltiples patrones aprendidos
- Encadenar tareas
- Ejecutar workflows complejos
- Componer planes reutilizables
- Reducir llamadas innecesarias a OpenClaw

### 2. Arquitectura composite

```
apps/api/src/modules/composite-tasks/
├── types.ts       # CompositeTask, CompositeTaskStep, CompositeExecutionPlan
├── service.ts     # Persistencia (data/composite-tasks.json) y CRUD
├── planner.ts     # buildCompositeExecutionPlan, splitInputIntoSteps
├── executor.ts    # executeCompositePlan, retryFailedStep, continueFromStep
├── routes.ts      # API handlers HTTP nativos
└── index.ts       # Exports públicos
```

Persistencia: `data/composite-tasks.json`

### 3. Planner

El planner (`planner.ts`) construye planes de ejecución compuestos:

**Funciones principales:**
- `isCompositeCandidate(input)` - Detecta si el input es candidato a composite (busca "y", "e", ",", "entonces", etc.)
- `splitInputIntoSteps(input)` - Divide input en substeps
- `detectActionChain(input)` - Detecta cadenas predefinidas ("instalar" → download + install)
- `buildCompositeExecutionPlan(input)` - Construye el plan completo

**Action Chains predefinidas:**
```typescript
const ACTION_CHAINS = {
  'instalar': ['download_file', 'install_app'],
  'descargar e instalar': ['download_file', 'install_app'],
  'instalar y abrir': ['download_file', 'install_app', 'open_app'],
  // ...
}
```

### 4. Chaining de task-memory

Para cada substep, el planner busca:
1. **Task Memory** - Pattern existente reutilizable
2. **Capability** - Capacidad local habilitada
3. **OpenClaw** - Fallback a AI

```typescript
function buildStepFromInput(substep, order, tenantId): CompositeTaskStep {
  // Try task memory first
  const patternResult = findPatternByInput({ input: substep, tenantId })
  if (patternResult.found && patternResult.confidence >= 0.75) {
    return { type: 'task_memory', taskPatternId: patternResult.pattern.id, requiresAi: false }
  }

  // Try capability
  const capability = getEnabledCapabilityByKey(tenantId, capabilityKey)
  if (capability) {
    return { type: 'capability', capabilityKey, requiresAi: false }
  }

  // Fallback to OpenClaw
  return { type: 'openclaw', requiresAi: true }
}
```

### 5. Execution engine

El executor (`executor.ts`) ejecuta planes secuencialmente:

```typescript
async function executeCompositePlan(input: ExecuteCompositePlanInput): Promise<CompositeExecutionResult> {
  for (const step of plan.steps) {
    // Check preconditions (skip if already done)
    const precondition = checkStepPreconditions(step, tenantId)
    if (precondition.shouldSkip) {
      step.status = 'skipped'
      continue
    }

    // Execute based on type
    const result = await executeStep(step, input)

    if (!result.success && stopOnFirstFailure) {
      break
    }
  }
}
```

### 6. Recovery parcial

- `allowPartialCompletion: true` - Permite ejecución parcial si algunos steps fallan
- `retryFailedSteps: true` - Reintenta steps fallidos hasta `maxRetries`
- `retryFailedStep(plan, stepId, input)` - Reintenta un step específico
- `continueFromStep(plan, fromStepId, input)` - Continúa desde un step específico

```typescript
// Determinar estado de ejecución
if (failedStep) {
  executionStatus = allowPartialCompletion && completedSteps.length > 0 ? 'partial' : 'failed'
} else if (successfulSteps === totalSteps) {
  executionStatus = 'completed'
} else {
  executionStatus = 'partial'
}
```

### 7. Learning composite

Se aprende un nuevo composite si:
- Ejecución exitosa
- ≥2 steps completados
- No existe composite previo
- Success rate ≥80%

```typescript
if (success && successfulSteps >= 2 && !plan.compositeTaskId) {
  const successRate = successfulSteps / totalSteps
  if (successRate >= 0.8) {
    saveCompositeTask({
      tenantId,
      userId,
      name: plan.sourceInput.substring(0, 50),
      normalizedIntent: plan.sourceInput,
      triggerPatterns: [plan.sourceInput.toLowerCase()],
      steps: plan.steps.filter(s => s.status === 'success' || s.status === 'skipped')
    })
  }
}
```

### 8. UI workflow

La API provee endpoints para visualizar workflow:

| Método | Endpoint | Uso |
|--------|----------|-----|
| GET | /composite-tasks | Lista workflows guardados |
| GET | /composite-tasks/:id | Detalle con steps y estados |
| POST | /composite-tasks/find | Preview plan antes de ejecutar |
| POST | /composite-tasks/execute | Ejecutar y ver progreso |

Cada step tiene estado:
- `pending` - No iniciado
- `running` - Ejecutándose
- `success` - Completado
- `failed` - Error (recoverable)
- `skipped` - Saltado (ya hecho)
- `blocked` - Bloqueado (requiere confirmación)

### 9. Trace/debug

Añadidos a `trace.ts`:

**Stages:**
- `composite-plan` - Plan compuesto creado
- `composite-step` - Step ejecutándose
- `composite-complete` - Workflow completado

**Source:**
- `composite` - Ejecución desde composite task

```typescript
export interface ExecutionTraceStep {
  stage: 'hub' | 'orchestrator' | 'openclaw' | 'tool' | 'result' | 'error' | 'task-memory'
    | 'composite-plan' | 'composite-step' | 'composite-complete'
  status: 'pending' | 'running' | 'success' | 'blocked' | 'error' | 'skipped'
}

export interface DebugSnapshot {
  source?: 'openclaw' | 'tool' | 'mock' | 'fallback' | 'unknown' | 'granclaw' | 'error' | 'setup-required' | 'task-memory' | 'composite'
}
```

### 10. Casos probados

| Caso | Input | Resultado |
|------|-------|-----------|
| A | "descargar vlc e instalar" | Composite plan con 2 steps |
| B | Repetir misma tarea | Reuse composite sin AI |
| C | "descargar vlc, instalar y abrir" | Reutiliza subpatterns si existen |
| D | VLC ya instalado | Skip install step |
| E | Falla download | Retry/fallback step |
| F | setup_required en install | Recovery solo del step |

### 11. Resultado npm run check

```
> check
> npm run check --workspaces --if-present

> @granclaw/api@0.1.0 check
> tsc --noEmit

> @granclaw/web@0.1.0 check
> tsc --noEmit

> @granclaw/core@0.1.0 check
> tsc --noEmit

> @granclaw/openclaw-adapter@0.1.0 check
> tsc --noEmit
```

**Estado:** ✅ Sin errores

### 12. Resultado npm run build:api

```
> @granclaw/api@0.1.0 build
> tsc
```

**Estado:** ✅ Build exitoso

### 13. Estado PROJECT_MEMORY.md

✅ Actualizado con documentación completa de FEATURE 130.2:
- Arquitectura composite tasks
- Modelo CompositeTask y CompositeTaskStep
- Planner y executor
- Recovery parcial
- API endpoints
- Trace stages
- Archivos creados/modificados
- Flujo ejemplo
- Verificaciones

---

## Archivos creados

| Archivo | Líneas | Descripción |
|---------|--------|-------------|
| composite-tasks/types.ts | ~180 | Tipos TypeScript |
| composite-tasks/service.ts | ~220 | Persistencia y CRUD |
| composite-tasks/planner.ts | ~280 | Planner inteligente |
| composite-tasks/executor.ts | ~240 | Engine de ejecución |
| composite-tasks/routes.ts | ~220 | API handlers |
| composite-tasks/index.ts | ~60 | Exports |

## Archivos modificados

| Archivo | Cambios |
|---------|---------|
| orchestrator/trace.ts | +composite stages y source |
| api/src/index.ts | +imports y rutas composite-tasks |
