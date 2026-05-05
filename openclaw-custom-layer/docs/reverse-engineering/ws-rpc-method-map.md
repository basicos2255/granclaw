# WebSocket RPC Method Map

Mapa de métodos RPC descubiertos via reverse engineering de OpenClaw Control UI/WebChat.

---

## Estado de Confirmación

| Símbolo | Significado |
|---------|-------------|
| CONFIRMED | Observado en tráfico real |
| ASSUMED | Inferido de código/docs, no confirmado |
| UNKNOWN | Requiere investigación |

---

## Métodos Descubiertos

### Handshake

| Method | Direction | Params | Response | Source Action | Status | Notes |
|--------|-----------|--------|----------|---------------|--------|-------|
| connect | client->server | { role, scopes?, auth? } | { sessionId?, capabilities? } | Carga inicial | ASSUMED | Primer frame obligatorio |

### Chat

| Method | Direction | Params | Response | Source Action | Status | Notes |
|--------|-----------|--------|----------|---------------|--------|-------|
| chat.send | client->server | { message, sessionId? } | { response?, ... } | Enviar mensaje | ASSUMED | - |
| chat.history | client->server | { sessionId?, limit? } | { messages[] } | Ver historial | ASSUMED | - |
| chat.abort | client->server | { sessionId? } | { success } | Cancelar | ASSUMED | - |
| chat.inject | client->server | { role, content, sessionId? } | { success } | Inyectar | ASSUMED | - |

### Sessions

| Method | Direction | Params | Response | Source Action | Status | Notes |
|--------|-----------|--------|----------|---------------|--------|-------|
| sessions.list | client->server | { agentId? } | { sessions[] } | Listar | ASSUMED | - |
| sessions.patch | client->server | { sessionId, patch } | { session } | Modificar | ASSUMED | - |

### Tools (NO CONFIRMADO)

| Method | Direction | Params | Response | Source Action | Status | Notes |
|--------|-----------|--------|----------|---------------|--------|-------|
| tools.execute | client->server | { tool, params } | { result } | - | UNKNOWN | Tentativo, requiere validación |
| tools.list | client->server | {} | { tools[] } | - | UNKNOWN | Tentativo |

### Channels

| Method | Direction | Params | Response | Source Action | Status | Notes |
|--------|-----------|--------|----------|---------------|--------|-------|
| channels.status | client->server | {} | { channels[] } | Ver canales | ASSUMED | - |

### Config

| Method | Direction | Params | Response | Source Action | Status | Notes |
|--------|-----------|--------|----------|---------------|--------|-------|
| config.patch | client->server | { config } | { success } | Cambiar config | ASSUMED | - |

---

## Eventos del Servidor (Server -> Client)

| Event | Data | Trigger | Status | Notes |
|-------|------|---------|--------|-------|
| chat.token | { token, sessionId? } | Durante streaming | UNKNOWN | Posible evento de token |
| chat.done | { sessionId? } | Fin de respuesta | UNKNOWN | Posible evento de fin |
| error | { code, message } | Error en proceso | UNKNOWN | - |

---

## Estructura de Frames

### Request (client->server)

```json
{
  "type": "req",
  "id": "string",
  "method": "string",
  "params": {}
}
```

### Response (server->client)

```json
{
  "type": "res",
  "id": "string",
  "result": {},
  "error": { "code": 0, "message": "" }
}
```

### Event (server->client)

```json
{
  "type": "event",
  "event": "string",
  "data": {}
}
```

---

## Proceso de Actualización

1. Capturar frame en `ws-rpc-observations.md`
2. Identificar method/event
3. Actualizar esta tabla
4. Cambiar status de ASSUMED/UNKNOWN a CONFIRMED
5. Actualizar PROJECT_MEMORY.md si es relevante

---

## Hallazgos Pendientes

- [ ] Confirmar estructura exacta de `connect` params
- [ ] Confirmar si `tools.execute` existe
- [ ] Identificar eventos de streaming
- [ ] Documentar códigos de error
- [ ] Verificar heartbeat/ping mechanism
