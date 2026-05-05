# FIX 124 - Final Execution Status Resolution

**Fecha**: 2026-05-05
**Estado**: Completado
**Autor**: Claude

## 1. Objetivo Ejecutado

Separar correctamente la decisión del Hub (allowed/blocked) del estado real de ejecución (executed, setup_required, failed, etc.) para que la UI muestre el estado correcto al usuario.

## 2. Problema Inicial

La UI mostraba "PERMITIDO" cuando en realidad:
- OpenClaw no ejecutó la acción
- `executionConfirmed = false`
- `requiresReauth = true`
- El resultado fue `setup_required` / `reauthorization_required` / `incomplete`

Ejemplo incorrecto:
```
Usuario: "abrir calculadora"
UI muestra: ✓ PERMITIDO
Realidad: OpenClaw requiere pairing, acción no ejecutada
```

## 3. Causa Raíz

No existía separación clara entre:
1. **HubDecision**: Si la política permite la acción
2. **ExecutionStatus**: Qué pasó durante la ejecución
3. **FinalUiStatus**: Qué mostrar al usuario

La UI usaba solo `allowed` para determinar el estado visual, ignorando condiciones como `requiresReauth` o `executionConfirmed === false`.

## 4. Archivos Creados

| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| apps/api/src/modules/execution-status/types.ts | ~85 | Tipos: HubDecisionStatus, ExecutionStatus, FinalUiStatus, ResolvedExecutionStatus |
| apps/api/src/modules/execution-status/status-resolver.ts | ~200 | Función resolveFinalExecutionStatus() con lógica de prioridad |
| apps/api/src/modules/execution-status/index.ts | ~5 | Exports del módulo |

## 5. Status Resolver Implementado

### Tipos

```typescript
type HubDecisionStatus = 'allowed' | 'blocked'

type ExecutionStatus =
  | 'not_started'
  | 'executed'
  | 'pending_confirmation'
  | 'setup_required'
  | 'reauthorization_required'
  | 'failed'
  | 'partial'
  | 'skipped'

type FinalUiStatus =
  | 'allowed'
  | 'executed'
  | 'pending_confirmation'
  | 'setup_required'
  | 'reauthorization_required'
  | 'failed'
  | 'partial'
  | 'blocked'

interface ResolvedExecutionStatus {
  hubDecision: HubDecisionStatus
  executionStatus: ExecutionStatus
  finalUiStatus: FinalUiStatus
  executionConfirmed: boolean
  isSuccess: boolean
  severity: 'success' | 'warning' | 'error' | 'info'
  title: string
  message: string
  reason: string
}
```

### Prioridad de Resolución

```typescript
// Orden de prioridad (mayor a menor):
1. Hub blocked → blocked (error)
2. Pending confirmation → pending_confirmation (warning)
3. Requires setup → setup_required (warning)
4. Requires reauth → reauthorization_required (warning)
5. Execution failed → failed (error)
6. Execution confirmed → executed (success)
7. Hub allowed (no execution) → allowed (success)
8. Partial → partial (warning)
```

## 6. Cambios Backend

### orchestrator/routes.ts

Añadido import:
```typescript
import { resolveFinalExecutionStatus, type ResolvedExecutionStatus } from '../execution-status'
```

Añadido `statusResolution` a respuestas (6 lugares):
1. Respuesta normal exitosa (fallback)
2. Error en catch block
3. Setup required (non-streaming)
4. Setup required (streaming)
5. Streaming fallback success
6. Streaming error catch

Ejemplo:
```typescript
const statusResolution = resolveFinalExecutionStatus({
  hubAllowed: hubResult.allowed,
  hubBlocked: !hubResult.allowed,
  hubReason: hubResult.decisionLog?.join(', '),
  result,
  error: result.error,
  meta: {
    executionConfirmed: debugSnapshot.executionConfirmed,
    source
  },
  debugSnapshot
})

ok(res, {
  ...result,
  statusResolution,  // <-- NUEVO
  meta: { ... }
})
```

## 7. Cambios Frontend

### SecurityResultPanel.tsx

