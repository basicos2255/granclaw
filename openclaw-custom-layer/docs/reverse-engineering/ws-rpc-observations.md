# WebSocket RPC Observations

Documento para registrar frames WebSocket capturados del tráfico real OpenClaw Control UI/WebChat.

---

## Instrucciones

1. Seguir `control-ui-capture-plan.md` para capturar frames
2. Usar template de `ws-frame-template.md` para cada frame
3. Sanitizar datos sensibles ANTES de pegar
4. Actualizar `ws-rpc-method-map.md` con métodos confirmados

---

## Sesión de Captura #001

**Fecha:** YYYY-MM-DD

**Hora inicio:** HH:MM

**Entorno:** Local / Staging / Production

**URL Control UI:** http://localhost:XXXX (o similar)

**Navegador:** Chrome / Firefox / Edge

---

### Frames Capturados

<!--
Usar el siguiente template para cada frame:

## Frame #XXX

**Direction:** `client->server` | `server->client`

**Time:** `HH:MM:SS.mmm`

**Method/Event:** `[method.name]`

**Type:** `req` | `res` | `event`

### Raw (sanitizado)

```json
{
  "type": "...",
  "id": "...",
  ...
}
```

### Notes

-

-->

_No hay frames capturados aún. Seguir instrucciones de captura._

---

## Sesión de Captura #002

**Fecha:** YYYY-MM-DD

**Hora inicio:** HH:MM

**Entorno:**

**URL Control UI:**

**Navegador:**

---

### Frames Capturados

_Pendiente_

---

## Resumen de Hallazgos

| Sesión | Frames Capturados | Métodos Confirmados | Notas |
|--------|-------------------|---------------------|-------|
| #001 | 0 | - | Pendiente |
| #002 | 0 | - | Pendiente |

---

## Métodos Confirmados (resumen)

Lista de métodos que han sido observados en tráfico real:

- _Ninguno aún_

---

## Eventos del Servidor Confirmados

Lista de eventos server->client observados:

- _Ninguno aún_

---

## Anomalías / Observaciones Especiales

Comportamientos inesperados o patrones interesantes:

- _Ninguno aún_

---

## Próximos Pasos

- [ ] Ejecutar primera sesión de captura
- [ ] Documentar frame de handshake/connect
- [ ] Confirmar estructura de chat.send
- [ ] Identificar eventos de streaming
- [ ] Documentar mecanismo de heartbeat (si existe)

