# REPORTE CLAUDE 015

**Fecha**: 2026-04-29
**Prompt ID**: 016
**Objetivo**: Reemplazar WS genérico por RPC compatible con OpenClaw Gateway

---

## 1. Objetivo ejecutado

Sustituir el cliente WebSocket genérico por una implementación RPC compatible con el protocolo del Gateway de OpenClaw:
- Frames JSON tipados (req/res/event)
- Handshake connect obligatorio como primer frame
- Métodos RPC documentados: chat.send, chat.history, chat.abort, chat.inject, sessions.list, sessions.patch, channels.status, config.patch
- Fallback a REST/mock si RPC no disponible

---

## 2. Archivos creados/modificados

### Creados

| Archivo | Descripción |
|---------|-------------|
| packages/openclaw-adapter/src/ws/openclaw-chat.rpc.ts | Wrapper RPC para métodos chat/sessions |

### Modificados

| Archivo | Cambio |
|---------|--------|
| packages/openclaw-adapter/src/ws/openclaw-ws.client.ts | Reescrito con estructura RPC completa |
| packages/openclaw-adapter/src/ws/index.ts | Exports de tipos y OpenClawChatRpc |
| packages/openclaw-adapter/src/runtime/openclaw-runtime.adapter.ts | Usa RPC en lugar de emit genérico |
| apps/api/src/modules/orchestrator/service.ts | runStreamingTask usa chatSend RPC |
| apps/api/src/modules/openclaw/types.ts | WsRpcStatusResponse añadido |
| apps/api/src/modules/openclaw/service.ts | getWsRpcStatus implementado |
| apps/api/src/modules/openclaw/routes.ts | handleWsRpcStatus añadido |
| apps/api/src/index.ts | GET /openclaw/ws-rpc-status registrado |
| PROJECT_MEMORY.md | Documentación RPC completa |

---

## 3. Decisiones aplicadas

| Decisión | Motivo |
|----------|--------|
| Frames JSON tipados (req/res/event) | Compatibilidad con Gateway protocol |
| Handshake connect obligatorio | Primer frame requerido por Gateway |
| Map de pending requests | Gestión de timeout y resolución de responses |
| Wildcard event handler ('*') | Captura eventos no mapeados |
| TODOs explícitos en payloads | Honestidad sobre incertidumbre |
| Singleton WS client en orchestrator | Reutilización de conexión |
| REST sigue como fallback | Sistema funciona sin WS |

---

## 4. Problemas encontrados

| Problema | Solución |
|----------|----------|
| Import circular potencial | Imports directos desde archivos específicos |
| Payloads exactos desconocidos | TODOs explícitos, params mínimos |
| Estado del handshake | isHandshakeComplete() separado de isConnected() |

---

## 5. Estructura RPC

### Tipos de frame

```typescript
// Request (cliente -> servidor)
interface RpcRequest {
  type: 'req'
  id: string
  method: string
  params?: unknown
}

// Response (servidor -> cliente)
interface RpcResponse {
  type: 'res'
  id: string
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

// Event (servidor -> cliente, push)
interface RpcEvent {
  type: 'event'
  event: string
  data?: unknown
}
```

### Handshake

```typescript
// Primer frame obligatorio
{
  type: 'req',
  id: 'rpc_...',
  method: 'connect',
  params: {
    role: 'control',
    scopes: ['chat', 'sessions', 'config', 'channels'],
    auth: { apiKey: '...' }
  }
}
```

### Métodos conocidos

- connect (handshake)
- chat.history
- chat.send
- chat.abort
- chat.inject
- sessions.list
- sessions.patch
- channels.status
- config.patch

---

## 6. Pruebas realizadas

- Verificación de tipos TypeScript
- Verificación de exports
- Verificación de imports sin circulares
- Verificación de endpoint registrado
- Estructura de código limpia

---

## 7. Pendiente recomendado

1. Validar payloads contra OpenClaw real
2. Implementar eventos reales del servidor
3. Streaming HTTP para frontend
4. Reconexión automática con backoff
5. Logs de debugging RPC
6. Tests unitarios de RPC client
7. Schema validation de frames

---

## 8. Estado de PROJECT_MEMORY.md

✅ Actualizado con:
- WS genérico sustituido por RPC Gateway
- Primer frame connect obligatorio
- Métodos RPC documentados
- Endpoint /openclaw/ws-rpc-status añadido
- Sección completa WebSocket RPC
- Prompt 016 y reporte 015 añadidos
- Decisiones de diseño RPC
- Adapters actualizados

---

## Resumen

WS RPC compatible Gateway implementado:

**OpenClawWsClient**:
- connect() → handshake automático
- request(method, params) → response con timeout
- notify(method, params) → sin esperar response
- onEvent/offEvent para eventos servidor

**OpenClawChatRpc**:
- chatSend({ message, sessionId })
- chatHistory(), chatAbort(), chatInject()
- sessionsList(), sessionsPatch()
- channelsStatus(), configPatch()

**Orchestrator**:
- runStreamingTask usa chatSend si WS conectado
- Fallback a REST/mock si no

**Diagnóstico**:
- GET /openclaw/ws-rpc-status
- Muestra: configured, connected, handshakeComplete, methodsKnown

**TODO**:
- Payloads exactos pendientes de validar
- REST sigue como fallback
- Webhooks sin cambios para TaskFlow
