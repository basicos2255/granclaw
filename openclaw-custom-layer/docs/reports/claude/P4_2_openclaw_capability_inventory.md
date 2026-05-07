# P4.2 OpenClaw Capability Inventory

**Fecha:** 2026-05-07
**Tipo:** Auditoría de código real

---

## Resumen Ejecutivo

OpenClaw tiene capabilities **MUY LIMITADAS**. Solo 3 tools nativos básicos. Los channels de GranClaw NO duplican OpenClaw porque OpenClaw no tiene esas capabilities.

---

## 1. OpenClaw Tools Nativos (REAL)

| Tool | Tipo | Estado | Funcionalidad |
|------|------|--------|---------------|
| `echo` | tool | Implementado | Devuelve input con timestamp |
| `time` | tool | Implementado | Devuelve timestamp actual (ISO, Unix, formatted) |
| `http` | tool | Implementado | HTTP GET/POST a URLs externas (10s timeout) |

**Limitaciones de `http` tool:**
- Solo GET y POST
- Bloquea URLs internas (localhost, IPs privadas)
- Timeout fijo de 10 segundos
- Sin headers personalizados (excepto Content-Type)
- Sin autenticación configurable

**Archivos:**
- `apps/api/src/modules/tools/service.ts`
- `apps/api/src/modules/tools/registry.ts`

---

## 2. OpenClaw OS Tools (Capabilities)

| Capability | Tipo | Funcionalidad | Limitaciones |
|------------|------|---------------|--------------|
| `open_calculator` | launcher | Abre calculadora del SO | Solo lanza, no controla |
| `open_web_browser` | launcher | Abre navegador por defecto | Solo lanza, no automatiza |
| `open_text_editor_os` | launcher | Abre editor de texto | Solo lanza, no edita |
| `open_file_explorer` | launcher | Abre explorador de archivos | Solo lanza, no opera |
| `open_terminal` | launcher | Abre terminal | Solo lanza, requiere confirmación |

**Conclusión:** OS tools son **launchers**, no controladores.

---

## 3. OpenClaw Adapter (packages/openclaw-adapter)

### Implementado:
| Capability | Protocolo | Estado |
|------------|-----------|--------|
| Chat/Sessions RPC | WebSocket | Implementado |
| Tools HTTP | REST POST /tools/invoke | Implementado |
| Webhook Triggers | HTTP POST | Implementado |
| REST Completions | OpenAI-compatible | Implementado |

### Stubs (NO implementados):
| Adapter | Estado |
|---------|--------|
| WebhookAdapter | TODO - solo contrato |
| TaskFlowAdapter | TODO - solo contrato |
| ConfigAdapter | TODO - solo contrato |

---

## 4. Capabilities que OpenClaw NO TIENE

| Capability | OpenClaw | GranClaw |
|------------|----------|----------|
| Browser automation (Playwright) | NO | Provider necesario |
| Email IMAP/SMTP | NO | Provider necesario |
| FTP/SFTP | NO | Provider necesario |
| WhatsApp API | NO | Provider necesario |
| Calendar API (Google/Outlook) | NO | Provider necesario |
| Filesystem operations | NO (solo launcher) | Provider necesario |
| Webhook incoming handling | NO | Adapter necesario |
| API con auth/retry/queue | Básico (`http`) | Adapter necesario |

---

## 5. GranClaw Channels - Estado Real

### Patrón Común:
```
Función de WRITE → enqueueChannelAction() → Runtime Queue
Función de READ → STUB (devuelve [] o null)
Event Handler → emitChannelEvent() → Event Bus
```

### Estado por Canal:

| Canal | Write | Read | Events | Worker Real |
|-------|-------|------|--------|-------------|
| Email | Queue | STUB | ✅ | NO |
| FTP | Queue | STUB | ✅ | NO |
| Browser | Queue | STUB | ✅ | NO |
| WhatsApp | Queue | STUB | ✅ | NO |
| Calendar | Queue | STUB | ✅ | NO |
| Filesystem | Queue | STUB | ✅ | NO |
| API | Queue | N/A | ✅ | Podría usar `http` |
| Webhook | Queue | N/A | ✅ | Podría usar `http` |

