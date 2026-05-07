/**
 * Channel Workers
 * P5: Durable Operational Workers & Real Connectors
 *
 * Exports all worker implementations and factories.
 */

// Base
export { BaseWorker } from './base-worker'

// Workers
export { EmailWorker, emailWorkerFactory } from './email-worker'
export { WhatsAppWorker, whatsappWorkerFactory } from './whatsapp-worker'
export { BrowserWorker, browserWorkerFactory } from './browser-worker'
export { FTPWorker, SFTPWorker, ftpWorkerFactory, sftpWorkerFactory } from './ftp-worker'
export { CalendarWorker, calendarWorkerFactory } from './calendar-worker'
export { FilesystemWorker, filesystemWorkerFactory } from './filesystem-worker'

// All factories map
import type { ChannelType } from '../../channels-runtime/types'
import type { WorkerFactory } from '../types'
import { emailWorkerFactory } from './email-worker'
import { whatsappWorkerFactory } from './whatsapp-worker'
import { browserWorkerFactory } from './browser-worker'
import { ftpWorkerFactory, sftpWorkerFactory } from './ftp-worker'
import { calendarWorkerFactory } from './calendar-worker'
import { filesystemWorkerFactory } from './filesystem-worker'

/**
 * All worker factories by channel type
 */
export const workerFactories: Map<ChannelType, WorkerFactory> = new Map([
  ['email', emailWorkerFactory],
  ['whatsapp', whatsappWorkerFactory],
  ['browser', browserWorkerFactory],
  ['ftp', ftpWorkerFactory],
  ['sftp', sftpWorkerFactory],
  ['calendar', calendarWorkerFactory],
  ['filesystem', filesystemWorkerFactory]
])

/**
 * Register all worker factories
 */
export function registerAllWorkerFactories(
  registerFn: (channelType: ChannelType, factory: WorkerFactory) => void
): void {
  for (const [channelType, factory] of workerFactories) {
    registerFn(channelType, factory)
  }
}

/**
 * Get available worker types
 */
export function getAvailableWorkerTypes(): ChannelType[] {
  return Array.from(workerFactories.keys())
}
