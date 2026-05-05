# FEATURE 073 - Real Execution Trace Report

**Fecha**: 2026-05-03

## 1. Objetivo ejecutado

Implementar trazabilidad REAL de ejecucion para GranClaw. La UI muestra los pasos reales que ocurrieron durante la ejecucion: Hub -> decision -> orchestrator/OpenClaw -> resultado/error.

Principios:
- Prohibido mostrar pasos falsos o simulados
- Si no existe un paso real, no mostrarlo
- Solo trazas reales del backend
- Errores tecnicos traducidos a mensajes humanos

## 2. Archivos modificados

| Archivo | Tipo | Cambio |
|---------|------|--------|
| apps/api/src/modules/orchestrator/trace.ts | Nuevo | ExecutionTraceBuilder, tipos, traduccion errores |
| apps/api/src/modules/orchestrator/routes.ts | Modificado | Instrumentacion Hub/orchestrator |
| apps/web/src/components/control/ExecutionTracePanel.tsx | Nuevo | Panel UI para mostrar trace |
| apps/web/src/components/control/index.ts | Modificado | Export ExecutionTracePanel |
| apps/web/src/pages/control/Execute.tsx | Modificado | Integra ExecutionTracePanel |
| PROJECT_MEMORY.md | Modificado | FEATURE 073 documentada |

## 3. Instrumentacion backend real anadida

### trace.ts - ExecutionTraceBuilder

```typescript
export class ExecutionTraceBuilder {
  hubStart()                    // "Evaluando politicas de la empresa"
  hubAllowed(tenantId?)         // "Accion permitida"
  hubBlocked(reason)            // "Accion bloqueada"
  orchestratorStart()           // "Enviando accion al orquestador"
  orchestratorSuccess()         // "Orquestador completo la ejecucion"
  orchestratorError(errorMsg)   // Traduce error a mensaje humano
  resultSource(source)          // "Respuesta generada por OpenClaw/tool/mock"
  getSteps()                    // Retorna ExecutionTraceStep[]
}
```

### routes.ts - handleOrchestratorRun

```typescript
const trace = new ExecutionTraceBuilder()
trace.hubStart()

// Hub evalua
if (!hubResult.allowed) {
  trace.hubBlocked(hubResult.reason)
  // Respuesta con meta.executionTrace
}

trace.hubAllowed(context.tenant.id)
trace.orchestratorStart()

const result = await runSimpleAgentTask(taskInput)

if (result.success) {
  trace.orchestratorSuccess()
  trace.resultSource(result.source)
} else {
  trace.orchestratorError(result.error)
}

// Respuesta final con meta.executionTrace
```

## 4. Cambios UI aplicados

### ExecutionTracePanel.tsx

- Muestra seccion "Como se ejecuto" con pasos reales
- Iconos segun status:
  - ✔ success (verde)
  - ⛔ blocked (rojo)
  - ❌ error (rojo)
  - ⏳ running (azul)
- Toggle "Ver detalles tecnicos" muestra:
  - Source
  - Hub Decision Log
  - Raw Trace JSON
- Si no hay trace: "No hay trazabilidad disponible para esta ejecucion."

### Execute.tsx

- Extrae `meta.executionTrace` de la respuesta
- Pasa trace, hubDecision y source al ExecutionTracePanel
- Panel se muestra debajo del SecurityResultPanel

## 5. Casos probados

### A) Accion permitida

Trace esperado:
```
✔ Evaluando politicas de la empresa
✔ Accion permitida (Tenant: default)
✔ Enviando accion al orquestador
✔ Orquestador completo la ejecucion
✔ Respuesta generada por OpenClaw
```

### B) Accion bloqueada

Trace esperado:
```
✔ Evaluando politicas de la empresa
⛔ Accion bloqueada (Mensaje con palabra prohibida)
```

NO llama orchestrator - trace termina en Hub.

### C) Error de auth o ejecucion

Trace esperado:
```
✔ Evaluando politicas de la empresa
✔ Accion permitida
✔ Enviando accion al orquestador
❌ Debes iniciar sesion para ejecutar esta accion
```

Errores tecnicos traducidos a mensajes humanos.

## 6. Problemas encontrados

Ninguno. Implementacion directa siguiendo el diseno especificado.

## 7. Pendiente recomendado

1. **Instrumentar tools individuales**: Agregar trace.toolStart(toolId) y trace.toolSuccess(toolId) en el orchestrator service cuando se ejecutan tools.

2. **Instrumentar OpenClaw**: Agregar trace.openclawStart() y trace.openclawSuccess() en runOpenClawTask() para mayor detalle.

3. **Persistir traces**: Guardar traces en auditoria para analisis posterior.

## 8. Estado PROJECT_MEMORY.md

Actualizado con:
- Decision table entry para FEATURE 073
- Seccion completa FEATURE 073 con:
  - Objetivo
  - Principios
  - Tipos creados
  - Archivos modificados
  - Ejemplo de respuesta JSON
  - Tabla de traduccion de errores

## Estructura de respuesta final

```json
{
  "success": true,
  "result": "...",
  "source": "openclaw",
  "meta": {
    "hubDecision": ["Tenant: default", "Hub enabled: true", "Mode: strict", ...],
    "executionTrace": [
      {
        "id": "step-1",
        "timestamp": "2026-05-03T...",
        "stage": "hub",
        "status": "running",
        "label": "Evaluando politicas de la empresa"
      },
      {
        "id": "step-2",
        "stage": "hub",
        "status": "success",
        "label": "Accion permitida",
        "detail": "Tenant: default"
      },
      {
        "id": "step-3",
        "stage": "orchestrator",
        "status": "running",
        "label": "Enviando accion al orquestador"
      },
      {
        "id": "step-4",
        "stage": "orchestrator",
        "status": "success",
        "label": "Orquestador completo la ejecucion"
      },
      {
        "id": "step-5",
        "stage": "result",
        "status": "success",
        "label": "Respuesta generada por OpenClaw",
        "detail": "openclaw"
      }
    ],
    "tenantId": "default"
  }
}
```
