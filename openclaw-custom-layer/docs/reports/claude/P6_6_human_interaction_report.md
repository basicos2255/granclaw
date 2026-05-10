# P6.6 - Human Interaction Layer, Task Threads & Conversational Control

**Fecha:** 2026-05-10
**Autor:** Claude
**Estado:** Completado

---

## Resumen Ejecutivo

P6.6 implementa la Human Interaction Layer para GranClaw, transformando las tareas de simples jobs a conversaciones contextuales con el usuario. El sistema ahora soporta:

- **Task Threads**: Conversaciones asociadas a tareas
- **Human Task States**: 10 estados descriptivos (vs 6 tecnicos)
- **Contextual Continuation**: "continua", "pausa", "hazlo con Safari"
- **Thread Memory**: Preferencias, filtros, decisiones por thread
- **Approval Conversations**: Aprobaciones conversacionales
- **Conversational Task Page**: UI de chat para tareas

---

## Arquitectura

### Backend (Task Threads Module)

```
apps/api/src/modules/task-threads/
├── types.ts      # TaskThread, ThreadMessage, HumanTaskState
├── service.ts    # CRUD, messages, approvals, context
├── handlers.ts   # HTTP handlers nativos
└── index.ts      # Exports
```

### Frontend (Thread Components)

```
apps/web/src/components/threads/
├── ThreadTimeline.tsx        # Mensajes conversacionales
├── ThreadChatInput.tsx       # Input de chat
├── HumanTaskStateBadge.tsx   # Badge de estado
└── index.ts                  # Exports
```

---

## TaskThread Model

```typescript
interface TaskThread {
  id: string
  taskId?: string
  workflowId?: string
  tenantId: string
  title: string
  status: HumanTaskState
  messages: ThreadMessage[]
  activeContext: ThreadContext
  currentPlan?: HumanReadablePlan
  lastUserIntent?: string
  pendingApprovals: PendingApproval[]
  createdAt: string
  updatedAt: string
  lastActivityAt: string
}
```

---

## Human Task States

| Estado | Label UI | Cuando |
|--------|----------|--------|
| thinking | Pensando... | AI analizando |
| queued | En cola | Esperando recursos |
| executing | Ejecutando | Corriendo pasos |
| waiting_approval | Esperando aprobacion | Necesita OK |
| waiting_user_input | Esperando respuesta | Necesita info |
| paused | Pausada | Usuario pauso |
| completed | Completada | Exito |
| failed | Fallida | Error |
| needs_repair | Requiere reparacion | Troubleshooting |
| cancelled | Cancelada | Usuario cancelo |

---

## Contextual Continuation

El sistema detecta intent del usuario:

```typescript
"continua" → continue
"pausa" → pause
"si" / "apruebo" → approve
"no" / "rechaza" → reject
"usa Chrome" → refine (extract preference)
"solo gratuito" → refine (extract filter)
```

---

## Thread Memory

```typescript
interface ThreadContext {
  preferences: Record<string, string | number | boolean>
  filters: string[]  // ["free_only", "no_ads", "secure"]
  decisions: Array<{key, value, reason, timestamp}>
  entities: Array<{type, name, firstMentioned}>
}
```

---

## API Endpoints

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | /threads | Listar threads |
| GET | /threads/active | Thread activo |
| GET | /threads/:id | Detalle thread |
| GET | /threads/by-task/:taskId | Thread por tarea |
| POST | /threads | Crear thread |
| POST | /threads/:id/messages | Enviar mensaje |
| POST | /threads/:id/pause | Pausar |
| POST | /threads/:id/resume | Reanudar |
| POST | /threads/:id/cancel | Cancelar |
| POST | /threads/:id/plan | Establecer plan |
| POST | /threads/:id/refine | Refinar plan |
| POST | /threads/:id/approvals | Crear aprobacion |
| POST | /threads/:id/approvals/:id/resolve | Resolver aprobacion |

---

## Conversational Task Page

La pagina `/tasks/:id` ahora usa `ConversationalTaskDetail` con:

1. **Vista Conversacional** (default)
   - Timeline de mensajes
   - Chat input con quick actions
   - Plan section
   - Approval buttons

2. **Vista Tecnica** (toggle)
   - Summary
   - Outputs/Artifacts
   - Execution Trace

---

## Verificaciones

| Check | Estado |
|-------|--------|
| npm run check (api) | PASS |
| npm run check (web) | PASS |
| npm run build (api) | PASS |
| npm run build (web) | PASS |
| TypeScript strict | PASS |

---

## Archivos Modificados

### Backend

| Archivo | Cambio |
|---------|--------|
| `modules/task-threads/*` | CREATED |
| `index.ts` | Added thread routes |

### Frontend

| Archivo | Cambio |
|---------|--------|
| `components/threads/*` | CREATED |
| `pages/product/ConversationalTaskDetail.tsx` | CREATED |
| `pages/product/index.ts` | Export added |
| `services/api.ts` | Thread types + API functions |
| `App.tsx` | Route updated |

---

## Persistencia

Los threads se persisten en:
```
data/task-threads.json
```

Con estructura:
```json
{
  "version": 1,
  "threads": [...],
  "lastUpdated": "...",
  "stats": {...}
}
```

---

## Ejemplo de Flujo

1. Usuario crea tarea: "Instala OBS Studio"
2. Sistema crea thread con mensaje inicial
3. GranClaw responde con plan
4. Usuario dice "solo gratuito"
5. Sistema extrae filtro, refina plan
6. Ejecucion comienza
7. Sistema pide aprobacion: "Descargar de obsproject.com?"
8. Usuario dice "si"
9. Sistema continua
10. Thread queda como historial

---

## Siguientes Pasos

1. Integracion con AI para generacion de planes
2. Real-time WS updates para timeline
3. Download artifacts desde UI
4. Correlacion con workflow steps reales
