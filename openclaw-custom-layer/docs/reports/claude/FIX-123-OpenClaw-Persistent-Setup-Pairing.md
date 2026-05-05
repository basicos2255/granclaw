# FIX 123 - OpenClaw Persistent Setup & Pairing Flow

**Fecha**: 2026-05-05
**Estado**: Completado
**Autor**: Claude

## Resumen Ejecutivo

Implementación de un sistema de estado persistente para gestionar el pairing y configuración de OpenClaw. El pairing ahora se trata como un **estado del sistema** (no un error transitorio), sobrevive a reinicios, bloquea ejecuciones hasta resolverse, y almacena acciones pendientes para reintentar después de la configuración.

## Problema

El sistema anterior trataba los errores de pairing como errores puntuales de cada solicitud:

1. Si OpenClaw requería pairing, cada solicitud fallaba independientemente
2. Las acciones ejecutadas durante el estado de setup se perdían
3. No había visibilidad global del estado de configuración
4. El estado no sobrevivía a reinicios del servidor
5. No existía mecanismo para reintentar acciones después del setup

## Principio Clave

> El pairing es un **estado del sistema**, no un error de una solicitud específica.

Características del nuevo enfoque:
- **Persistente**: Sobrevive reinicios del servidor
- **Global**: Visible y aplicable en todo el sistema
- **Bloqueante**: Impide ejecución OpenClaw hasta resolverse
- **Recuperable**: Almacena acciones pendientes para reintento

## Componentes Implementados

### 1. System State Module

**Ubicación**: `apps/api/src/modules/system-state/`

#### types.ts
```typescript
export type OpenClawSetupStatus = 'ready' | 'setup_required' | 'unknown'

export interface PendingAction {
  input: string
  tenantId: string
  userId: string
  timestamp: number
  capabilityKey?: string
}

export interface SystemState {
  openclawRequiresSetup: boolean
  openclawSetupStatus: OpenClawSetupStatus
  lastError?: string
  lastChecked?: number
  lastSuccessfulExecution?: number
  pendingAction?: PendingAction
  version: number
}
```

#### service.ts
Funciones principales:
- `getSystemState()`: Lee estado actual
- `saveSystemState()`: Persiste estado a JSON
- `openclawRequiresSetup()`: Verifica si requiere setup
- `markOpenClawRequiresSetup(error)`: Marca como requiere setup
- `markOpenClawReady()`: Marca como listo
- `storePendingAction(action)`: Almacena acción pendiente
- `consumePendingAction()`: Obtiene y limpia acción pendiente
- `recordSuccessfulExecution()`: Registra éxito (limpia setup_required)
- `updateLastChecked()`: Actualiza timestamp de verificación

**Persistencia**: `data/system-state.json`

#### routes.ts
Endpoints API:
- `GET /system/state`: Estado actual
- `GET /system/pending-action`: Acción pendiente
- `POST /system/clear-pending-action`: Limpiar acción
- `POST /system/consume-pending-action`: Obtener y limpiar
- `POST /system/mark-openclaw-ready`: Marcar como listo

### 2. Reauth Detector Updates

**Ubicación**: `apps/api/src/modules/orchestrator/reauth-detector.ts`

Nuevas funciones:
```typescript
// Detecta reauth Y actualiza system state
function detectAndMarkReauthRequired(
  response: ...,
  pendingAction?: Omit<PendingAction, 'timestamp'>
): ReauthDetectionResult

// Verifica si debe bloquear
function shouldBlockForSetup(): boolean

// Registra ejecución exitosa
function recordOpenClawSuccess(): void

// Crea respuesta estandarizada
function createSetupRequiredResponse(
  requestId: string,
  taskId: string,
  pendingInput?: string
)
```

### 3. Orchestrator Blocking

**Ubicación**: `apps/api/src/modules/orchestrator/routes.ts`

Cambios en el flujo:
1. Antes de cada llamada a OpenClaw: `shouldBlockForSetup()`
2. Si requiere setup:
   - `storePendingAction()` guarda la acción
   - Retorna `executionStatus: 'setup_required'`
3. Si éxito:
   - `recordOpenClawSuccess()` limpia estado

Secciones actualizadas:
- Provider 'openclaw' (línea ~245)
- Fallback (línea ~704)
- Streaming provider 'openclaw' (línea ~1060)
- Streaming fallback (línea ~1356)

### 4. Check Auth Endpoint

**Ubicación**: `apps/api/src/modules/openclaw/routes.ts`

```typescript
GET /openclaw/check-auth

Response:
{
  success: boolean
  authStatus: {
    ws: 'ok' | 'fail' | 'skip'
    rest: 'ok' | 'fail' | 'skip'
    tools: 'ok' | 'fail' | 'skip'
    details: { wsError?, restError?, toolsError? }
  }
  systemState: { openclawRequiresSetup, openclawSetupStatus, lastError, lastChecked }
  summary: { wsOk, restOk, toolsOk, hasPairingError, isReady }
}
```

