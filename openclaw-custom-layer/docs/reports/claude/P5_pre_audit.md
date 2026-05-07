# P5 Pre-Audit Report

**Fecha:** 2026-05-07
**Objetivo:** Auditar estado actual antes de implementar workers

---

## Estado Actual

### runtime-queue (IMPLEMENTADO)

| Componente | Estado | Archivos |
|------------|--------|----------|
| Queue | ✅ Implementado | queue.ts |
| Scheduler | ✅ setInterval polling | scheduler.ts |
| Job Handlers | ✅ Registrables | scheduler.ts |
| Retry Engine | ✅ Backoff + max retries | retry-engine.ts |
| Dead Letter | ✅ Implementado | dead-letter.ts |
| Persistence | ✅ JSON file | persistence.ts |
| Stale Recovery | ✅ Detecta jobs huérfanos | scheduler.ts |

### channels-runtime (PARCIAL)

| Componente | Estado | Notas |
|------------|--------|-------|
| Rate Limiting | ✅ In-memory | Se pierde tras restart |
| Recursive Detection | ✅ Implementado | In-memory |
| enqueueChannelAction | ✅ Emite a eventBus | Solo encola, no ejecuta |
| Channel Manager | ✅ CRUD channels | In-memory |
| Event Adapter | ✅ Emite eventos | |

### Channels (STUBS)

| Canal | WRITE | READ | Worker |
|-------|-------|------|--------|
| email | Queue | STUB [] | NO |
| ftp | Queue | STUB [] | NO |
| browser | Queue | STUB | NO |
| whatsapp | Queue | STUB [] | NO |
| calendar | Queue | STUB [] | NO |

---

## Lo que FALTA

### Workers Persistentes
- [ ] Worker manager
- [ ] Worker registry
- [ ] Heartbeat system
- [ ] Status tracking (starting/running/degraded/failed)

### Reconnect Logic
- [ ] IMAP reconnect
- [ ] WebSocket reconnect
- [ ] FTP reconnect
- [ ] Browser crash recovery

### Session Persistence
- [ ] Browser sessions
- [ ] WhatsApp sessions
- [ ] OAuth refresh tokens
- [ ] Channel cursors

### Lifecycle Management
- [ ] Worker startup
- [ ] Graceful shutdown
- [ ] Recovery after restart
- [ ] Health checks

### Real Connectors
- [ ] IMAP polling/idle
- [ ] FTP operations
- [ ] Playwright runtime
- [ ] WhatsApp API client
- [ ] Calendar API client

---

## Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────────┐
│                    WORKER MANAGER                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  worker-registry.ts                                  │   │
│  │  - Registro de workers activos                      │   │
│  │  - Estado por worker                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│  ┌─────────┬─────────┬─────────┬─────────┬─────────┐       │
│  │ Email   │ FTP     │ Browser │ WA      │Calendar │       │
│  │ Worker  │ Worker  │ Worker  │ Worker  │ Worker  │       │
│  └────┬────┴────┬────┴────┬────┴────┬────┴────┬────┘       │
│       │         │         │         │         │             │
│  ┌────▼─────────▼─────────▼─────────▼─────────▼────┐       │
│  │              HEARTBEAT SERVICE                   │       │
│  │  - Ping cada worker                              │       │
│  │  - Detecta degraded/failed                       │       │
│  │  - Trigger recovery                              │       │
│  └──────────────────────────────────────────────────┘       │
│                           │                                 │
│  ┌────────────────────────▼─────────────────────────┐       │
│  │              RECOVERY SERVICE                    │       │
│  │  - Reconnect logic                               │       │
│  │  - Session restore                               │       │
│  │  - State persistence                             │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## Prioridades

1. **Worker Manager** - Infraestructura base
2. **Heartbeat** - Monitoreo de health
3. **Recovery** - Reconnect y restore
4. **Workers específicos** - Email, FTP, etc.

---

*Pre-audit completado: 2026-05-07*
