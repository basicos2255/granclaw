import type { IncomingMessage, ServerResponse } from 'http'
import { ok } from '../../shared/response'
import { getHealth } from './service'

export function handleHealth(_req: IncomingMessage, res: ServerResponse): void {
  ok(res, getHealth())
}
