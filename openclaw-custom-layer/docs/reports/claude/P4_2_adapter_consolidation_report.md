# P4.2 Adapter Consolidation Report

**Fecha:** 2026-05-07
**Objetivo:** Corregir deriva arquitectónica, consolidar adapters

---

## Resumen Ejecutivo

La auditoría de código real confirma que **P4.1R era correcta**. No hay deriva arquitectónica porque:

1. OpenClaw solo tiene 3 tools básicos (echo, time, http)
2. GranClaw providers son necesarios - OpenClaw no tiene esas capabilities
3. Los channels de GranClaw son abstracciones/stubs, no implementaciones completas

---

## 1. Auditoría Realizada

### OpenClaw Tools (Código Real)

```
apps/api/src/modules/tools/service.ts
```

| Tool | Líneas | Estado |
|------|--------|--------|
| echo | 52-62 | Implementado |
| time | 68-80 | Implementado |
| http | 121-183 | Implementado |

**Total: 3 tools**

### GranClaw Channels (Código Real)

```
apps/api/src/modules/channels/{email,ftp,browser,whatsapp,calendar}/index.ts
```

| Canal | Líneas | WRITE | READ | Estado Real |
|-------|--------|-------|------|-------------|
| email | 340 | Queue | STUB | Abstracción |
| ftp | 366 | Queue | STUB | Abstracción |
| browser | 459 | Queue | STUB | Abstracción |
| whatsapp | 422 | Queue | STUB | Abstracción |
| calendar | 406 | Queue | STUB | Abstracción |

**Patrón común:**
```typescript
// WRITE: Encola a runtime
return enqueueChannelAction(channel.config, 'send', params, options)

// READ: Stub vacío
return [] // TODO: Implement actual listing
```

---

## 2. Clasificación Final

### Adapters (2)

Canales que pueden usar OpenClaw `http` tool:

| Canal | OpenClaw Tool | Fallback |
|-------|---------------|----------|
| api | http (GET/POST) | Native fetch (PUT/PATCH/DELETE) |
| webhook | http (POST outgoing) | GranClaw incoming handler |

### Providers (7)

Canales donde OpenClaw NO tiene capability:

| Canal | Por qué Provider | Stability |
|-------|------------------|-----------|
| email | No IMAP/SMTP en OpenClaw | stable |
| ftp | No FTP protocol | stable |
| sftp | No SSH/SFTP | stable |
| browser | OS tool solo lanza | beta |
| whatsapp | No WhatsApp API | beta |
| calendar | No Calendar API | stable |
| filesystem | OS tool solo lanza explorer | stable |

---

## 3. Consolidación Realizada

### Nuevo Módulo: openclaw-adapters

```
apps/api/src/modules/openclaw-adapters/
├── types.ts                    (120 líneas)
├── api-adapter.ts              (165 líneas)
├── webhook-adapter.ts          (175 líneas)
├── provider-justifications.ts  (125 líneas)
└── index.ts                    (45 líneas)
```

### API Adapter

```typescript
// Usa OpenClaw http tool para GET/POST
const toolResult = await executeTool('http', {
  url: request.url,
  method: request.method,
  body: request.body
})

// Fallback a fetch para PUT/PATCH/DELETE
if (!supportedByOpenClaw) {
  return executeWithFallback(request, context, startTime)
}
```

### Webhook Adapter

```typescript
// Outgoing: Usa OpenClaw http tool
const toolResult = await executeTool('http', {
  url: request.url,
  method: 'POST',
  body: request.payload
})

// Incoming: GranClaw-only (OpenClaw no maneja)
export function parseIncomingWebhook(body, headers) { ... }
```

---

## 4. Provider Justifications

Cada provider tiene justificación documentada:

### Email
```typescript
{
  reason: 'OpenClaw has no IMAP/SMTP capability',
  whyOpenClawNotEnough: 'http tool cannot do IMAP polling',
  fallbackStrategy: 'queue_for_retry',
  futureMigrationPossible: false
}
```

### Browser
```typescript
{
  reason: 'OpenClaw open_web_browser only launches browser',
  whyOpenClawNotEnough: 'No control, no automation',
  fallbackStrategy: 'escalate_human',
  futureMigrationPossible: true,
  migrateWhen: 'OpenClaw adds browser automation'
}
```

---

## 5. Runtime Responsibility

### OpenClaw Responsabilidades
- Reasoning (LLM)
- Tool execution (echo, time, http)
- Native capabilities (OS tools)
- Chat/Sessions management
- RPC Gateway

### GranClaw Responsabilidades
- Workflows
- Queue management
- DAG execution
- Validation
- Recovery/Retry
- Approvals
- WebSocket realtime
- Memory patterns
- Metrics
- Audit
- UX/Product
- Channel abstraction

---

## 6. Duplicación: NINGUNA

| Aspecto | OpenClaw | GranClaw | Duplicado? |
|---------|----------|----------|------------|
| HTTP requests | `http` tool | API adapter | NO - adapter añade governance |
| Browser | Launcher only | Playwright abstraction | NO |
| Email | No existe | Provider | NO |
| FTP | No existe | Provider | NO |
| Calendar | No existe | Provider | NO |

---

## 7. Archivos Modificados/Creados

### Creados (P4.2)
- `openclaw-adapters/types.ts`
- `openclaw-adapters/api-adapter.ts`
- `openclaw-adapters/webhook-adapter.ts`
- `openclaw-adapters/provider-justifications.ts`
- `openclaw-adapters/index.ts`
- `docs/reports/claude/P4_2_openclaw_capability_inventory.md`
- `docs/reports/claude/P4_2_adapter_consolidation_report.md`

### Modificados (P4.2)
- `channel-discovery/types.ts` - Añadido ProviderJustification, RuntimeResponsibilitySplit
- `PROJECT_MEMORY.md` - Añadida sección P4.2

---

## 8. Verificaciones

| Check | Resultado |
|-------|-----------|
| npm run check | ✅ Sin errores |
| npm run build | ✅ Exitoso |
| Auditoría código real | ✅ Completada |
| Clasificación correcta | ✅ Confirmada |
| Provider justifications | ✅ Documentadas |
| No duplicación | ✅ Verificada |

---

## 9. Conclusiones

1. **P4.1R era correcta** - La clasificación de canales es la adecuada
2. **No hay deriva** - GranClaw providers son necesarios porque OpenClaw no tiene esas capabilities
3. **Los channels son stubs** - Necesitan workers reales para funcionar en producción
4. **OpenClaw es limitado** - Solo 3 tools básicos (echo, time, http)
5. **Runtime split claro** - OpenClaw = reasoning/tools, GranClaw = runtime/product

---

## 10. Próximos Pasos

1. Implementar workers reales para cada provider (IMAP, FTP, Playwright, etc.)
2. Conectar api-adapter con runtime-queue
3. Agregar UI para mostrar source en channels
4. Monitorear si OpenClaw añade capabilities para migrar

---

*Reporte generado: 2026-05-07*
