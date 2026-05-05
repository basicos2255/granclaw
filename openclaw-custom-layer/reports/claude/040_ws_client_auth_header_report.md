# Report 040 - WS Client Authorization Header

**Fecha**: 2026-05-01
**Estado**: Completado

## Problema

El cliente WebSocket no completaba el handshake con OpenClaw Gateway. El cliente usaba la API de WebSocket del navegador (`new WebSocket(url)`) que no soporta enviar headers custom en el request de upgrade HTTP.

OpenClaw Gateway requiere:
1. Endpoint correcto: `ws://localhost:18789/__openclaw__/ws`
2. Header `Authorization: Bearer <token>` en el upgrade request

## Diagnóstico

### Causa raíz
1. **Browser WebSocket API limitada**: No permite enviar headers en el upgrade request
2. **URL incorrecta**: Se usaba `/ws` en lugar de `/__openclaw__/ws`
3. **Auth en lugar incorrecto**: El token solo iba en `connect` params, no en el upgrade HTTP

### Evidencia
```typescript
// ANTES (no funciona en Node.js con Gateway)
this.ws = new WebSocket(this.wsUrl)

// El token solo iba en connect params, pero Gateway
// necesita Authorization header en el upgrade HTTP
```

## Solución

### 1. Instalación de paquete `ws`

```bash
cd packages/openclaw-adapter
npm install ws
npm install --save-dev @types/ws
```

### 2. Modificación de OpenClawWsClient

```typescript
import WebSocket from 'ws'

async connect(): Promise<void> {
  const wsOptions: WebSocket.ClientOptions = {
    headers: {}
  }

  // FIX 040: Add Authorization header in upgrade request
  if (this.apiKey) {
    wsOptions.headers = {
      'Authorization': `Bearer ${this.apiKey}`
    }
  }

  // Create WebSocket with headers (ws package supports this)
  this.ws = new WebSocket(this.wsUrl, wsOptions)

  // Use ws package event API
  this.ws.on('open', ...)
  this.ws.on('close', ...)
  this.ws.on('error', ...)
  this.ws.on('message', ...)

  // FIX 040: Handle upgrade rejection
  this.ws.on('unexpected-response', (_req, res) => {
    const errMsg = `WebSocket upgrade failed: ${res.statusCode} ${res.statusMessage}`
    // 401 = token inválido, 403 = sin permisos
  })
}
```

### 3. Actualización de documentación

**.env.example**:
```
# WebSocket URL for RPC (FIX 040: official endpoint with /__openclaw__ prefix)
OPENCLAW_WS_URL=ws://localhost:18789/__openclaw__/ws
# API Key for authentication (gateway.auth.token from openclaw.json)
# FIX 040: This token is sent as Authorization: Bearer header in WS upgrade
OPENCLAW_API_KEY=
```

**GRANCLAW_MACMINI_RUNBOOK.md**:
- Actualizado con endpoint correcto
- Documentado el flujo de autenticación WS

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `packages/openclaw-adapter/package.json` | Añadido `ws`, `@types/ws` |
| `packages/openclaw-adapter/src/ws/openclaw-ws.client.ts` | Import ws, headers en upgrade, eventos con API ws |
| `.env.example` | URL correcta, documentación de auth |
| `docs/deployment/GRANCLAW_MACMINI_RUNBOOK.md` | URL y auth actualizados |
| `PROJECT_MEMORY.md` | Sección FIX 040, decisión, prompt, report |

## Flujo WS correcto

```
1. Cliente abre WebSocket con header Authorization: Bearer <token>
   ↓
2. Gateway verifica token en upgrade HTTP
   ↓
3. Si OK → conexión establecida (onopen)
   ↓
4. Cliente envía request RPC "connect" con params
   ↓
5. Gateway responde con connect result
   ↓
6. Handshake completo → cliente puede usar otros métodos RPC
```

## Diagnóstico de errores

| Error | Causa | Solución |
|-------|-------|----------|
| 401 en upgrade | Token inválido o faltante | Verificar OPENCLAW_API_KEY |
| 403 en upgrade | Sin permisos | Verificar permisos del token |
| connect timeout | Gateway no responde | Verificar URL y que Gateway esté arriba |
| INVALID_REQUEST en connect | Params incorrectos | Verificar client.id, client.mode |

## Verificación

```bash
# Build exitoso
npm run build --workspaces --if-present

# Verificar conexión WS
curl -s http://localhost:3001/openclaw/ws-rpc-status \
  -H "Authorization: Bearer $TOKEN" | jq

# Esperado si funciona:
{
  "configured": true,
  "connected": true,
  "handshakeComplete": true,
  ...
}
```

## Notas técnicas

1. **ws vs WebSocket browser**: El paquete `ws` es para Node.js y soporta headers custom. La API del navegador no.

2. **Doble autenticación**:
   - Header `Authorization` en upgrade HTTP (obligatorio para abrir conexión)
   - Token en `connect` params (para el handshake RPC)

3. **Evento unexpected-response**: Permite detectar rechazos HTTP (401, 403) antes de que el socket se abra.

## Próximos pasos

- Probar contra OpenClaw Gateway real en Mac mini
- Verificar que WS/RPC funciona end-to-end
- Implementar streaming real con eventos chat.chunk/chat.done

## Conclusión

El cliente WS ahora envía el token de autenticación en el header HTTP del upgrade request, lo cual es requerido por OpenClaw Gateway. El cambio de browser WebSocket API a paquete `ws` permite esta funcionalidad en Node.js.
