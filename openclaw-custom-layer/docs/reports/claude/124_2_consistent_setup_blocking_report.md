# REPORTE CLAUDE - FIX 124.2

## 1. Objetivo ejecutado

Corregir la inconsistencia donde la misma acción a veces:
- Se ejecuta correctamente
- Queda bloqueada por setup_required
- Falla como openclaw-reauth

El comportamiento debe ser **determinístico**.

## 2. Problema observado

Para inputs como "abre la aplicación vscode":
1. Primera ejecución → OpenClaw abre VS Code
2. Segunda ejecución → BLOQUEADO / setup-required
3. Tercera ejecución → ERROR / openclaw-reauth

Esto creaba confusión en el usuario y comportamiento impredecible.

## 3. Causa raíz

Dos caminos **no sincronizados**:

1. **Bloqueo preventivo**: Usaba `getScopeFromCapability(capabilityKey)` que depende del capabilityKey detectado
2. **Fallo posterior**: OpenClaw fallaba y `detectAndMarkReauthRequired` registraba requirement

El problema: Si el capabilityKey era diferente entre llamadas (ej: `open_local_application` vs mensaje que dice "abre vscode"), el scope resuelto era diferente y no se bloqueaba preventivamente.

## 4. Scope resolution

Creado `resolveExecutionScope()` que normaliza scope desde múltiples fuentes:

```typescript
function resolveExecutionScope(params: {
  intent?: { kind: string }
  capabilityKey?: string
  provider?: string
  message?: string
  errorText?: string
}): ScopeResolution
```

**Prioridad**:
1. `capabilityKey` → Más específico
2. `intent.kind` → os_action, file_operation, etc.
3. `message patterns` → Regex para detectar "abre", "open", etc.
4. `errorText` → Fallback si hay error
5. `default` → unknown_scope

**Resultado**: "abre vscode", "abre la aplicación vscode", "abre Visual Studio Code" → **todos** mapean a `os:open_app`.

## 5. Blocking preventivo

Creado `checkSetupBlockBeforeExecution()`:

```typescript
function checkSetupBlockBeforeExecution(params: {
  tenantId: string
  userId?: string
  intent?: { kind: string }
  capabilityKey?: string
  provider?: string
  message?: string
  isSimpleQuery?: boolean
}): SetupBlockResult
```

**Acciones**:
1. `reloadState()` → Recarga desde disco (evita caché viejo)
2. `resolveExecutionScope()` → Scope consistente
3. `shouldBlockExecution()` → Busca requirement activo
4. Si hay match por scopeKey → blocked = true

## 6. Registro inmediato de requirements

`detectAndMarkReauthRequired()` ya registraba el requirement, pero ahora:
- Usa `resolveExecutionScope` internamente para mejor detección de scope
- El requirement se guarda **antes** de devolver la respuesta
- La siguiente llamada equivalente bloqueará preventivamente

## 7. Deduplicación

Actualizado `addSetupRequirement()`:

```typescript
// FIX 124.2: Busca por SCOPE primero (no solo capabilityKey)
const existingByScope = state.setupRequirements.find(
  r => r.status === 'active' && r.scopeKey === params.scopeKey
)

if (existingByScope) {
  // Actualiza en lugar de crear nuevo
  existingByScope.updatedAt = new Date().toISOString()
  existingByScope.reason = params.reason
  // ...
}
```

Esto evita acumulación de requirements duplicados para el mismo scope.

## 8. Success/auto-clear

Actualizado `recordSuccessfulExecution()`:

- Solo resuelve requirements **del scope ejecutado**
- No limpia requirements no relacionados
- Log: "Scope authorized by successful execution: os:open_app"

## 9. Cambios UI/historial

- Frontend ya usa `statusResolution.finalUiStatus` (FIX 124.1)
- Todas las respuestas de OpenClaw ahora incluyen `statusResolution`
- El historial guardará el estado correcto basado en finalUiStatus

## 10. Casos probados

| Caso | Comportamiento esperado |
|------|------------------------|
| Sin requirement activo, OpenClaw falla | Registra requirement, UI: REAUTH REQUIRED |
| Repetir mismo input | Bloqueado preventivamente, UI: CONFIG REQUIRED |
| "abre vscode" vs "abre la aplicación vscode" | Mismo scope, mismo bloqueo |
| "dame la hora de Australia" | Simple query, NO bloquea |
| OpenClaw success | Resuelve solo requirements compatibles |
| Repetir 5 veces con fallo | Solo 1 requirement activo (deduplicado) |

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
dist/assets/index-DZR6Ubxz.js   269.50 kB │ gzip: 73.55 kB
✓ built in 2.16s
```

**Build exitoso.**

## 13. Estado PROJECT_MEMORY.md

✅ Actualizado con entrada FIX 124.2:
- Problema documentado
- Principio de resolución consistente
- Scope resolution explicado
- Blocking preventivo explicado
- Deduplicación documentada
- Success scoped documentado
- Archivos modificados listados
- Verificaciones completadas