---

## 6. Clasificación Correcta

### granclaw_adapter (2 canales)
Usan OpenClaw `http` tool como backend:
- `api` - HTTP requests con governance
- `webhook` - HTTP outgoing + incoming handling

### granclaw_provider (7 canales)
OpenClaw NO tiene capability equivalente:
- `email` - Requiere IMAP/SMTP
- `ftp` - Requiere protocolo FTP
- `sftp` - Requiere protocolo SFTP
- `browser` - Requiere Playwright
- `whatsapp` - Requiere WhatsApp API
- `calendar` - Requiere Calendar APIs
- `filesystem` - Requiere fs operations

---

## 7. Justificación de Providers

### Email Provider
```
reason: OpenClaw no tiene IMAP/SMTP
whyOpenClawNotEnough: http tool no puede hacer IMAP polling
fallbackStrategy: queue_for_retry
stability: stable (stubs)
futureMigrationPossible: No (protocolo diferente)
```

### FTP/SFTP Provider
```
reason: OpenClaw no tiene FTP/SFTP
whyOpenClawNotEnough: http tool no puede hacer FTP
fallbackStrategy: queue_for_retry
stability: stable (stubs)
futureMigrationPossible: No (protocolo diferente)
```

### Browser Provider
```
reason: OpenClaw open_web_browser solo lanza
whyOpenClawNotEnough: No controla navegador, no automatiza
fallbackStrategy: escalate_human
stability: beta (Playwright)
futureMigrationPossible: Sí, si OpenClaw añade browser automation
```

### WhatsApp Provider
```
reason: OpenClaw no tiene WhatsApp API
whyOpenClawNotEnough: http tool no puede auth WhatsApp
fallbackStrategy: escalate_human
stability: beta (API) / experimental (web)
futureMigrationPossible: Sí, si OpenClaw añade WhatsApp connector
```

### Calendar Provider
```
reason: OpenClaw no tiene Calendar API
whyOpenClawNotEnough: Requiere OAuth, tokens específicos
fallbackStrategy: queue_for_retry
stability: stable (stubs)
futureMigrationPossible: Sí, si OpenClaw añade Calendar connector
```

### Filesystem Provider
```
reason: OpenClaw open_file_explorer solo lanza
whyOpenClawNotEnough: No lee/escribe archivos
fallbackStrategy: require_setup
stability: stable
futureMigrationPossible: No (acceso directo necesario)
```

---

## 8. Duplicación: NINGUNA

| Aspecto | OpenClaw | GranClaw | Duplicado? |
|---------|----------|----------|------------|
| HTTP requests | `http` tool | API adapter | NO - adapter añade governance |
| Browser control | NO | Provider | NO - no existe en OpenClaw |
| Email | NO | Provider | NO - no existe en OpenClaw |
| FTP | NO | Provider | NO - no existe en OpenClaw |
| Calendar | NO | Provider | NO - no existe en OpenClaw |
| WhatsApp | NO | Provider | NO - no existe en OpenClaw |
| Filesystem | Launcher only | Provider | NO - launcher ≠ operations |

---

## 9. Conclusiones

1. **OpenClaw es MUY limitado** - Solo 3 tools básicos (echo, time, http)
2. **No hay duplicación** - GranClaw providers cubren gaps de OpenClaw
3. **Clasificación P4.1R era correcta** - 2 adapters, 7 providers
4. **Providers son STUBS** - Necesitan workers reales para funcionar
5. **OpenClaw-first aplicable** - Solo para `api` y `webhook` via `http` tool

---

## 10. Recomendaciones

### Inmediato:
1. Consolidar adapters api/webhook para usar OpenClaw `http`
2. Documentar que providers necesitan workers reales

### Futuro:
1. Implementar workers reales para cada provider
2. Monitorear si OpenClaw añade capabilities
3. Migrar a adapters cuando OpenClaw soporte

---

*Inventario generado: 2026-05-07*
