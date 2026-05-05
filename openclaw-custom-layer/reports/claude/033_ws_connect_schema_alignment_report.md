# 033 - WS Connect Schema Alignment Report

**Fecha**: 2026-04-30
**Prompt ID**: 033
**Estado**: Completado

---

## 1. Objetivo ejecutado

Incorporar fixes de WS descubiertos durante testing en Mac mini TUI:
1. Fix bug interno: `request('connect')` fallaba antes de socket marcado como conectado
2. Hacer `client.id` y `client.mode` configurables via env vars
3. Soporte para variantes de client identity
4. Detección de errores INVALID_REQUEST de schema Gateway

---

## 2. Bugs descubiertos

### Bug 1: "Not connected" antes de connect

**Causa**: En el handler `onopen`:
- `this.state` era 'connecting' (no 'connected')
- `request()` verificaba `state !== 'connected'` y rechazaba
- El método 'connect' requería que el estado fuera 'connected' pero era el primero en ejecutarse

**Solución**:
- Añadir flag `socketOpen` separado de `handshakeComplete`
- En `onopen`: `socketOpen = true` antes de `performHandshake()`
- En `request()`: permitir método 'connect' cuando `socketOpen=true`

### Bug 2: INVALID_REQUEST schema

**Causa**: OpenClaw Gateway tiene schema con constantes para `client.id` y `client.mode`:
```
INVALID_REQUEST: invalid connect params
- at /client/id "must be equal to constant"
- at /client/mode "must be equal to constant"
```

**Solución**:
- Hacer `client.id` y `client.mode` configurables
- Env vars: `OPENCLAW_WS_CLIENT_ID`, `OPENCLAW_WS_CLIENT_MODE`
- Defaults: `web` y `operator` (valores conocidos del schema)
- Soporte para variantes: `OPENCLAW_WS_CLIENT_VARIANTS=id:mode,id:mode`

---

## 3. Archivos modificados

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `packages/openclaw-adapter/src/types.ts` | Modificado | wsClientId, wsClientMode, wsClientVariants en WsClientConfig |
| `packages/openclaw-adapter/src/ws/openclaw-ws.client.ts` | Modificado | socketOpen flag, client identity configurable, variants |
| `.env.example` | Modificado | Variables WS client identity |
| `docs/deployment/GRANCLAW_MACMINI_RUNBOOK.md` | Modificado | Sección 7.3 y troubleshooting F |
| `PROJECT_MEMORY.md` | Modificado | Sección FIX 033, prompt y reporte registrados |
| `reports/claude/033_ws_connect_schema_alignment_report.md` | Creado | Este reporte |

---

## 4. Cambios técnicos

### types.ts

```typescript
export interface WsClientConfig {
  wsUrl: string
  apiKey?: string
  reconnectIntervalMs?: number
  // Configurable client identity (OpenClaw Gateway schema requirements)
  wsClientId?: string
  wsClientMode?: string
  // Opcional: variantes a probar formato "id:mode,id:mode"
  wsClientVariants?: string
}
```

### openclaw-ws.client.ts

**Nuevos campos**:
```typescript
private readonly wsClientId: string
private readonly wsClientMode: string
private readonly wsClientVariants: string | undefined
private socketOpen = false // FIX 033
```

**Constructor actualizado**:
```typescript
constructor(config: WsClientConfig) {
  // ...
  this.wsClientId = config.wsClientId || process.env.OPENCLAW_WS_CLIENT_ID || 'web'
  this.wsClientMode = config.wsClientMode || process.env.OPENCLAW_WS_CLIENT_MODE || 'operator'
  this.wsClientVariants = config.wsClientVariants || process.env.OPENCLAW_WS_CLIENT_VARIANTS
}
```

**request() actualizado**:
```typescript
async request(method: string, params?: unknown): Promise<unknown> {
  // FIX 033: For 'connect' method, only require socket to be open
  if (method === 'connect') {
    if (!this.ws || !this.socketOpen) {
      throw new Error('Socket not open')
    }
  } else {
    // For all other methods, require full connection and handshake
    if (!this.ws || this.state !== 'connected') {
      throw new Error('Not connected')
    }
    if (!this.handshakeComplete) {
      throw new Error('Handshake not complete')
    }
  }
  // ...
}
```

**performHandshake() actualizado**:
- Construye lista de variantes de client identity
- Prueba combinaciones de client identity + auth
- Detecta errores INVALID_REQUEST y pasa a siguiente variante
- Usa `this.wsClientId` y `this.wsClientMode` en lugar de hardcoded

---

## 5. Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `OPENCLAW_WS_CLIENT_ID` | `web` | ID cliente para schema Gateway |
| `OPENCLAW_WS_CLIENT_MODE` | `operator` | Modo cliente (operator/webchat/agent) |
| `OPENCLAW_WS_CLIENT_VARIANTS` | (vacío) | Variantes a probar, formato `id:mode,id:mode` |

---

## 6. Flujo de handshake corregido

```
1. new WebSocket(url)
2. onopen → socketOpen = true
3. performHandshake():
   a. Build client variants list
   b. For each variant + auth combination:
      - Send request('connect', params)
      - If INVALID_REQUEST on /client/* → next variant
      - If success → handshakeComplete = true, state = 'connected'
      - If fail → try next combination
4. If all fail → throw error with last message
```

---

## 7. Pruebas realizadas

```bash
# TypeScript check
npm run check --workspaces --if-present  # OK

# Build
npm run build --workspaces --if-present  # OK
```

---

## 8. Estado final

- ✅ Bug "Not connected" corregido
- ✅ client.id/mode configurables
- ✅ Variantes soportadas
- ✅ Detección de errores schema
- ✅ .env.example actualizado
- ✅ Runbook actualizado
- ✅ PROJECT_MEMORY.md actualizado
- ✅ Build OK

---

## 9. Notas importantes

1. **WS sigue siendo opcional**: REST y /tools/invoke son los caminos principales
2. **Defaults seguros**: `web:operator` son valores conocidos del schema Gateway
3. **Variantes**: Permiten probar múltiples identities sin cambiar código
4. **Logging mejorado**: Se muestra qué variant/auth combinación funcionó

---

## 10. Pendiente para validación Mac mini

Probar con OpenClaw real:
```bash
# Con defaults
OPENCLAW_WS_URL=ws://localhost:18789/ws

# Con variantes si necesario
OPENCLAW_WS_CLIENT_VARIANTS=web:operator,granclaw:operator
```

El WS debería ahora:
1. Abrir socket correctamente
2. Enviar connect con client.id/mode válidos
3. Completar handshake si auth y schema OK
4. Reportar error claro si falla
