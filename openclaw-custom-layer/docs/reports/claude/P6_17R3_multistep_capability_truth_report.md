# P6.17R3 — Multistep Target Extraction, Capability Gate Real y Execution Truth Correcto

**Fecha**: 2026-05-16
**Estado**: COMPLETADO

## Root Causes Confirmados en Auditoría

### 1. ACTION_CHAINS Orden Incorrecto (CRÍTICO)

**Archivo**: `apps/api/src/modules/composite-tasks/planner.ts:53-62`

```typescript
const ACTION_CHAINS: Record<string, TaskActionType[]> = {
  'instalar': ['download_file', 'install_app'],        // ← ANTES (más corto)
  'install': ['download_file', 'install_app'],
  'descargar e instalar': ['download_file', 'install_app'],  // ← DESPUÉS (más largo)
  ...
}
```

**Problema**: `detectActionChain()` usa `Object.entries()` que itera en orden de inserción. El patrón `'instalar'` está ANTES de `'descargar e instalar'`, y `lower.includes(pattern)` encuentra primero el patrón corto.

**Input**: "Descargar e instalar VLC"
**Resultado actual**: Detecta `'instalar'` chain porque includes() matchea primero
**Resultado esperado**: Detecta `'descargar e instalar'` chain (longest match)

### 2. extractTargetEntity Bug (CRÍTICO)

**Archivo**: `apps/api/src/modules/task-memory/service.ts:310-344`

```typescript
function extractTargetEntity(input: string, actionType: TaskActionType): string | undefined {
  let target = lower.replace(/^...descargar...\s+/i, '')  // Remueve "Descargar "
  // Queda: "e instalar VLC"
  const firstWord = target.split(/\s+/)[0]  // Devuelve 'e'
  return firstWord
}
```

**Input**: "Descargar e instalar VLC"
**Resultado actual**: `targetEntity = 'e'`
**Resultado esperado**: `targetEntity = 'vlc'`

### 3. getCapabilityReadiness Argumentos Invertidos (CRÍTICO)

**Archivo**: `apps/api/src/modules/composite-tasks/planner.ts:602`

```typescript
// ACTUAL (INCORRECTO):
const readiness = getCapabilityReadiness(step.capabilityKey, tenantId)

// CORRECTO:
const readiness = getCapabilityReadiness(tenantId, capabilityType)
```

**Firma correcta** (capabilities/service.ts:400):
```typescript
export function getCapabilityReadiness(tenantId: string, capabilityType: string): CapabilityReadiness
```

### 4. Falta Mapping actionType -> Capability Base

**Problema**: Los steps generados por ACTION_CHAIN usan `capabilityKey = "download_file_vlc"` (compuesto) pero el check de readiness necesita la capability base `"download"`.

**Archivo**: `planner.ts:258-260`
```typescript
const capabilityKey = normalized.targetEntity
  ? normalizeCapabilityKey(`${normalized.actionType}_${normalized.targetEntity}`)  // "download_file_vlc"
  : undefined
```

**Solución requerida**: Crear mapping explícito:
- `download_file` → `download`
- `install_app` → `install_app`
- `search_web` → `web_search`
- `navigate_url` → `browser`
- `open_app` → `filesystem`

### 5. determineFailureCode No Mapea Capability Blocked

**Archivo**: `apps/api/src/modules/tasks/service.ts:70-105`

```typescript
function determineFailureCode(missingEvidence: string[], warnings: string[]): ValidationFailureReason {
  // NO tiene patrones para:
  // - "Capacidades requeridas no disponibles"
  // - "capability not available"
  // - "not implemented"
  // - "no está implementada"

  return 'unknown'  // ← SIEMPRE CAE AQUÍ para capability blocked
}
```

### 6. Task Queued con Job Dead (Menor prioridad)

El job puede terminar como 'dead' pero la task queda como 'queued' si no hay reconciliación activa.

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `apps/api/src/modules/composite-tasks/planner.ts` | Fix ACTION_CHAINS orden, fix extractTarget para compound, fix getCapabilityReadiness args, add actionType->capability mapping |
| `apps/api/src/modules/task-memory/service.ts` | Fix extractTargetEntity para compound inputs |
| `apps/api/src/modules/tasks/service.ts` | Fix determineFailureCode para capability blocked |
| `apps/api/src/modules/runtime-queue/task-reconciliation.ts` | Ensure createFailureExplanation handles capability blocked correctly |

---

## Casos de Test Obligatorios

1. **Simple**: "dime hola" → success/mock allowed
2. **Direct URL download**: "descarga https://example.com/file.txt" → blocked si download no disponible
3. **Multistep VLC**: "Descargar e instalar VLC" → blocked, targetEntity=vlc, NO queued
4. **Download ambiguo**: "descarga un programa random freeware" → NO success
5. **Retry lifecycle**: Jobs retrying deben progresar correctamente
6. **WS task events**: Canal 'tasks' funcional

---

## Progreso de Fixes

- [x] FASE B: Fix Target Extraction y Action Chain
  - Reordenado ACTION_CHAINS con longest-first
  - Añadido `getActionChainsSortedByLength()` helper
  - Añadido `INVALID_TARGET_CONNECTORS` array
  - Reescrito `extractTargetFromInput()` para compound inputs
- [x] FASE C: Fix ActionType -> Capability Base mapping
  - Creado `ACTION_TYPE_TO_CAPABILITY` mapping
  - Añadido `getRequiredCapabilityForAction()` helper
- [x] FASE D: Fix Multistep Capability Gate
  - Capability gate ahora verifica ALL steps, no solo los con capabilityKey
- [x] FASE E: Fix getCapabilityReadiness argument order
  - Corregido: `getCapabilityReadiness(tenantId, requiredCapability)`
- [x] FASE F: Fix Failure Explanation para capability blocked
  - `determineFailureCode()` ahora detecta patrones de capability blocked
  - `createFailureExplanation()` distingue entre not_implemented y not_configured
- [x] FASE G: Fix /tasks/:id/truth para blocked y dead jobs
  - Añadido `blockingCapabilities` y `capabilityGate` a truth response
  - Añadido listener para `job:dead-lettered` en task-reconciliation
  - Añadido handler `onJobDeadLettered` para reconciliar dead jobs
  - Añadido `executionStatus: 'dead'` a types
- [x] FASE H: E2E Harness obligatorio
  - Añadido test `testMultistepTargetExtraction()`
  - Añadido test `testDirectUrlDownloadBlock()`
  - Añadidos a `criticalTests` en validación
- [x] FASE I: UI Check - Web check passes
- [x] FASE J: Verificación Final - API build + Web check pass
- [x] FASE K: Documentación

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `apps/api/src/modules/composite-tasks/planner.ts` | ACTION_CHAINS reorder, extractTargetFromInput, ACTION_TYPE_TO_CAPABILITY, capability gate fix |
| `apps/api/src/modules/tasks/service.ts` | determineFailureCode patterns for capability blocked |
| `apps/api/src/modules/tasks/types.ts` | Added 'view_roadmap' to RecoveryActionType, 'dead' to executionStatus |
| `apps/api/src/modules/tasks/routes.ts` | Added blockingCapabilities and capabilityGate to truth response |
| `apps/api/src/modules/runtime-queue/task-reconciliation.ts` | Added job:dead-lettered listener, onJobDeadLettered handler, dead status handling |
| `apps/api/src/modules/testing/e2e/p6-17-harness.ts` | P6.17R3 tests for target extraction and URL download blocking |
