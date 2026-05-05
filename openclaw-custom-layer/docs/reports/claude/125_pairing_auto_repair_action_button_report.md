# REPORTE CLAUDE - FIX 125

## 1. Objetivo ejecutado

Añadir recuperación accionable para errores de pairing/scopes de OpenClaw.

Cuando aparezca setup_required, reauthorization_required, pairing required o more scopes, la UI ofrece un botón "Resolver permisos de OpenClaw" que guía al usuario a través del flujo de reparación.

## 2. Problema inicial

Después de FIX 124.3:
- El sistema detecta respuestas negativas de OpenClaw
- Evita falso "EJECUTADO"
- PERO el usuario no tenía forma clara de resolver el problema
- La acción quedaba bloqueada sin posibilidad de reintento guiado

## 3. Arquitectura repairSession

```typescript
interface RepairSession {
  id: string
  tenantId: string
  userId: string
  scopeKey: OpenClawScopeKey  // os:open_app, os:filesystem, etc.
  capabilityKey?: string
  originalInput: string
  status: 'pending' | 'waiting_user' | 'checking' | 'ready' | 'failed' | 'cancelled'
  originalError?: string
  lastCheckError?: string
  checkAttempts: number
  createdAt: string
  updatedAt: string
  readyAt?: string
  retriedAt?: string
}
```

Persistencia:
- `data/openclaw-repair-sessions.json`: Sesiones de reparación
- `data/openclaw-repair-history.json`: Historial de eventos

## 4. Endpoints creados

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /openclaw/repair/start | Inicia sesión de reparación |
| GET | /openclaw/repair/:id | Obtiene sesión por ID |
| POST | /openclaw/repair/:id/check | Verifica si auth está lista |
| POST | /openclaw/repair/:id/cancel | Cancela sesión |
| POST | /openclaw/repair/:id/retry | Marca como reintentada |
| GET | /openclaw/repair/active | Lista sesiones activas |
| GET | /openclaw/repair/history | Historial de eventos |

### Ejemplo: POST /openclaw/repair/start

Input:
```json
{
  "scopeKey": "os:open_app",
  "capabilityKey": "open_vscode",
  "originalInput": "abre vscode",
  "error": "No puedo abrirla porque el nodo pide reemparejar"
}
```

Output:
```json
{
  "success": true,
  "repairSession": { ... },
  "setupUrl": "/control/setup?repairSessionId=abc123",
  "instructions": "OpenClaw necesita permisos para abrir aplicaciones..."
}
```

## 5. Cambios UI

### SecurityResultPanel

Cuando `effectiveStatus` es `setup_required` o `reauthorization_required`:

```tsx
{repairInfo && (
  <button onClick={handleStartRepair}>
    🔧 Resolver permisos de OpenClaw
  </button>
)}

{onLocalFallback && (
  <button onClick={onLocalFallback}>
    💻 Ejecutar localmente
  </button>
)}
```

El botón "Resolver permisos" llama `POST /openclaw/repair/start` y navega a `/control/setup?repairSessionId=...`.

### Props agregados

```typescript
interface SecurityResultPanelProps {
  // ... existing props
  repairInfo?: {
    scopeKey: OpenClawScopeKey
    capabilityKey?: string
    originalInput: string
    error?: string
  }
  onStartRepair?: (repairInfo: RepairInfo) => void
  onLocalFallback?: () => void
}
```

## 6. Setup page

### Con repairSessionId

La página lee `repairSessionId` de la URL y muestra:

1. **Estado de la sesión** (waiting_user, ready, etc.)
2. **Permiso requerido** (formatScopeKey: "Abrir aplicaciones")
3. **Acción original** ("abre vscode")
4. **Error original** (si existe)
5. **Instrucciones específicas** por scope

### Instrucciones por scope

```typescript
const instructions = {
  'os:open_app': `
    1. Abre la aplicación OpenClaw en el equipo controlado
    2. Ve a Configuración → Permisos
    3. Habilita "Control de aplicaciones"
    4. Pulsa "Ya autoricé, comprobar"
  `,
  'os:filesystem': `...`,
  'os:browser': `...`,
  // etc.
}
```

### Botones

- **"Ya autoricé, comprobar"**: Llama `POST /openclaw/repair/:id/check`
- **"Reintentar acción"**: Visible cuando `status === 'ready'`, llama `POST /openclaw/repair/:id/retry`
- **"Cancelar"**: Llama `POST /openclaw/repair/:id/cancel`

## 7. Pending action/retry

### PendingAction actualizada

```typescript
interface PendingAction {
  input: string
  tenantId: string
  userId?: string
  timestamp: number
  capabilityKey?: string
  scopeKey?: OpenClawScopeKey
  repairSessionId?: string  // FIX 125
  createdAt?: string        // FIX 125
}
```

### Flujo de retry

1. Usuario pulsa "Reintentar acción" en Setup page
2. Backend llama `markSessionRetried(sessionId)`
3. Frontend guarda `originalInput` en sessionStorage
4. Navega a `/control` (Execute page)
5. Execute page lee sessionStorage y ejecuta automáticamente

## 8. Fallback local

El botón "Ejecutar localmente" aparece cuando:
- `onLocalFallback` callback está definido
- Existe capability local aprobada para la acción

Comportamiento controlado:
- Respeta modo seguro/libre
- Requiere confirmación si strict/high risk
- Registra source = 'granclaw-local-fallback'

## 9. Status/debug/historial

### Eventos de historial

```typescript
type RepairEventType =
  | 'repair_started'
  | 'repair_checked'
  | 'repair_ready'
  | 'repair_failed'
  | 'repair_cancelled'
  | 'retry_after_repair'
```

Cada evento incluye:
- repairSessionId
- tenantId, userId
- scopeKey, capabilityKey
- timestamp
- details

### API de historial

```
GET /openclaw/repair/history
```

Devuelve últimos 50 eventos del tenant.

## 10. Casos probados

| Caso | Resultado |
|------|-----------|
| OpenClaw responde pairing required | UI muestra REAUTH REQUIRED con botón "Resolver permisos" |
| Pulsar "Resolver permisos" | Crea repair session, navega a setup |
| Check falla | Muestra instrucciones, mantiene waiting_user |
| Check OK | Resuelve requirement, habilita "Reintentar acción" |
| Reintentar | Navega a Execute con input original |
| Cancelar | Limpia URL, vuelve a setup normal |
| Reinicio servidor | Sessions persisten en disco |

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
dist/assets/index-Bc4B0Wvm.js   276.10 kB │ gzip: 74.85 kB
✓ built in 1.94s
```

**Build exitoso.**

## 13. Estado PROJECT_MEMORY.md

✅ Actualizado con entrada FIX 125:
- Problema documentado
- Módulo openclaw-repair explicado
- Endpoints listados
- Cambios UI documentados
- Setup page con instrucciones
- PendingAction actualizada
- Historial de eventos
- Verificaciones completadas
