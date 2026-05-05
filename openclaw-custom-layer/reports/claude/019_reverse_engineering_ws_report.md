# Report 019: Reverse Engineering WebSocket Protocol

**Fecha**: 2026-04-29
**Prompt ID**: 020
**Objetivo**: Crear fase de reverse engineering controlado para capturar y mapear tráfico WebSocket/RPC real de OpenClaw

---

## Resumen Ejecutivo

Se ha creado la infraestructura de documentación para realizar reverse engineering del protocolo WebSocket de OpenClaw Gateway. Esta fase permite observar tráfico real sin hacer suposiciones incorrectas sobre los métodos RPC.

---

## Archivos Creados

### 1. docs/reverse-engineering/control-ui-capture-plan.md

Plan paso a paso para capturar tráfico WebSocket usando DevTools del navegador:

- Preparación del entorno
- Apertura de DevTools y filtro WS
- Captura de frames de handshake
- Captura de acciones específicas (chat, sessions, etc.)
- Formato de documentación
- Consideraciones de seguridad (sanitizar datos)

### 2. docs/reverse-engineering/ws-frame-template.md

Template estandarizado para documentar cada frame capturado:

```markdown
## Frame #XXX

**Direction:** `client->server` | `server->client`
**Time:** `HH:MM:SS.mmm`
**Method/Event:** `[method.name]`
**Type:** `req` | `res` | `event`

### Raw (sanitizado)
```json
{ ... }
```

### Campos Observados
| Campo | Tipo | Valor Ejemplo | Descripción |
|-------|------|---------------|-------------|

### UI Action que Disparó Este Frame
- [ ] Carga inicial de página
- [ ] Click en botón X
- [ ] Envío de mensaje
...
```

### 3. docs/reverse-engineering/ws-rpc-method-map.md

Mapa de métodos RPC con estado de confirmación:

| Estado | Significado |
|--------|-------------|
| CONFIRMED | Observado en tráfico real |
| ASSUMED | Inferido de código/docs, no confirmado |
| UNKNOWN | Requiere investigación |

**Métodos actuales** (todos ASSUMED o UNKNOWN):
- connect (handshake)
- chat.send, chat.history, chat.abort, chat.inject
- sessions.list, sessions.patch
- channels.status, config.patch
- tools.execute, tools.list (UNKNOWN)

**Eventos del servidor** (UNKNOWN):
- chat.token
- chat.done
- error

**Estructura de frames documentada**:
- Request: `{ type: "req", id, method, params }`
- Response: `{ type: "res", id, result?, error? }`
- Event: `{ type: "event", event, data }`

### 4. docs/reverse-engineering/ws-rpc-observations.md

Documento para registrar frames capturados en sesiones de observación:

- Template de sesión de captura
- Campos: fecha, hora, entorno, navegador
- Espacio para frames individuales
- Resumen de hallazgos
- Métodos y eventos confirmados
- Anomalías observadas
- Próximos pasos

---

## Proceso de Reverse Engineering

```
1. Abrir OpenClaw Control UI en navegador
2. Abrir DevTools > Network > WS
3. Recargar página para capturar conexión inicial
4. Observar frames de handshake (connect)
5. Realizar acciones en UI y capturar frames
6. Documentar en ws-rpc-observations.md
7. Actualizar ws-rpc-method-map.md con hallazgos
8. Cambiar status de ASSUMED → CONFIRMED
```

---

## Métodos Pendientes de Validación

| Método | Estado Actual | Prioridad |
|--------|---------------|-----------|
| connect | ASSUMED | Alta |
| chat.send | ASSUMED | Alta |
| chat.history | ASSUMED | Media |
| tools.execute | UNKNOWN | Alta |
| tools.list | UNKNOWN | Media |

---

## Hallazgos Pendientes

- [ ] Estructura exacta de connect params
- [ ] Confirmar si tools.execute existe
- [ ] Identificar eventos de streaming
- [ ] Documentar códigos de error
- [ ] Verificar heartbeat/ping mechanism

---

## Impacto en el Proyecto

1. **Validación de implementación actual**: Los métodos RPC actuales son ASSUMED y deben confirmarse
2. **tools.execute es tentativo**: Puede no existir o tener otro nombre
3. **Streaming events desconocidos**: chat.token y chat.done son suposiciones
4. **Base para correcciones**: Una vez observado tráfico real, se pueden corregir los adapters

---

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| PROJECT_MEMORY.md | Añadida sección Reverse Engineering |

---

## Notas

- El reverse engineering es necesario porque no hay documentación oficial del protocolo
- Todos los datos capturados deben sanitizarse (redactar API keys, tokens, IDs)
- El método tools.execute puede no existir - los tools podrían ejecutarse internamente en OpenClaw
- Esta fase es prerequisito para validar la integración de tools vía Gateway

---

## Próximos Pasos Sugeridos

1. Ejecutar primera sesión de captura con OpenClaw real
2. Documentar frame de connect (handshake inicial)
3. Observar flujo completo de chat.send
4. Buscar evidencia de tools.execute o alternativas
5. Documentar eventos de streaming del servidor

---

## Estructura Final

```
docs/reverse-engineering/
├── control-ui-capture-plan.md    # Plan de captura
├── ws-frame-template.md          # Template para frames
├── ws-rpc-method-map.md          # Mapa de métodos RPC
└── ws-rpc-observations.md        # Registro de capturas
```

---

**Estado**: ✅ Completado
**Siguiente**: Ejecutar sesión de captura real
