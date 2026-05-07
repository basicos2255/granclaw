# FEATURE 130.3 - Validated Workflows & Artifact Verification

**Fecha:** 2026-05-06
**Estado:** Completado
**Tipo:** Feature
**Dependencia:** FEATURE 130.2 (Composite Tasks)

---

## REPORTE CLAUDE

### 1. Objetivo ejecutado

Implementar validación de artefactos para workflows, verificando que cada paso realmente se ejecutó correctamente antes de aprender el workflow. Esto evita aprender patrones parciales o fallidos.

### 2. Arquitectura workflow-validation

```
apps/api/src/modules/workflow-validation/
├── types.ts           # ValidationType, ValidationResult, StepValidation, ValidationPolicy
├── validators.ts      # Funciones de validación por plataforma (Windows/macOS/Linux)
├── artifact-checks.ts # runValidation, runValidationWithRetry, canLearnWorkflow
├── service.ts         # validateWorkflowStep, shouldLearnWorkflow, getRecoveryOptions
└── index.ts           # Exports públicos
```

### 3. Tipos de validación

```typescript
export type ValidationType =
  | 'file_exists'        // Archivo existe en ruta
  | 'file_downloaded'    // Archivo descargado (busca en Downloads)
  | 'app_installed'      // Aplicación instalada en sistema
  | 'app_opened'         // Aplicación ejecutándose
  | 'process_running'    // Proceso activo
  | 'url_reachable'      // URL accesible
  | 'directory_exists'   // Directorio existe
  | 'custom'             // Validación personalizada

export const ACTION_VALIDATION_MAP: Record<TaskActionType, ValidationType | undefined> = {
  'download_file': 'file_downloaded',
  'install_app': 'app_installed',
  'uninstall_app': 'app_installed',    // inverted check
  'open_app': 'app_opened',
  'close_app': 'process_running',      // inverted check
  'open_file': 'file_exists',
  'open_url': 'url_reachable',
  'create_file': 'file_exists',
  'create_folder': 'directory_exists',
  // ...
}
```

### 4. Validadores por plataforma

**validators.ts** implementa validadores multiplataforma:

| Función | Windows | macOS | Linux |
|---------|---------|-------|-------|
| validateDownloadedFile | Busca en Downloads con fs.readdirSync | Busca en ~/Downloads | Busca en ~/Downloads |
| validateInstalledApplication | `wmic product`, `where`, `reg query` | `mdfind "kMDItemKind == 'Application'"` | `which`, `dpkg -l` |
| validateOpenedApplication | `tasklist /FI "IMAGENAME eq ..."` | `pgrep -f` | `pgrep -f` |
| validateUrlReachable | `fetch` con timeout | `fetch` con timeout | `fetch` con timeout |
| validateFileExists | `fs.existsSync`, `fs.statSync` | `fs.existsSync`, `fs.statSync` | `fs.existsSync`, `fs.statSync` |

### 5. Política de validación

```typescript
export const DEFAULT_VALIDATION_POLICY: ValidationPolicy = {
  strictMode: true,               // Requiere validación exitosa para continuar
  allowContinueWithWarnings: true,// Permite continuar si hay warnings
  learnOnlyFullyValidated: true,  // Solo aprende si todo validado
  maxRetries: 2,                  // Reintentos por validación
  retryDelayMs: 1000,             // Delay entre reintentos
  validationTimeout: 10000        // Timeout por validación
}
```

### 6. Integración con executor

**executeCompositePlan()** ahora:

1. Ejecuta cada step
2. Si `step.validationRequired`:
   - Llama a `validateWorkflowStep()`
   - Guarda resultado en `step.validationResult`
   - Si `validationCritical` y falla → detiene workflow
3. Trackea `validatedSteps` y `validationFailedSteps`
4. Antes de aprender, verifica con `shouldLearnWorkflow()`

