# REPORTE CLAUDE - FIX 076

## Frontend API Wrapper Unwrap for Execution Meta

---

## 1. Objetivo ejecutado

Corregir el bug crítico que impedía que la UI recibiera `meta.executionTrace`, `debugSnapshot` y `source` reales, aunque el backend los estuviera generando correctamente.

---

## 2. Bug detectado

El backend usa `ok(res, data)` que envuelve todas las respuestas:

```json
{
  "success": true,
  "data": {
    "success": true,
    "result": "...",
    "source": "openclaw",
    "meta": {
      "requestId": "req-xyz",
      "executionTrace": [...],
      "debugSnapshot": {...}
    }
  },
  "error": null
}
```

Pero `api.run()` devolvía el wrapper completo, y Execute.tsx leía:
- `response.meta` → `undefined` (debía ser `response.data.meta`)
- `response.source` → `undefined`
- `response.result` → `undefined`

**Consecuencias**:
- executionTrace nunca llegaba a la UI
- debugSnapshot nunca llegaba a la UI
- source siempre quedaba "unknown"
- Aparecía "No hay trazabilidad disponible" aunque el backend la enviaba
- Podía mostrar "Acción ejecutada correctamente" sin leer meta real

---

## 3. Archivos modificados

- `apps/web/src/services/api.ts`

---

## 4. Cambios aplicados

### Nuevos tipos en api.ts:

```typescript
interface AdapterStatus {
  openclawConfigured: boolean
  restConfigured: boolean
  wsConfigured: boolean
}

interface ExecutionTraceStep {
  id: string
  requestId?: string
  timestamp: string
  stage: string
  status: string
  label: string
  detail?: string
  durationMs?: number
}

interface DebugSnapshot {
  requestId: string
  timestamp: string
  route: string
  // ... todos los campos
  executionConfirmed: boolean
  tracePresent: boolean
  error?: string
}

interface OrchestratorMeta {
  requestId?: string
  hubDecision?: string[]
  executionTrace?: ExecutionTraceStep[]
  executionDurationMs?: number
  tenantId?: string
  source?: string
  adapterStatus?: AdapterStatus
  debugSnapshot?: DebugSnapshot
}

export interface OrchestratorPayload {
  success: boolean
  result?: unknown
  source?: string
  error?: string
  reason?: string
  warning?: string
  message?: string
  meta?: OrchestratorMeta
  // ...
}

interface OrchestratorWrappedResponse {
  success: boolean
  data: OrchestratorPayload | null
  error: string | null
}
```

### api.run() corregido:

```typescript
run: async (message: string, sessionId?: string, agentId?: string): Promise<OrchestratorPayload> => {
  if (!isAuthenticated()) {
    return { success: false, error: 'Debes iniciar sesion' }
  }
  const wrapped = await postRequest<OrchestratorWrappedResponse>('/orchestrator/run', { message, sessionId, agentId })

  // Si el wrapper indica error
  if (!wrapped.success || wrapped.error) {
    return { success: false, error: wrapped.error || 'Error desconocido' }
  }

  // Si data es null
  if (!wrapped.data) {
    return { success: false, error: 'No se recibio respuesta del servidor' }
  }

  // Devolver payload real (NO el wrapper)
  return wrapped.data
}
```

---

## 5. Pruebas realizadas

- ✅ Build pasa correctamente (`npm run build`)
- ✅ Tipos correctos (TypeScript sin errores)
- ✅ Otros endpoints no afectados (login, register, getHubConfig usan response.data)

---

## 6. Resultado esperado

**Antes**:
- `response.meta` → `undefined`
- `response.source` → `undefined`
- UI muestra "No hay trazabilidad disponible"
- UI muestra "Acción ejecutada correctamente" sin verificar

**Después**:
- `response.meta` → `{ requestId, executionTrace, debugSnapshot, ... }`
- `response.source` → `"openclaw"`, `"tool"`, `"mock"`, etc.
- StatusBar muestra trace real con duración
- DebugPanel muestra debugSnapshot completo
- ExecutionTracePanel muestra pasos reales
- No aparece "No hay trazabilidad" si backend la envió

---

## 7. Pendiente recomendado

1. **Test E2E**: Verificar flujo completo con diferentes escenarios
2. **Revisar otros endpoints**: Si algún otro endpoint tiene el mismo problema
3. **Logging frontend**: Añadir console.log condicional para debug en desarrollo

---

## 8. Estado PROJECT_MEMORY.md

✅ Actualizado con sección:
- `## FIX 076 - Frontend API Wrapper Unwrap for Execution Meta`
- Problema documentado
- Solución documentada
- Código de ejemplo incluido

---

**Fecha**: 2026-05-03
**Implementado por**: Claude (Opus 4.5)
**Estado**: ✅ COMPLETADO
