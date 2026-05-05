export interface WebhookEvent {
  id: string
  type: string
  payload: unknown
  timestamp: Date
}

export interface WebhookSubscription {
  id: string
  tenantId: string
  url: string
  events: string[]
  active: boolean
  secret?: string
}

export interface WebhookAdapter {
  subscribe(tenantId: string, url: string, events: string[]): Promise<WebhookSubscription>
  unsubscribe(subscriptionId: string): Promise<void>
  listSubscriptions(tenantId: string): Promise<WebhookSubscription[]>
  handleIncoming(event: WebhookEvent): Promise<void>
  verifySignature(payload: string, signature: string, secret: string): boolean
}
