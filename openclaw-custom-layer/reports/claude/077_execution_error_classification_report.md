# REPORTE CLAUDE - FIX 077

## Execution Error Classification & Debug Guarantee

---

## 1. Objetivo ejecutado

Corregir la clasificación de estados en la UI para diferenciar correctamente entre:
- BLOQUEADO (Hub denegó)
- ERROR (problema técnico)
- SIN CONFIRMAR (permitido pero no confirmado)
- PERMITIDO (éxito confirmado)

Además, garantizar que meta/debugSnapshot estén disponibles incluso en errores.

---

## 2. Problema detectado

La UI mostraba "BLOQUEADO" con "Ha ocurrido un error" incluso para tareas simples donde no hubo bloqueo del Hub, sino un error técnico o falta de confirmación.

**Causas raíz identificadas**:

1. **api.run() descartaba meta en errores**:
   ```typescript
   // ANTES - perdía wrapped.data si había error
   if (!wrapped.success || wrapped.error) {
     return { success: false, error: wrapped.error }  // ← Sin meta!
   }
   ```

2. **Backend sin try/catch**:
   - Excepciones no devolvían meta
   - No había forma de depurar errores inesperados

3. **UI solo tenía 2 estados**:
   - `allowed: true` → PERMITIDO
   - `allowed: false` → BLOQUEADO (incorrecto para errores)

4. **Sin logs al inicio del flujo**:
   - No había forma de correlacionar requests en la consola

---

## 3. Archivos modificados

### Backend:
- `apps/api/src/modules/orchestrator/routes.ts`

### Frontend:
- `apps/web/src/services/api.ts`
- `apps/web/src/components/control/SecurityResultPanel.tsx`
- `apps/web/src/components/control/index.ts`
- `apps/web/src/pages/control/Execute.tsx`

---

## 4. Cambios aplicados

### 4.1 Backend - Try/Catch con meta garantizado

```typescript
// FIX 077: Log al inicio del flujo
console.log(`[GranClaw] Starting request ${trace.requestId} for tenant ${context.tenant.id}`)

// FIX 077: Try/catch para garantizar meta en todas las respuestas
try {
  // ... flujo normal (Hub, orchestrator, etc.) ...
} catch (err) {
  const errorMessage = err instanceof Error ? err.message : 'Error interno del servidor'
  trace.orchestratorError(errorMessage)
  const debugSnapshot = trace.getDebugSnapshot()
  logDebug(debugSnapshot)

  console.error(`[GranClaw] Exception in request ${trace.requestId}:`, err)

  ok(res, {
    success: false,
    error: errorMessage,
    meta: {
      requestId: trace.requestId,
      executionTrace: trace.getSteps(),
      executionDurationMs: trace.getTotalDurationMs(),
      tenantId: context.tenant.id,
      source: 'error',
      debugSnapshot
    }
  })
}
```

### 4.2 Frontend - api.run() preserva meta

```typescript
run: async (message, sessionId?, agentId?): Promise<OrchestratorPayload> => {
  const wrapped = await postRequest<OrchestratorWrappedResponse>(...)

  // FIX 077: Si data existe, devolverla SIEMPRE (incluso si wrapper indica error)
  if (wrapped.data) {
    // Añadir error del wrapper si data no lo tiene
    if (wrapped.error && !wrapped.data.error) {
      wrapped.data.error = wrapped.error
    }
    // Reflejar success=false si wrapper lo indica
    if (!wrapped.success && wrapped.data.success !== false) {
      wrapped.data.success = false
    }
    return wrapped.data  // ← Meta preservado
  }

  // Solo si data es null/undefined
  return {
    success: false,
    error: wrapped.error || 'No se recibio respuesta del servidor'
  }
}
```

### 4.3 Frontend - SecurityResultPanel con 4 estados

```typescript
// Nuevo tipo exportado
export type ResultStatus = 'allowed' | 'blocked' | 'error' | 'unconfirmed'

// Colores por estado
const getColors = () => {
  switch (effectiveStatus) {
    case 'allowed':
      return { main: '#059669', bg: '#ecfdf5', dark: '#064e3b' }  // Verde
    case 'blocked':
      return { main: '#dc2626', bg: '#fef2f2', dark: '#7f1d1d' }  // Rojo
    case 'error':
      return { main: '#6b7280', bg: '#f9fafb', dark: '#374151' }  // Gris
    case 'unconfirmed':
      return { main: '#d97706', bg: '#fffbeb', dark: '#78350f' }  // Naranja
  }
}

// Textos por estado
const getTexts = () => {
  switch (effectiveStatus) {
    case 'allowed':
      return { icon: '✓', title: 'PERMITIDO', message: 'La empresa PERMITE esta acción' }
    case 'blocked':
      return { icon: '✕', title: 'BLOQUEADO', message: 'La empresa BLOQUEA esta acción' }
    case 'error':
      return { icon: '⚠', title: 'ERROR', message: 'Ocurrió un error durante la ejecución' }
    case 'unconfirmed':
      return { icon: '?', title: 'SIN CONFIRMAR', message: 'Permitido, pero la ejecución no pudo confirmarse' }
  }
}
```

### 4.4 Frontend - Execute.tsx determina status

```typescript
// FIX 077: Determinar status correcto
let resultStatus: ResultStatus
if (!allowed) {
  // Diferenciar si fue bloqueado por Hub o error técnico
  const hubBlocked = debugSnapshot?.hubAllowed === false || reason?.includes('Hub') || reason?.includes('Blocked')
  resultStatus = hubBlocked ? 'blocked' : 'error'
} else if (!executionConfirmed) {
  resultStatus = 'unconfirmed'
} else {
  resultStatus = 'allowed'
}

// Pasar a SecurityResultPanel
<SecurityResultPanel
  allowed={result.allowed}
  result={result.result}
  reason={result.reason}
  decisionLog={result.decisionLog}
  status={result.status}  // ← FIX 077
/>
```

---

## 5. Pruebas realizadas

- ✅ Build pasa correctamente (`npm run build`)
- ✅ Tipos TypeScript correctos
- ✅ Retrocompatibilidad (status es opcional)

---

## 6. Resultado esperado

| Escenario | Antes | Después |
|-----------|-------|---------|
| Hub bloquea | BLOQUEADO | BLOQUEADO (rojo) |
| Error técnico | BLOQUEADO | ERROR (gris) |
| Permitido sin confirmar | PERMITIDO | SIN CONFIRMAR (naranja) |
| Permitido confirmado | PERMITIDO | PERMITIDO (verde) |
| Excepción JS/backend | Sin meta | Meta disponible para debug |

---

## 7. Estados de la UI

| Estado | Icono | Color | Significado |
|--------|-------|-------|-------------|
| PERMITIDO | ✓ | Verde | Hub permitió, ejecución confirmada |
| BLOQUEADO | ✕ | Rojo | Hub denegó por políticas |
| ERROR | ⚠ | Gris | Error técnico (conexión, excepción) |
| SIN CONFIRMAR | ? | Naranja | Hub permitió, pero no se pudo confirmar ejecución |

---

## 8. Estado PROJECT_MEMORY.md

✅ Actualizado con sección:
- `## FIX 077 - Execution Error Classification & Debug Guarantee`
- Problema documentado
- Solución backend documentada
- Solución frontend documentada
- Estados de UI documentados
- Archivos modificados listados

---

**Fecha**: 2026-05-03
**Implementado por**: Claude (Opus 4.5)
**Estado**: ✅ COMPLETADO