1. Nuevo tipo `StatusResolution`:
```typescript
export interface StatusResolution {
  hubDecision: 'allowed' | 'blocked'
  executionStatus: string
  finalUiStatus: 'allowed' | 'executed' | 'pending_confirmation' | 'setup_required' | 'reauthorization_required' | 'failed' | 'partial' | 'blocked'
  executionConfirmed: boolean
  isSuccess: boolean
  severity: 'success' | 'warning' | 'error' | 'info'
  title: string
  message: string
  reason: string
}
```

2. Nueva prop `statusResolution`:
```typescript
interface SecurityResultPanelProps {
  // ... existing props
  statusResolution?: StatusResolution
}
```

3. Determinación de status actualizada:
```typescript
// statusResolution.finalUiStatus takes precedence
const effectiveStatus: ResultStatus = statusResolution?.finalUiStatus || status || (allowed ? 'allowed' : 'blocked')
```

4. Textos dinámicos:
```typescript
const getTexts = () => {
  // Si statusResolution existe, usar su title/message
  if (statusResolution) {
    return {
      icon: iconMap[statusResolution.finalUiStatus],
      title: statusResolution.title,
      message: statusResolution.message
    }
  }
  // ... fallback a switch/case
}
```

5. Nueva sección para `setup_required`:
```tsx
{effectiveStatus === 'setup_required' && (
  <div style={...}>
    <span>🔧 Se requiere configuración adicional</span>
    <a href="/control/setup">🔧 Ir a Configuración →</a>
  </div>
)}
```

### Execute.tsx

1. Import StatusResolution:
```typescript
import { ..., type StatusResolution } from '../../components/control'
```

2. Añadido a ExecutionResult:
```typescript
interface ExecutionResult {
  // ... existing fields
  statusResolution?: StatusResolution
}
```

3. Extracción de respuesta:
```typescript
const statusResolution = (response as unknown as { statusResolution?: StatusResolution }).statusResolution
```

4. Pasado a SecurityResultPanel:
```tsx
<SecurityResultPanel
  // ... existing props
  statusResolution={result.statusResolution}
/>
```

## 8. Mapeo Visual

| finalUiStatus | Color | Icono | Título |
|---------------|-------|-------|--------|
| executed | verde | ✓ | EJECUTADO |
| allowed | verde | ✓ | PERMITIDO |
| pending_confirmation | amarillo | ⚠️ | CONFIRMACIÓN REQUERIDA |
| setup_required | rosa | 🔧 | CONFIGURACIÓN REQUERIDA |
| reauthorization_required | rosa | 🔐 | REAUTORIZACIÓN REQUERIDA |
| failed | gris | ✕ | ERROR DE EJECUCIÓN |
| partial | naranja | ⚠ | EJECUCIÓN PARCIAL |
| blocked | rojo | ✕ | BLOQUEADO |

## 9. Casos Probados

| Caso | Hub | Execution | UI Anterior | UI Nueva |
|------|-----|-----------|-------------|----------|
| Hub bloquea | blocked | skipped | BLOQUEADO | BLOQUEADO |
| Hub permite + ejecutado | allowed | executed | PERMITIDO | EJECUTADO |
| Hub permite + pairing required | allowed | setup_required | PERMITIDO ❌ | CONFIGURACIÓN REQUERIDA ✓ |
| Hub permite + reauth required | allowed | reauthorization_required | PERMITIDO ❌ | REAUTORIZACIÓN REQUERIDA ✓ |
| Hub permite + error | allowed | failed | ERROR | ERROR DE EJECUCIÓN |
| Confirmación pendiente | allowed | pending_confirmation | - | CONFIRMACIÓN REQUERIDA |

## 10. Riesgos y Pendientes

### Completado
- ✅ Módulo execution-status
- ✅ Integración en orchestrator
- ✅ SecurityResultPanel actualizado
- ✅ Execute.tsx actualizado

### Pendiente (fuera de scope FIX 124)
- Historial de tareas (/control/historial) debería guardar finalUiStatus
- StatusBar debería mostrar statusResolution
- DebugPanel debería incluir statusResolution

## 11. Estado PROJECT_MEMORY.md

✅ Actualizado con entrada FIX 124:
- Problema documentado
- Principio de separación Hub/Execution/UI
- Prioridad de resolución
- Archivos creados/modificados
- Verificaciones completadas
