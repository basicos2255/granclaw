# P5.3 — WebSocket Subscription Registry Consistency

**Fecha:** 2026-05-07
**Autor:** Claude (Arquitecto Enterprise)
**Estado:** COMPLETADO

## Objetivo Ejecutado

Corregir error `SUBSCRIPTION_NOT_FOUND` que aparecía en consola al cambiar de página o durante cleanup.

## Error Observado

```
[RuntimeWs] Connected
[useRuntimeWs] Auto-connected
Server error: SUBSCRIPTION_NOT_FOUND
Subscription not found
```

## Causa Raíz

**Mismatch de subscriptionId entre frontend y backend:**

1. Frontend genera `subscription.id` local: `sub_${Date.now()}_...`
2. Backend genera su propio `subscription.id`: `msg_${Date.now()}_...`
3. Backend **NO devolvía** el subscriptionId en el ACK de subscribe
4. Frontend usaba su ID local al hacer unsubscribe
5. Backend no encontraba ese ID → `SUBSCRIPTION_NOT_FOUND`

## Frontend Subscriptions Audit

| Hook | Canal | Eventos |
|------|-------|---------|
| `useRuntimeEvents` | Configurable | Configurable |
| `useWorkflowEvents` | workflow | todos |
| `useQueueEvents` | queue | todos |
| `useNotificationEvents` | notifications | notification:* |
| `useApprovalEvents` | notifications | approval:* |

**Canales usados**: `runtime`, `queue`, `workflow`, `notifications`, `debug`

## Backend Subscriptions Audit

| Canal | Soporte |
|-------|---------|
| `runtime` | ✓ |
| `queue` | ✓ |
| `workflow` | ✓ (con workflowId) |
| `notifications` | ✓ |
| `debug` | ✓ (configurable) |

**No hay canal `tasks`** - frontend usa `queue` para eventos de tasks.

## Registry Canónico

```typescript
// Canales válidos
export type WsChannel =
  | 'runtime'       // global runtime events
  | 'queue'         // queue/job events
  | 'workflow'      // workflow-specific events
  | 'notifications' // user notifications
  | 'debug'         // debug events
```

## Unsubscribe Idempotente

### Backend (gateway.ts)

```typescript
private handleUnsubscribe(client: WsClientInfo, frame: WsFrame): void {
  const subscriptionId = (frame.payload as { subscriptionId?: string })?.subscriptionId
  if (!subscriptionId) {
    // P5.3: No subscriptionId? Just ack silently
    this.sendToClient(client, createAckFrame(frame.id, true, 'Unsubscribe no-op'))
    return
  }

  const removed = this.subscriptions.removeSubscription(subscriptionId)

  // P5.3: Always return success for idempotent unsubscribe
  if (removed) {
    this.sendToClient(client, createAckFrame(frame.id, true, 'Unsubscribed'))
  } else {
    console.debug(`[RuntimeWsGateway] Unsubscribe no-op: ${subscriptionId}`)
    this.sendToClient(client, createAckFrame(frame.id, true, 'Unsubscribe no-op'))
  }
}
```

### Frontend (runtime-ws.ts)

```typescript
// Subscription ahora incluye serverSubscriptionId
interface Subscription {
  id: string
  channel: WsChannel
  serverSubscriptionId?: string  // P5.3: Backend-assigned ID
  pendingSubscribeId?: string    // P5.3: For ACK correlation
  ...
}

// handleAck actualiza serverSubscriptionId
private handleAck(frame: WsFrame): void {
  const payload = frame.payload as {
    originalId: string
    subscriptionId?: string
    channel?: string
    ...
  }

  if (payload.subscriptionId && payload.channel) {
    for (const subscription of this.subscriptions.values()) {
      if (subscription.pendingSubscribeId === payload.originalId) {
        subscription.serverSubscriptionId = payload.subscriptionId
        break
      }
    }
  }
  ...
}

// sendUnsubscribe usa serverSubscriptionId
private sendUnsubscribe(subscriptionId: string, serverSubscriptionId?: string): void {
  const idToSend = serverSubscriptionId || subscriptionId
  ...
}
```

## Reconnect Consistency

```typescript
private resubscribeAll(): void {
  for (const subscription of this.subscriptions.values()) {
    // P5.3: Clear server ID from previous connection
    subscription.serverSubscriptionId = undefined
    this.sendSubscribe(subscription)
  }
}
```

## Error Handling

Frontend ahora trata estos errores como non-fatal:
- `SUBSCRIPTION_NOT_FOUND`
- `MISSING_SUBSCRIPTION_ID`

```typescript
private handleError(frame: WsFrame): void {
  const nonFatalCodes = ['SUBSCRIPTION_NOT_FOUND', 'MISSING_SUBSCRIPTION_ID']
  if (nonFatalCodes.includes(payload.code)) {
    console.debug('[RuntimeWs] Non-fatal:', payload.code)
  } else {
    console.error('[RuntimeWs] Server error:', payload.code)
  }
  ...
}
```

## Casos Probados

| Caso | Resultado |
|------|-----------|
| Abrir /tasks → WS connected | ✓ Sin error |
| Cambiar de página → cleanup | ✓ Unsubscribe idempotente |
| React StrictMode double mount | ✓ Sin error |
| Backend recibe unknown channel | ✓ Error controlado |
| Reconnect WS | ✓ Re-subscribe correcto |

## npm run check

```bash
$ npm run check
✓ @granclaw/api check
✓ @granclaw/web check
✓ @granclaw/core check
✓ @granclaw/openclaw-adapter check
```

## npm run build

```bash
$ npm run build
✓ @granclaw/api build
✓ @granclaw/web build (383.14 kB)
✓ @granclaw/core build
✓ @granclaw/openclaw-adapter build
```

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `apps/api/src/modules/runtime-ws/serializer.ts` | + `createSubscriptionAckFrame()` |
| `apps/api/src/modules/runtime-ws/gateway.ts` | Unsubscribe idempotente, subscribe devuelve subscriptionId |
| `apps/web/src/services/runtime-ws.ts` | serverSubscriptionId tracking, error handling non-fatal |

## Estado PROJECT_MEMORY.md

Pendiente actualizar con P5.3.

## Conclusión

El error `SUBSCRIPTION_NOT_FOUND` ha sido corregido:

1. Backend ahora devuelve `subscriptionId` en ACK de subscribe
2. Frontend almacena y usa el `serverSubscriptionId` para unsubscribe
3. Unsubscribe es idempotente - no produce error si subscription no existe
4. Errores de subscription tratados como non-fatal durante cleanup
5. Reconnect limpia IDs antiguos antes de re-subscribe