### 5. Setup Page (Frontend)

**Ubicación**: `apps/web/src/pages/control/Setup.tsx`

Características:
- Estado actual de OpenClaw (badge ready/requires_setup)
- Último error detectado
- Última verificación
- Última ejecución exitosa
- Botón "Verificar conexión"
- Botón "Marcar como listo" (manual)
- Resultados de verificación (WS/REST/Tools)
- Acción pendiente con botón "Reintentar"
- Instrucciones de configuración

### 6. API Client

**Ubicación**: `apps/web/src/services/api.ts`

Nuevos métodos:
```typescript
api.getSystemState()
api.getPendingAction()
api.markOpenClawReady()
api.checkOpenClawAuth()
api.consumePendingAction()
```

Nuevos tipos:
```typescript
SystemStateData
PendingActionData
OpenClawCheckAuthResult
OpenClawSetupStatus
```

## Flujo de Bloqueo

```
┌─────────────────────────────────────────────────────────────┐
│                    Usuario envía acción                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              shouldBlockForSetup() ?                         │
└─────────────────────────────────────────────────────────────┘
                      │               │
                     YES              NO
                      │               │
                      ▼               ▼
┌────────────────────────────┐ ┌────────────────────────────┐
│ storePendingAction()        │ │ Ejecutar OpenClaw           │
│ Return setup_required       │ │                            │
└────────────────────────────┘ └────────────────────────────┘
                                              │
                                    ┌─────────┴─────────┐
                                    │                   │
                                 SUCCESS             REAUTH
                                    │                   │
                                    ▼                   ▼
                      ┌─────────────────┐ ┌─────────────────────────┐
                      │ recordOpenClaw  │ │ detectAndMarkReauth     │
                      │ Success()       │ │ Required()              │
                      │ (limpia estado) │ │ (marca setup_required)  │
                      └─────────────────┘ └─────────────────────────┘
```

## Archivos Creados

| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| apps/api/src/modules/system-state/types.ts | ~30 | Tipos del sistema |
| apps/api/src/modules/system-state/service.ts | ~120 | Persistencia de estado |
| apps/api/src/modules/system-state/routes.ts | ~120 | API endpoints |
| apps/api/src/modules/system-state/index.ts | ~10 | Exports del módulo |
| apps/web/src/pages/control/Setup.tsx | ~320 | Página de configuración |

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| apps/api/src/modules/orchestrator/reauth-detector.ts | +60 líneas (nuevas funciones) |
| apps/api/src/modules/orchestrator/routes.ts | +100 líneas (blocking logic) |
| apps/api/src/modules/orchestrator/trace.ts | +1 source type |
| apps/api/src/modules/openclaw/routes.ts | +70 líneas (handleCheckAuth) |
| apps/api/src/index.ts | +15 líneas (rutas) |
| apps/web/src/services/api.ts | +80 líneas (métodos y tipos) |
| apps/web/src/pages/control/index.ts | +1 export |
| apps/web/src/App.tsx | +2 líneas (import y route) |

## Verificaciones

- ✅ System state module creado y exportado
- ✅ Persistencia JSON funcional
- ✅ Reauth detector integrado con system state
- ✅ Orchestrator bloquea antes de OpenClaw (4 puntos)
- ✅ Check-auth endpoint funcional
- ✅ Setup page creada y registrada
- ✅ API routes registradas en index.ts
- ✅ Source type 'setup-required' añadido
- ✅ `npm run check` sin errores
- ✅ `npm run build` exitoso

## Uso

### Verificar estado del sistema
```bash
curl http://localhost:3001/system/state -H "Authorization: Bearer $TOKEN"
```

### Verificar autenticación OpenClaw
```bash
curl http://localhost:3001/openclaw/check-auth -H "Authorization: Bearer $TOKEN"
```

### Marcar como listo manualmente
```bash
curl -X POST http://localhost:3001/system/mark-openclaw-ready -H "Authorization: Bearer $TOKEN"
```

### Página de configuración
Navegar a: `http://localhost:5173/control/setup`

## Notas de Implementación

1. **Persistencia**: El estado se guarda en `data/system-state.json` con versión para futuras migraciones
2. **Thread safety**: Lectura/escritura síncrona para evitar race conditions
3. **Auto-clear**: `recordSuccessfulExecution()` limpia `setup_required` automáticamente
4. **Backwards compatible**: El sistema funciona aunque el archivo no exista (crea defaults)
5. **No modifica OpenClaw core**: Toda la lógica está en la capa GranClaw
