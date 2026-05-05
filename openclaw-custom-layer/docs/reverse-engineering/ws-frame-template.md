# WebSocket Frame Template

Usar este template para documentar cada frame capturado.

---

## Frame #[NUMBER]

**Direction:** `client->server` | `server->client`

**Time:** `HH:MM:SS.mmm`

**Method/Event:** `[method.name]` | `[event.name]`

**Type:** `req` | `res` | `event` | `unknown`

### Raw (sanitizado)

```json
{
  "type": "req",
  "id": "[ID]",
  "method": "[METHOD]",
  "params": {
    // params aquí
  }
}
```

### Campos Observados

| Campo | Tipo | Valor Ejemplo | Descripción |
|-------|------|---------------|-------------|
| type | string | req | Tipo de frame |
| id | string | 1 | ID de correlación |
| method | string | connect | Método RPC |

### Relación con Otros Frames

- Request ID: `[ID]`
- Response ID: `[ID]` (si aplica)
- Related frames: `#[OTHER_NUMBER]`

### UI Action que Disparó Este Frame

- [ ] Carga inicial de página
- [ ] Click en botón X
- [ ] Envío de mensaje
- [ ] Cambio de sesión
- [ ] Otro: _______________

### Notes

-
-

---

## Ejemplo Completo

### Frame #001

**Direction:** `client->server`

**Time:** `10:23:45.123`

**Method/Event:** `connect`

**Type:** `req`

### Raw (sanitizado)

```json
{
  "type": "req",
  "id": "1",
  "method": "connect",
  "params": {
    "role": "control",
    "scopes": ["chat", "sessions"],
    "auth": {
      "apiKey": "[REDACTED]"
    }
  }
}
```

### Campos Observados

| Campo | Tipo | Valor Ejemplo | Descripción |
|-------|------|---------------|-------------|
| type | string | req | Request |
| id | string | 1 | Primer request |
| method | string | connect | Handshake |
| params.role | string | control | Rol del cliente |
| params.scopes | array | ["chat"] | Permisos solicitados |
| params.auth.apiKey | string | [REDACTED] | Autenticación |

### UI Action que Disparó Este Frame

- [x] Carga inicial de página

### Notes

- Primer frame enviado tras conexión WS
- Respuesta esperada en frame #002
