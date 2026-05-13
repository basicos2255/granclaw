# P6.11 - Self Audit

**Fecha:** 2026-05-12
**Autor:** Claude
**Estado:** Verificado

---

## Verificaciones Realizadas

### 1. Planner Failure Path (líneas 289-341)

| Verificación | Estado |
|--------------|--------|
| Planner failure retorna inmediatamente | ✅ PASS |
| NO cae a runSimpleAgentTask | ✅ PASS |
| Task marcada como 'error' | ✅ PASS |
| Respuesta incluye `plannerFailed: true` | ✅ PASS |
| Source es 'validation' (tipo válido) | ✅ PASS |

### 2. Queue Failure Path (líneas 436-490)

| Verificación | Estado |
|--------------|--------|
| Queue failure retorna inmediatamente | ✅ PASS |
| NO cae a runSimpleAgentTask | ✅ PASS |
| Task marcada como 'error' | ✅ PASS |
| Respuesta incluye `queueFailed: true` | ✅ PASS |
| Source es 'queue' (tipo válido) | ✅ PASS |

### 3. Fallback Protection (líneas 1213-1254)

| Verificación | Estado |
|--------------|--------|
| Multistep tasks bloqueadas en fallback | ✅ PASS |
| Check de `executionMode.useQueue` antes de runSimpleAgentTask | ✅ PASS |
| Respuesta incluye `routingError: true` | ✅ PASS |

### 4. Build & Check

| Verificación | Estado |
|--------------|--------|
| npm run check (api) | ✅ PASS |
| npm run build (api) | ✅ PASS |

---

## Patrones Buscados

### runSimpleAgentTask calls

```bash
grep -n "runSimpleAgentTask" routes.ts
```

**Resultado:**
- Línea 18: import
- Línea 291: comentario (P6.11 fix)
- Línea 438: comentario (P6.11 fix)
- Línea 703: OpenClaw provider (protected by early returns)
- Línea 1270: Fallback (protected by useQueue check)

Todas las llamadas están protegidas ✅

### Fallback sin return

```bash
grep -B5 "falling back" routes.ts
```

**Resultado:** Ningún "falling back" sin return encontrado ✅

---

## Flujo Corregido

```
ANTES (P6.9):
1. Planner fails → "falling back to direct execution" (NO RETURN)
2. Queue fails → "falling back to direct execution" (NO RETURN)
3. Code continues to line 703 → runSimpleAgentTask()
4. Guard blocks → Error: "Multistep tasks must use queue..."
5. UI shows technical error message

DESPUÉS (P6.11):
1. Planner fails → completeTask('error') + return with plannerFailed
2. Queue fails → completeTask('error') + return with queueFailed
3. Fallback reached with useQueue=true → completeTask('error') + return with routingError
4. Guard NEVER reached for multistep tasks
5. UI shows user-friendly error messages
```

---

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `orchestrator/routes.ts` | +85 líneas: P6.11 protection |

---

## Mensajes de Error Mejorados

| Escenario | Antes | Después |
|-----------|-------|---------|
| Planner fails | "Multistep tasks must use queue/workflow system..." | "No se pudo planificar la tarea: {reason}" |
| Queue fails | "Multistep tasks must use queue/workflow system..." | "No se pudo encolar la tarea multistep para ejecución" |
| Routing error | "Multistep tasks must use queue/workflow system..." | "No se pudo procesar la tarea multistep. Por favor, intente de nuevo." |

---

## Conclusión

El sistema ahora previene que tareas multistep lleguen al guard:

1. **Planner failure**: Retorna con `plannerFailed: true`
2. **Queue failure**: Retorna con `queueFailed: true`
3. **Fallback protection**: Retorna con `routingError: true`

El guard de P6.9 ya no debería activarse para casos normales - solo como última línea de defensa para paths no anticipados.
