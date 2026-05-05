# REPORTE CLAUDE - FIX 126

## 1. Objetivo ejecutado

Implementar detección de timeout y recuperación con ejecución multistep.

Cuando una operación excede el tiempo límite, el sistema ofrece:
- Estado claro de "TAREA INTERRUMPIDA"
- División en pasos para tareas complejas
- Ejecución paso a paso o reintento completo

## 2. Problema inicial

Después de FIX 125:
- El sistema manejaba pairing/reauth errors
- PERO los timeouts se mostraban como error genérico
- Tareas complejas ("descarga X y instálalo") fallaban enteras
- No había forma de reintentar de forma inteligente

## 3. Detección de timeout

### Patrones detectados

```typescript
const TIMEOUT_PATTERNS = [
  'timeout',
  'request timeout',
  'timed out',
  'etimedout',
  'connection timeout',
  'socket timeout',
  'operation timed out',
  'deadline exceeded'
]
```

### checkTimeout function

```typescript
function checkTimeout(input: StatusResolverInput): boolean {
  const errorText = (input.error || '').toLowerCase()
  const debugError = (input.debugSnapshot?.error || '').toLowerCase()

  for (const pattern of TIMEOUT_PATTERNS) {
    if (errorText.includes(pattern) || debugError.includes(pattern)) {
      return true
    }
  }
  return false
}
```

## 4. Nuevos estados

### ExecutionStatus

```typescript
export type ExecutionStatus =
  | 'not_started'
  | 'executed'
  | 'pending_confirmation'
  | 'setup_required'
  | 'reauthorization_required'
  | 'failed'
  | 'partial'
  | 'skipped'
  | 'timeout'  // FIX 126
```

### FinalUiStatus

```typescript
export type FinalUiStatus =
  | 'allowed'
  | 'executed'
  | 'pending_confirmation'
  | 'setup_required'
  | 'reauthorization_required'
  | 'failed'
  | 'partial'
  | 'blocked'
  | 'timeout'  // FIX 126
```

## 5. Módulo task-planner

### types.ts

```typescript
interface TaskStep {
  id: string
  order: number
  description: string
  input: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  dependsOnPrevious: boolean
  estimatedDuration: 'quick' | 'medium' | 'long'
}

interface SplitTaskResult {
  isSplittable: boolean
  originalInput: string
  steps: TaskStep[]
  totalDuration: 'quick' | 'medium' | 'long'
  reason: string
}
```

### task-splitter.ts

Conectores detectados:
- Español: "y", "e", "luego", "después"
- Inglés: "then", "and then", "after that"

Estimación de duración por verbo:
| Verbo | Duración |
|-------|----------|
| open/abre | quick |
| copy/copia | medium |
| download/descarga | long |
| install/instala | long |
| search/busca | medium |

Ejemplo de división:
```
Input: "descarga vlc y instálalo"
Steps:
  1. Descarga vlc (long)
  2. Instálalo (long)
```

## 6. Timeout recovery

### timeout-recovery.ts

```typescript
function generateTimeoutRecovery(
  originalInput: string,
  error?: string,
  tenantId?: string
): TimeoutRecoveryResult {
  const splitResult = splitIntoSteps({ input: originalInput, tenantId })

  if (splitResult.isSplittable) {
    return {
      recoveryType: 'timeout_recovery',
      isSplittable: true,
      steps: splitResult.steps,
      reason: `Dividir en ${steps.length} pasos`
    }
  }

  return {
    recoveryType: 'retry',
    isSplittable: false,
    steps: [singleStep],
    reason: 'Reintentar directamente'
  }
}
```

## 7. Endpoint /tasks/execute-steps

### Método

POST /tasks/execute-steps

### Input

```json
{
  "taskId": "opcional",
  "steps": [
    {
      "id": "step-1",
      "order": 1,
      "description": "Descarga vlc",
      "input": "descarga vlc",
      "status": "pending",
      "dependsOnPrevious": false,
      "estimatedDuration": "long"
    },
    {
      "id": "step-2",
      "order": 2,
      "description": "Instálalo",
      "input": "instálalo",
      "status": "pending",
      "dependsOnPrevious": true,
      "estimatedDuration": "long"
    }
  ],
  "startFromStepId": "opcional"
}
```

### Output

```json
{
  "success": true,
  "completedSteps": ["step-1", "step-2"],
  "failedStepId": null,
  "stepResults": {
    "step-1": { "status": "completed", "result": {...} },
    "step-2": { "status": "completed", "result": {...} }
  },
  "taskCompleted": true
}
```

## 8. Cambios UI

### SecurityResultPanel

Nuevo estado `timeout` con:
- Colores azules (#3b82f6, #eff6ff, #1e40af)
- Icono: ⏱
- Título: "TAREA INTERRUMPIDA"
- Mensaje: "La operación excedió el tiempo límite"

### Sección de pasos

Cuando hay pasos sugeridos:
- Lista visual de pasos con orden
- Indicador de duración (Rápido/Medio/Largo)
- Estado de cada paso (pendiente/completado/fallido)

### Botones de acción

```tsx
{/* Ejecutar paso a paso (si divisible) */}
{timeoutRecoveryInfo?.isSplittable && (
  <button onClick={() => onExecuteSteps(steps)}>
    ▶ Ejecutar paso a paso
  </button>
)}

{/* Reintentar completo */}
{onRetryTimeout && (
  <button onClick={onRetryTimeout}>
    🔄 Reintentar completo
  </button>
)}
```

## 9. Archivos creados

| Archivo | Descripción |
|---------|-------------|
| apps/api/src/modules/task-planner/types.ts | Tipos para task splitting |
| apps/api/src/modules/task-planner/task-splitter.ts | Lógica de división |
| apps/api/src/modules/task-planner/index.ts | Exports |
| apps/api/src/modules/orchestrator/timeout-recovery.ts | Estrategia recovery |

## 10. Archivos modificados

| Archivo | Cambios |
|---------|---------|
| execution-status/types.ts | +timeout en ExecutionStatus y FinalUiStatus |
| execution-status/status-resolver.ts | +checkTimeout(), +STATUS_LABELS/SEVERITY |
| orchestrator/types.ts | +RecoveryType, +TaskStepInfo, +TimeoutRecoveryResult |
| orchestrator/index.ts | +export timeout-recovery |
| tasks/routes.ts | +handleExecuteSteps |
| tasks/index.ts | +export handleExecuteSteps |
| apps/api/src/index.ts | +POST /tasks/execute-steps |
| SecurityResultPanel.tsx | +timeout status, +UI pasos |

## 11. Resultado npm run check

```
> @granclaw/api@0.1.0 check
> tsc --noEmit

> @granclaw/web@0.1.0 check
> tsc --noEmit

> @granclaw/core@0.1.0 check
> tsc --noEmit

> @granclaw/openclaw-adapter@0.1.0 check
> tsc --noEmit
```

**Sin errores.**

## 12. Resultado npm run build

```
> @granclaw/api@0.1.0 build
> tsc

> @granclaw/web@0.1.0 build
> tsc && vite build

✓ 67 modules transformed.
dist/index.html                   0.70 kB │ gzip:  0.42 kB
dist/assets/index-DcP1znqP.js   279.71 kB │ gzip: 75.52 kB
✓ built in 2.23s
```

**Build exitoso.**

## 13. Estado PROJECT_MEMORY.md

✅ Actualizado con entrada FIX 126:
- Detección de timeout documentada
- Nuevos estados documentados
- Módulo task-planner explicado
- Timeout recovery documentado
- Endpoint execute-steps documentado
- UI timeout documentada
- Verificaciones completadas
