# Plan de Captura: OpenClaw Control UI WebSocket

## Objetivo

Capturar tráfico WebSocket real entre OpenClaw Control UI y Gateway para documentar el protocolo RPC exacto.

---

## Prerequisitos

- OpenClaw corriendo localmente o acceso a instancia
- Navegador con DevTools (Chrome/Firefox recomendado)
- Control UI accesible en navegador

---

## Pasos de Captura

### 1. Preparación

1. Abrir OpenClaw Control UI en el navegador
2. NO interactuar todavía con la UI

### 2. Abrir DevTools

1. Presionar `F12` o `Ctrl+Shift+I` (Windows/Linux) / `Cmd+Option+I` (Mac)
2. Ir a la pestaña **Network**
3. Asegurarse de que "Preserve log" esté activado (checkbox)

### 3. Filtrar WebSocket

1. En el filtro de tipos, seleccionar **WS** (WebSocket)
2. O escribir `is:websocket` en el filtro de búsqueda

### 4. Recargar Página

1. Recargar la página (`F5` o `Ctrl+R`)
2. Observar que aparece una conexión WebSocket

### 5. Seleccionar Conexión WS

1. Click en la conexión WebSocket listada
2. Ir a la pestaña **Messages** (Chrome) o **Response** > **WebSocket** (Firefox)

### 6. Capturar Frames

#### Frame 1: Handshake/Connect

- **Esperar**: Primer mensaje enviado por el cliente
- **Copiar**: Contenido completo del frame
- **Documentar** en `ws-rpc-observations.md`

#### Frame 2: Respuesta del Servidor

- **Esperar**: Respuesta al connect
- **Copiar**: Contenido completo
- **Documentar** campos: sessionId, capabilities, etc.

### 7. Capturar Acciones Específicas

Para cada acción, documentar ANTES y DESPUÉS:

| Acción | Qué capturar |
|--------|--------------|
| Enviar mensaje | Request y response de chat.send (o similar) |
| Cambiar chat/sesión | Método para cambio de contexto |
| Crear nueva sesión | Método de creación |
| Listar sesiones | Método de listado |
| Abortar generación | Método de abort |
| Inyectar mensaje | Método de inject |

### 8. Documentar Eventos del Servidor

Observar mensajes **no solicitados** del servidor:
- Eventos de streaming
- Notificaciones de estado
- Heartbeats/pings

---

## Formato de Documentación

Para cada frame capturado, usar template de `ws-frame-template.md`:

```
## Frame
Direction: client->server | server->client
Time: HH:MM:SS
Method/Event: (extraer de payload)
Raw: (JSON completo)
Sanitized: (sin datos sensibles)
Notes: (observaciones)
```

---

## Seguridad

- **NO** incluir API keys reales
- **NO** incluir tokens de sesión reales
- Reemplazar valores sensibles con `[REDACTED]`
- Sanitizar emails, IDs de usuario, etc.

---

## Destino de Capturas

1. Copiar frames a `ws-rpc-observations.md`
2. Extraer métodos y actualizar `ws-rpc-method-map.md`
3. Actualizar PROJECT_MEMORY.md con hallazgos confirmados

---

## Notas

- Los nombres de métodos son case-sensitive
- Observar estructura de `type` en frames (req/res/event)
- Anotar IDs de correlación (id en request → id en response)
- Documentar errores observados (code, message)
