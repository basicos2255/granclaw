import type {
  WebhookAdapter,
  WebhookEvent,
  WebhookSubscription
} from '@granclaw/core'

/**
 * OpenClaw Webhook Adapter - Skeleton
 * Implementación vacía del contrato WebhookAdapter
 */
export class OpenClawWebhookAdapter implements WebhookAdapter {
  async subscribe(tenantId: string, url: string, events: string[]): Promise<WebhookSubscription> {
    // TODO: Implementar suscripción real
    return {
      id: '',
      tenantId,
      url,
      events,
      active: true
    }
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    // TODO: Implementar desuscripción real
  }

  async listSubscriptions(tenantId: string): Promise<WebhookSubscription[]> {
    // TODO: Implementar listado real
    return []
  }

  async handleIncoming(event: WebhookEvent): Promise<void> {
    // TODO: Implementar manejo real de eventos
  }

  verifySignature(payload: string, signature: string, secret: string): boolean {
    // TODO: Implementar verificación real
    return false
  }
}
