import type { HealthStatus } from './types'

const startTime = Date.now()

export function getHealth(): HealthStatus {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    uptime: Math.floor((Date.now() - startTime) / 1000)
  }
}
