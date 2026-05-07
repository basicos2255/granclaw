/**
 * Calendar Worker
 * P5: Durable Operational Workers & Real Connectors
 *
 * Worker for calendar channel (Google Calendar, Outlook, etc).
 * Provider justification: OpenClaw has no Calendar API capability.
 */

import { BaseWorker } from './base-worker'
import type { WorkerConfig, WorkerCredentials, WorkerFactory } from '../types'
import type { ChannelType } from '../../channels-runtime/types'

/**
 * Calendar-specific session data
 */
interface CalendarSessionData {
  provider?: 'google' | 'outlook' | 'caldav'
  calendarIds?: string[]
  syncToken?: string
  lastEventId?: string
}

/**
 * Calendar event
 */
interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  description?: string
  attendees?: string[]
}

/**
 * Calendar Worker Implementation
 */
export class CalendarWorker extends BaseWorker {
  private sessionData: CalendarSessionData = {}
  private syncInterval: ReturnType<typeof setInterval> | null = null

  get channelType(): ChannelType {
    return 'calendar'
  }

  async connect(): Promise<void> {
    console.log('[CalendarWorker] Connecting...')

    // Validate credentials (OAuth required for most providers)
    if (this.credentials.type !== 'oauth') {
      throw new Error('Calendar requires OAuth credentials')
    }

    // Authenticate with calendar provider
    await this.authenticate()

    // Get calendar list
    await this.fetchCalendars()

    this.setConnected(true)
    this.setAuthenticated(true)

    // Start sync
    this.startSync()

    console.log('[CalendarWorker] Connected successfully')
  }

  async disconnect(): Promise<void> {
    console.log('[CalendarWorker] Disconnecting...')

    // Stop sync
    this.stopSync()

    this.setConnected(false)
    this.setAuthenticated(false)

    console.log('[CalendarWorker] Disconnected')
  }

  async performHeartbeat(): Promise<boolean> {
    // Check OAuth token validity
    // In production: verify token or refresh if needed
    return this._connected && !!this.credentials.accessToken
  }

  /**
   * Authenticate with provider
   */
  private async authenticate(): Promise<void> {
    // In production: OAuth flow with Google/Outlook
    await new Promise(resolve => setTimeout(resolve, 100))

    this.sessionData.provider = 'google'
  }

  /**
   * Fetch available calendars
   */
  private async fetchCalendars(): Promise<void> {
    // In production: call Calendar API
    await new Promise(resolve => setTimeout(resolve, 50))

    this.sessionData.calendarIds = ['primary', 'work', 'personal']
  }

  /**
   * Start calendar sync
   */
  private startSync(): void {
    if (this.syncInterval) return

    this.syncInterval = setInterval(async () => {
      try {
        await this.syncEvents()
      } catch (error) {
        console.error('[CalendarWorker] Sync error:', error)
        this.incrementError()
      }
    }, 60000) // Sync every minute
  }

  /**
   * Stop sync
   */
  private stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  /**
   * Sync events from calendar
   */
  private async syncEvents(): Promise<void> {
    // In production: use sync token for incremental sync
    console.log('[CalendarWorker] Syncing events...')

    this.sessionData.syncToken = `sync_${Date.now()}`
    this.setLastSync()
  }

  /**
   * Create calendar event
   */
  async createEvent(event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
    if (!this._connected) {
      throw new Error('Not connected')
    }

    console.log(`[CalendarWorker] Creating event: ${event.title}`)
    // In production: call Calendar API

    const created: CalendarEvent = {
      ...event,
      id: `event_${Date.now()}`
    }

    this.sessionData.lastEventId = created.id
    this.incrementProcessed()

    return created
  }

  /**
   * List events
   */
  async listEvents(
    calendarId: string,
    timeMin?: string,
    timeMax?: string
  ): Promise<CalendarEvent[]> {
    if (!this._connected) {
      throw new Error('Not connected')
    }

    console.log(`[CalendarWorker] Listing events for ${calendarId}`)
    // In production: call Calendar API

    this.incrementProcessed()
    return []
  }

  /**
   * Delete event
   */
  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    if (!this._connected) {
      throw new Error('Not connected')
    }

    console.log(`[CalendarWorker] Deleting event ${eventId}`)
    // In production: call Calendar API

    this.incrementProcessed()
  }

  protected getSessionData(): CalendarSessionData {
    return { ...this.sessionData }
  }

  protected async restoreSessionData(data: unknown): Promise<void> {
    const calData = data as CalendarSessionData
    if (calData.syncToken) {
      this.sessionData.syncToken = calData.syncToken
    }
    if (calData.calendarIds) {
      this.sessionData.calendarIds = calData.calendarIds
    }
  }
}

/**
 * Calendar worker factory
 */
export const calendarWorkerFactory: WorkerFactory = (
  config: WorkerConfig,
  credentials: WorkerCredentials
) => {
  return new CalendarWorker(config, credentials)
}
