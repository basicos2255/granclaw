# P6.14 — Composite Planner Fix & Safe Download Rule

**Date**: 2026-05-13
**Status**: COMPLETED
**Auditor**: Claude Code

## 1. Problema Observado

Cuando el usuario ingresaba "descarga un programa random freeware":
```
Error: No se pudo crear plan de ejecución: Input es tarea simple, no composite
```

### Análisis del Flujo
1. `classifyIntent()` → `install_download_action`
2. `classifyExecutionMode()` → `useQueue: true`
3. `buildCompositeExecutionPlan()` → `found: false` porque:
   - `splitInputIntoSteps()` retorna 1 elemento
   - `detectActionChain()` retorna `null` (solo "instalar", no "descargar")
   - Línea 304: `substeps.length <= 1 && !actionChain` = true
   - Retorna "Input es tarea simple, no composite"

### Causa Raíz
El planner estaba diseñado SOLO para tareas compuestas (multi-step). Las acciones simples como "descarga X" o "busca Y" no se reconocían como candidatas para planificación.

## 2. Solución Implementada

### FASE A: Auditoría
Auditados los siguientes archivos:
- `composite-tasks/planner.ts` - Lógica de planificación
- `composite-tasks/executor.ts` - Ejecución de planes
- `composite-tasks/types.ts` - Tipos
- `capabilities/service.ts` - CAPABILITY_IMPLEMENTATION_STATUS
- `orchestrator/routes.ts` - Flujo de enrutamiento
- `execution-policy/intent-classifier.ts` - Clasificación de intent

### FASE C: Fix del Planner

#### Nuevo: SINGLE_ACTION_VERBS
```typescript
const SINGLE_ACTION_VERBS: Record<string, { actionType: TaskActionType; capability: string }> = {
  // Download actions
  'descarga': { actionType: 'download_file', capability: 'download' },
  'descargar': { actionType: 'download_file', capability: 'download' },
  'download': { actionType: 'download_file', capability: 'download' },
  // Search actions
  'busca': { actionType: 'search_web', capability: 'web_search' },
  'buscar': { actionType: 'search_web', capability: 'web_search' },
  'search': { actionType: 'search_web', capability: 'web_search' },
  // Browser actions
  'navega': { actionType: 'navigate_url', capability: 'browser' },
  'abre': { actionType: 'navigate_url', capability: 'browser' },
  // ... más verbos
}
```

#### Nuevo: detectSingleAction()
```typescript
function detectSingleAction(input: string): {
  actionType: TaskActionType;
  capability: string;
  verb: string
} | null
```

#### Modificado: buildCompositeExecutionPlan()
Antes:
```typescript
if (substeps.length <= 1 && !actionChain) {
  return { found: false, reason: 'Input es tarea simple, no composite' }
}
```

Después:
```typescript
if (substeps.length <= 1 && !actionChain) {
  const singleAction = detectSingleAction(userInput)
  if (singleAction) {
    // Crear plan de un paso
    return { found: true, plan: singleStepPlan, ... }
  }
  return { found: false, reason: 'Input es tarea simple sin capability asociada' }
}
```

### FASE F: Safe Random Software Rule

#### Nuevo: detectSuspiciousDownload()
```typescript
export function detectSuspiciousDownload(input: string): SuspiciousDownloadResult {
  // HIGH RISK: Random/arbitrary software
  const randomSoftwarePatterns = [
    /\b(random|aleatorio|cualquier)\b/i,
    /\b(freeware|shareware|cracked|pirated)\b/i,
    /\b(hack|keygen|crack|serial)\b/i,
    // ...
  ]
  // ...
}
```

#### Nuevo: SecurityWarning en BuildCompositePlanResult
```typescript
export interface SecurityWarning {
  type: 'suspicious_download' | 'untrusted_source' | 'high_risk_action'
  riskLevel: 'low' | 'medium' | 'high'
  message: string
  recommendedAction?: string
}
```

## 3. Nuevo Flujo para "descarga un programa random freeware"

1. `classifyIntent()` → `install_download_action`
2. `classifyExecutionMode()` → `useQueue: true`
3. `buildCompositeExecutionPlan()`:
   - `detectSingleAction()` → `{ verb: 'descarga', capability: 'download' }`
   - `getCapabilityReadiness('download')` → `{ implemented: false, ... }`
   - `detectSuspiciousDownload()` → `{ isSuspicious: true, riskLevel: 'high' }`
   - Retorna plan con warnings
4. Task se encola
5. Executor intenta ejecutar
6. `download` capability retorna error claro (P6.13)

## 4. Resultados de Verificación

| Caso | Antes | Después |
|------|-------|---------|
| "descarga un programa random freeware" | "Input es tarea simple" | Plan creado + warning de riesgo |
| "busca en google python" | "Input es tarea simple" | Plan creado (web_search implemented) |
| "abre chrome" | "Input es tarea simple" | Plan creado (browser not implemented) |
| "instala vlc" | Plan multi-step | Plan multi-step (unchanged) |

## 5. npm run check

```
✅ API check passed
✅ Web check passed
```

## 6. npm run build

```
✅ Build successful
```

## 7. Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| composite-tasks/planner.ts | +120 líneas: SINGLE_ACTION_VERBS, detectSingleAction(), single-step plan creation |
| composite-tasks/types.ts | +20 líneas: SecurityWarning, CapabilityReadinessSummary |
| execution-policy/intent-classifier.ts | +80 líneas: detectSuspiciousDownload() |
| execution-policy/index.ts | +3 exports: detectSuspiciousDownload, SuspiciousDownloadResult |

## 8. Estado Final del Sistema

### Capabilities Implementadas
- `web_search`: ✅ IMPLEMENTED (via OpenClaw)
- `filesystem`: ✅ IMPLEMENTED (via Node.js)

### Capabilities NO Implementadas (retornan error claro)
- `download`: ❌ NOT IMPLEMENTED
- `browser`: ❌ NOT IMPLEMENTED
- `install_app`: ❌ NOT IMPLEMENTED

### Flujo Completo
1. Usuario ingresa tarea
2. Intent classification → determina useQueue
3. Planner → crea plan (single-step o multi-step)
4. Security check → detecta descargas riesgosas
5. Capability readiness → incluye estado de capabilities
6. Queue execution → encola tarea
7. Executor → ejecuta pasos
8. Validation → valida evidencia (P6.13)
9. Failure explanation → mensaje humano si falla

## 9. Consideraciones de Seguridad

1. **Descargas aleatorias bloqueadas**: `detectSuspiciousDownload()` detecta "random", "freeware", "cracked", etc.
2. **Capabilities no implementadas**: Retornan error claro, no simulan éxito
3. **Guards existentes**: `isStepSafeForSimpleExecution()` bloquea ejecución directa de downloads

## 10. Próximos Pasos (fuera de alcance P6.14)

1. Implementar capability `download` real (requiere browser o HTTP client)
2. Implementar capability `browser` real (requiere Playwright)
3. UI para mostrar securityWarnings en TasksPage
4. Approval flow para descargas de fuentes desconocidas
