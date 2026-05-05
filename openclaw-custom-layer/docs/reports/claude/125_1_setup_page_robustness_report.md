# REPORTE CLAUDE - FIX 125.1

## 1. Objetivo ejecutado

Corregir crash de /control/setup y endurecer el flujo de setup/repair para casos con datos incompletos o requirements antiguos.

## 2. Error observado en consola

```
Uncaught TypeError: Cannot read properties of undefined (reading 'substring')
at Setup.tsx:576
```

La página quedaba completamente en blanco al intentar acceder desde "Ir a Configuración".

## 3. Causa raíz

Múltiples llamadas inseguras a `.substring()` y otros métodos sobre valores potencialmente undefined:

| Línea | Código | Problema |
|-------|--------|----------|
| 576 | `pendingAction.input.substring(0, 100)` | input puede ser undefined |
| 428 | `repairSession.originalInput.substring(0, 80)` | originalInput puede ser undefined |
| 196 | `response.data.input.substring(0, 50)` | input puede ser undefined |
| 551 | `new Date(req.createdAt).toLocaleString()` | createdAt puede ser undefined |
| 417 | `formatScopeKey(repairSession.scopeKey)` | scopeKey puede ser undefined |

Además, datos legacy en JSON sin campos obligatorios:
- Requirements sin id, scopeKey, o createdAt
- Repair sessions con originalInput vacío

## 4. Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/web/src/pages/control/Setup.tsx | +helpers seguros, +normalización, +os:install message, +error handling |
| apps/api/src/modules/system-state/service.ts | +safeSubstring, +normalizeRequirement, +migración datos legacy |
| apps/api/src/modules/openclaw-repair/service.ts | +normalizeRepairSession, +migración datos legacy |

## 5. Helpers seguros añadidos

### Frontend (Setup.tsx)

```typescript
function safeText(value: string | undefined | null, fallback = 'N/D'): string {
  return value && typeof value === 'string' ? value : fallback
}

function shortId(value: string | undefined | null, fallback = 'sin-id'): string {
  if (!value || typeof value !== 'string') return fallback
  return value.length > 10 ? value.substring(0, 10) + '…' : value
}

function safeSubstring(value: string | undefined | null, maxLen: number, fallback = ''): string {
  if (!value || typeof value !== 'string') return fallback
  if (value.length <= maxLen) return value
  return value.substring(0, maxLen) + '...'
}

function safeDate(value: string | number | undefined | null): string {
  if (!value) return 'Fecha no disponible'
  try {
    const date = new Date(value)
    if (isNaN(date.getTime())) return 'Fecha inválida'
    return date.toLocaleString()
  } catch {
    return 'Fecha inválida'
  }
}
```

### Backend (system-state/service.ts, openclaw-repair/service.ts)

```typescript
function safeSubstring(value: string | undefined | null, maxLen: number): string {
  if (!value || typeof value !== 'string') return ''
  if (value.length <= maxLen) return value
  return value.substring(0, maxLen) + '...'
}

function normalizeRequirement(req: Partial<OpenClawSetupRequirement>, index: number): OpenClawSetupRequirement {
  return {
    id: req.id ?? `legacy-req-${index}-${Date.now()}`,
    scopeKey: (req.scopeKey ?? 'openclaw:unknown_scope') as OpenClawScopeKey,
    // ... resto de campos con defaults
  }
}

function normalizeRepairSession(session: Partial<RepairSession>, index: number): RepairSession {
  return {
    id: session.id ?? `legacy-session-${index}-${Date.now()}`,
    scopeKey: (session.scopeKey ?? 'openclaw:unknown_scope') as OpenClawScopeKey,
    originalInput: session.originalInput ?? '',
    // ... resto de campos con defaults
  }
}
```

## 6. Normalización frontend/backend

### Frontend

- `normalizeRequirement(raw, index)`: Se aplica a todos los requirements antes de render
- `normalizeRepairSession(session)`: Se aplica al cargar repair session

### Backend

- `loadState()` en system-state: Normaliza requirements al cargar JSON
- `loadSessions()` en openclaw-repair: Normaliza sessions al cargar JSON
- Migración automática: datos legacy se completan con defaults

## 7. Estados vacíos/error en setup

### Estados manejados

| Estado | Comportamiento |
|--------|----------------|
| Cargando | "Cargando estado del sistema..." |
| Sin requirements | Muestra card de configuración normal |
| Con requirements | Lista requirements normalizados |
| Repair session no encontrada | `setError("Sesión de reparación no encontrada: ...")` |
| Error de conexión | `setError("Error al cargar la sesión de reparación")` |

### os:install explicación

Cuando `scopeKey === 'os:install'`:

```
"OpenClaw necesita autorización para instalar o modificar aplicaciones.
Aunque otra instalación haya funcionado, esta acción puede requerir
permisos adicionales o una nueva aprobación del nodo."
```

## 8. Casos probados

| Caso | Resultado |
|------|-----------|
| /control/setup sin repairSessionId | ✅ No crash, muestra requirements o "sin setup pendiente" |
| /control/setup?repairSessionId=invalid | ✅ No crash, muestra "sesión no encontrada" |
| Requirement sin scopeKey en JSON | ✅ No crash, muestra "Permiso desconocido" |
| Requirement os:install | ✅ Muestra mensaje explicativo amarillo |
| Pulsar "Ir a Configuración" | ✅ Navega y renderiza correctamente |
| pendingAction con input undefined | ✅ Muestra "Acción no especificada" |

## 9. Resultado npm run check

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

## 10. Resultado npm run build

```
> @granclaw/api@0.1.0 build
> tsc

> @granclaw/web@0.1.0 build
> tsc && vite build

✓ 67 modules transformed.
dist/index.html                   0.70 kB │ gzip:  0.42 kB
dist/assets/index-CzV1vD1E.js   281.64 kB │ gzip: 76.13 kB
✓ built in 2.06s
```

**Build exitoso.**

## 11. Estado PROJECT_MEMORY.md

✅ Actualizado con entrada FIX 125.1:
- Problema documentado (crash por substring en undefined)
- Helpers seguros documentados
- Normalización frontend/backend documentada
- Estados vacíos/error documentados
- Verificaciones completadas
