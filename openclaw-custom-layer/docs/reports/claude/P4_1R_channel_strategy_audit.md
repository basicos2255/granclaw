# P4.1R Channel Strategy Audit

**Fecha:** 2026-05-07
**Auditor:** Claude (Arquitecto Backend)

---

## Auditoría por Canal

### Email

| Campo | Valor |
|-------|-------|
| **Channel Type** | `email` |
| **Source** | `granclaw_provider` |
| **OpenClaw Native?** | NO |
| **Adapter?** | NO |
| **Provider?** | SÍ |
| **Fallback?** | queue_for_retry |
| **Razón** | OpenClaw no tiene ningún tool de email (IMAP/SMTP). GranClaw implementa completo. |

---

### FTP

| Campo | Valor |
|-------|-------|
| **Channel Type** | `ftp` |
| **Source** | `granclaw_provider` |
| **OpenClaw Native?** | NO |
| **Adapter?** | NO |
| **Provider?** | SÍ |
| **Fallback?** | queue_for_retry |
| **Razón** | OpenClaw no tiene FTP tool. GranClaw implementa protocolo FTP completo. |

---

### SFTP

| Campo | Valor |
|-------|-------|
| **Channel Type** | `sftp` |
| **Source** | `granclaw_provider` |
| **OpenClaw Native?** | NO |
| **Adapter?** | NO |
| **Provider?** | SÍ |
| **Fallback?** | queue_for_retry |
| **Razón** | OpenClaw no tiene SFTP tool. GranClaw implementa protocolo SFTP completo. |

---

### Browser

| Campo | Valor |
|-------|-------|
| **Channel Type** | `browser` |
| **Source** | `granclaw_provider` |
| **OpenClaw Native?** | PARCIAL (`open_web_browser`) |
| **Adapter?** | NO |
| **Provider?** | SÍ |
| **Fallback?** | escalate_human |
| **Razón** | OpenClaw `open_web_browser` solo lanza navegador por defecto. No controla. GranClaw implementa automatización completa con Playwright (navigate, click, type, screenshot, extract, evaluate). |

---

### WhatsApp

| Campo | Valor |
|-------|-------|
| **Channel Type** | `whatsapp` |
| **Source** | `granclaw_provider` |
| **OpenClaw Native?** | NO |
| **Adapter?** | NO |
| **Provider?** | SÍ |
| **Fallback?** | escalate_human |
| **Razón** | OpenClaw no tiene WhatsApp tool. GranClaw implementa Business API (beta) y Web automation (experimental). |

---

### Calendar

| Campo | Valor |
|-------|-------|
| **Channel Type** | `calendar` |
| **Source** | `granclaw_provider` |
| **OpenClaw Native?** | NO |
| **Adapter?** | NO |
| **Provider?** | SÍ |
| **Fallback?** | queue_for_retry |
| **Razón** | OpenClaw no tiene Calendar tool. GranClaw implementa Google Calendar, Outlook, CalDAV. |

---

### API

| Campo | Valor |
|-------|-------|
| **Channel Type** | `api` |
| **Source** | `granclaw_adapter` |
| **OpenClaw Native?** | SÍ (`http` tool) |
| **Adapter?** | SÍ |
| **Provider?** | NO (usa OpenClaw) |
| **Fallback?** | queue_for_retry → granclaw_provider |
| **Razón** | OpenClaw tiene `http` tool funcional (GET/POST, 10s timeout, bloquea URLs internas). GranClaw adapta añadiendo queue, validation, retries, metrics, rate limiting. |

---

### Filesystem

| Campo | Valor |
|-------|-------|
| **Channel Type** | `filesystem` |
| **Source** | `granclaw_provider` |
| **OpenClaw Native?** | PARCIAL (`open_file_explorer`) |
| **Adapter?** | NO |
| **Provider?** | SÍ |
| **Fallback?** | require_setup |
| **Razón** | OpenClaw `open_file_explorer` solo abre el explorador de archivos. No lee/escribe archivos. GranClaw implementa operaciones completas de filesystem. |

---

### Webhook

| Campo | Valor |
|-------|-------|
| **Channel Type** | `webhook` |
| **Source** | `granclaw_adapter` |
| **OpenClaw Native?** | PARCIAL (`http` tool para salientes) |
| **Adapter?** | SÍ |
| **Provider?** | NO (usa OpenClaw para salientes) |
| **Fallback?** | queue_for_retry |
| **Razón** | OpenClaw `http` tool sirve para webhooks salientes. GranClaw adapta añadiendo: incoming webhook handling, signature verification, delivery tracking, retry queue. |

---

## Resumen de Clasificación

| Source | Canales | Count |
|--------|---------|-------|
| `openclaw_native` | (ninguno) | 0 |
| `granclaw_adapter` | api, webhook | 2 |
| `granclaw_provider` | email, ftp, sftp, browser, whatsapp, calendar, filesystem | 7 |

---

## Justificación de Decisiones

### ¿Por qué 0 canales `openclaw_native`?

Los tools de OpenClaw son demasiado básicos para uso directo:
- `http`: Útil pero necesita governance (queue, validation, metrics)
- `echo`, `time`: No son canales de comunicación
- OS tools: Solo lanzan apps, no controlan

**Decisión:** Siempre pasar por GranClaw layer para governance.

### ¿Por qué `api` es adapter y no provider?

El `http` tool de OpenClaw:
- ✅ Funciona correctamente
- ✅ Tiene seguridad básica (bloquea localhost)
- ✅ Soporta GET/POST

GranClaw adapter añade:
- Queue integration
- Request/response validation
- Retry with backoff
- Metrics collection
- Rate limiting

**Decisión:** Reutilizar OpenClaw http, no reimplementar.

### ¿Por qué `browser` es provider y no adapter?

OpenClaw `open_web_browser`:
- ❌ Solo lanza navegador
- ❌ No controla navegación
- ❌ No interactúa con página
- ❌ No extrae datos

GranClaw necesita:
- Navegación programática
- Clicks, typing
- Screenshots
- Data extraction
- JavaScript execution

**Decisión:** Implementar completo con Playwright.

---

## Validación de No-Duplicación

| Pregunta | Respuesta |
|----------|-----------|
| ¿GranClaw reimplementa `http`? | NO - Usa adapter |
| ¿GranClaw reimplementa OS tools? | NO - Usa sistema de capabilities |
| ¿GranClaw reimplementa tools básicos? | NO - No necesarios para canales |
| ¿Hay código duplicado? | NO |

**Conclusión:** P4.1R cumple con la regla de no-duplicación.

---

## Verificación OpenClaw-First

| Check | Resultado |
|-------|-----------|
| Se auditó OpenClaw antes de crear providers | ✅ |
| Se prefirió adapter donde OpenClaw sirve | ✅ (`api`, `webhook`) |
| Se documentó razón de cada provider | ✅ |
| No hay reimplementación innecesaria | ✅ |

**Conclusión:** P4.1R aplica correctamente OpenClaw-first.

---

*Auditoría completada: 2026-05-07*