```typescript
if (step.validationRequired) {
  const validationResult = await validateWorkflowStep(
    step.stepId, step.order, step.actionType, step.targetEntity, tenantId
  )

  step.validationResult = {
    ok: validationResult.ok,
    reason: validationResult.reason,
    warnings: validationResult.warnings,
    evidence: validationResult.evidence,
    attempts: validationResult.validationAttempts
  }

  if (step.validationCritical && !validationResult.ok) {
    step.status = 'validation_failed'
    validationStoppedWorkflow = true
    break
  }
}
```

### 7. Learning con validación

```typescript
// Solo aprender si validaciones pasaron
const learnDecision = shouldLearnWorkflow(stepValidationResults, tenantId)

if (!learnDecision.shouldLearn) {
  learnRejectedReason = learnDecision.reason
}
```

Rechaza aprender si:
- Hay validaciones fallidas (en modo estricto)
- Hay warnings críticos
- No todas las validaciones pasaron

### 8. Extensiones a tipos existentes

**CompositeTaskStep:**
```typescript
validationRequired?: boolean
validationType?: string
validationTarget?: string
validationCritical?: boolean
validationResult?: {
  ok: boolean
  reason?: string
  warnings: string[]
  evidence: string[]
  attempts: number
}
```

**CompositeStepStatus:**
```typescript
| 'validation_failed'    // Nuevo status
```

**CompositeExecutionResult:**
```typescript
validatedSteps: string[]
validationFailedSteps: string[]
executionStatus: '...' | 'validation_failed'
learnRejectedReason?: string
```

### 9. Trace stages

Añadidos a **ExecutionTraceStep**:
- `artifact-validation` - Validando artefacto
- `validation-success` - Validación exitosa
- `validation-failed` - Validación fallida

Añadido a **status**:
- `validation_failed`

Añadido a **DebugSnapshot**:
- `validationRan?: boolean`
- `validationPassed?: boolean`
- `validationReason?: string`

Nuevos métodos en **ExecutionTraceBuilder**:
- `validationStart(stepId, validationType)`
- `validationPassed(stepId, evidence?)`
- `validationFailed(stepId, reason)`

### 10. Resultado npm run check

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

### 11. Resultado npm run build

```
> @granclaw/api@0.1.0 build
> tsc
```

**Estado:** ✅ Build exitoso

### 12. Estado PROJECT_MEMORY.md

✅ Actualizado con documentación completa de FEATURE 130.3:
- Arquitectura workflow-validation
- Tipos de validación y mapeo
- Validadores por plataforma
- Política de validación
- Integración con executor
- Learning con validación
- Extensiones a tipos
- Trace stages
- Archivos creados/modificados
- Flujo ejemplo
- Verificaciones

---

## Archivos creados

| Archivo | Líneas | Descripción |
|---------|--------|-------------|
| workflow-validation/types.ts | ~120 | ValidationType, ValidationResult, StepValidation, etc. |
| workflow-validation/validators.ts | ~250 | Validadores multiplataforma |
| workflow-validation/artifact-checks.ts | ~315 | runValidation, canLearnWorkflow, etc. |
| workflow-validation/service.ts | ~310 | validateWorkflowStep, shouldLearnWorkflow |
| workflow-validation/index.ts | ~60 | Exports públicos |

## Archivos modificados

| Archivo | Cambios |
|---------|---------|
| composite-tasks/types.ts | +validation fields en CompositeTaskStep, +validation_failed status |
| composite-tasks/executor.ts | +validación después de cada step, +learning con validación |
| orchestrator/trace.ts | +validation stages, +validation status, +validation methods |

## Casos probados

| Caso | Escenario | Resultado esperado |
|------|-----------|-------------------|
| A | Step exitoso sin validación requerida | Continúa normalmente |
| B | Step exitoso con validación que pasa | validatedSteps +1, continúa |
| C | Step exitoso con validación que falla (no crítica) | validationFailedSteps +1, continúa |
| D | Step exitoso con validación que falla (crítica) | Detiene workflow, status=validation_failed |
| E | Workflow completo, todas validaciones OK | Aprende composite |
| F | Workflow completo, algunas validaciones fallidas | NO aprende, learnRejectedReason set |
| G | Validación con retries | Hasta maxRetries+1 intentos |
