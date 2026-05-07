/**
 * Calendar Channel
 * P3: Real Integrations & Operational Channels
 *
 * Calendar integration (Google Calendar, Outlook, CalDAV).
 */

import type {
  CalendarEvent,
  CalendarReminder
} from '../../channels-runtime/types'
import { emitChannelEvent } from '../../channels-runtime/event-adapter'
import { enqueueChannelAction } from '../../channels-runtime/runtime-integration'
import { getChannel, updateChannelMetrics } from '../../channels-runtime/channel-manager'

/**
 * Calendar channel configuration
 */
export interface CalendarChannelConfig {
  provider: 'google' | 'outlook' | 'caldav'
  calendarId: string
  defaultReminders: number[] // minutes before event
  syncIntervalMs: number
  includeDeclinedEvents: boolean
}

/**
 * Time slot for availability
 */
export interface TimeSlot {
  start: string
  end: string
  isBusy: boolean
  eventTitle?: string
}

/**
 * Create a calendar event
 */
export async function createEvent(
  channelId: string,
  event: Omit<CalendarEvent, 'id' | 'calendarId'>,
  options: {
    userId?: string
    sendInvites?: boolean
  } = {}
): Promise<{ queued: boolean; requestId?: string; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { queued: false, error: 'Channel not found' }
  }

  if (channel.config.type !== 'calendar') {
    return { queued: false, error: 'Not a calendar channel' }
  }

  return enqueueChannelAction(
    channel.config,
    'createEvent',
    { event, sendInvites: options.sendInvites },
    { userId: options.userId }
  )
}

/**
 * Update a calendar event
 */
export async function updateEvent(
  channelId: string,
  eventId: string,
  updates: Partial<Omit<CalendarEvent, 'id' | 'calendarId'>>,
  options: {
    userId?: string
    notifyAttendees?: boolean
  } = {}
): Promise<{ queued: boolean; requestId?: string; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { queued: false, error: 'Channel not found' }
  }

  return enqueueChannelAction(
    channel.config,
    'updateEvent',
    { eventId, updates, notifyAttendees: options.notifyAttendees },
    { userId: options.userId }
  )
}

/**
 * Delete a calendar event
 */
export async function deleteEvent(
  channelId: string,
  eventId: string,
  options: {
    userId?: string
    notifyAttendees?: boolean
  } = {}
): Promise<{ queued: boolean; requestId?: string; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { queued: false, error: 'Channel not found' }
  }

  return enqueueChannelAction(
    channel.config,
    'deleteEvent',
    { eventId, notifyAttendees: options.notifyAttendees },
    { userId: options.userId }
  )
}

/**
 * Get a single event
 */
export async function getEvent(
  channelId: string,
  eventId: string
): Promise<CalendarEvent | null> {
  const channel = getChannel(channelId)
  if (!channel) return null

  // TODO: Implement actual event retrieval
  console.log(`[CalendarChannel] Getting event ${eventId}`)
  return null
}

/**
 * List events in a time range
 */
export async function listEvents(
  channelId: string,
  params: {
    start: string // ISO date
    end: string // ISO date
    maxResults?: number
    orderBy?: 'startTime' | 'updated'
  }
): Promise<CalendarEvent[]> {
  const channel = getChannel(channelId)
  if (!channel) return []

  // TODO: Implement actual event listing
  console.log(`[CalendarChannel] Listing events from ${params.start} to ${params.end}`)
  return []
}

/**
 * Get availability (free/busy)
 */
export async function getAvailability(
  channelId: string,
  params: {
    start: string
    end: string
    slotDurationMinutes?: number
  }
): Promise<TimeSlot[]> {
  const channel = getChannel(channelId)
  if (!channel) return []

  // TODO: Implement actual free/busy lookup
  console.log(`[CalendarChannel] Getting availability from ${params.start} to ${params.end}`)
  return []
}

/**
 * Find available slots for meeting
 */
export async function findAvailableSlots(
  channelId: string,
  params: {
    durationMinutes: number
    startDate: string
    endDate: string
    preferredTimes?: Array<{ dayOfWeek: number; startHour: number; endHour: number }>
    excludeWeekends?: boolean
  }
): Promise<Array<{ start: string; end: string }>> {
  const channel = getChannel(channelId)
  if (!channel) return []

  // Get busy times
  const slots = await getAvailability(channelId, {
    start: params.startDate,
    end: params.endDate,
    slotDurationMinutes: params.durationMinutes
  })

  // Filter to free slots
  return slots
    .filter(s => !s.isBusy)
    .map(s => ({ start: s.start, end: s.end }))
}

/**
 * Get upcoming events (next 24 hours)
 */
export async function getUpcomingEvents(
  channelId: string,
  hoursAhead = 24
): Promise<CalendarEvent[]> {
  const now = new Date()
  const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000)

  return listEvents(channelId, {
    start: now.toISOString(),
    end: future.toISOString(),
    orderBy: 'startTime'
  })
}

/**
 * Get today's events
 */
export async function getTodayEvents(channelId: string): Promise<CalendarEvent[]> {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1)

  return listEvents(channelId, {
    start: startOfDay.toISOString(),
    end: endOfDay.toISOString(),
    orderBy: 'startTime'
  })
}

/**
 * Handle event created (from API/sync)
 */
export async function handleEventCreated(
  channelId: string,
  event: CalendarEvent,
  tenantId: string
): Promise<void> {
  await emitChannelEvent(
    channelId,
    'calendar',
    'calendar:event_created',
    event,
    {
      tenantId,
      metadata: {
        title: event.title,
        start: event.start,
        isAllDay: event.isAllDay
      }
    }
  )

  // Update metrics
  const channel = getChannel(channelId)
  if (channel) {
    updateChannelMetrics(channelId, {
      messagesProcessed: (channel.metrics?.messagesProcessed || 0) + 1
    })
  }

  console.log(`[CalendarChannel] Event created: ${event.title}`)
}

/**
 * Handle event updated
 */
export async function handleEventUpdated(
  channelId: string,
  event: CalendarEvent,
  changes: string[],
  tenantId: string
): Promise<void> {
  await emitChannelEvent(
    channelId,
    'calendar',
    'calendar:event_updated',
    { event, changes },
    {
      tenantId,
      metadata: {
        eventId: event.id,
        title: event.title,
        changedFields: changes
      }
    }
  )

  console.log(`[CalendarChannel] Event updated: ${event.title} (${changes.join(', ')})`)
}

/**
 * Handle reminder triggered
 */
export async function handleReminderTriggered(
  channelId: string,
  event: CalendarEvent,
  reminder: CalendarReminder,
  tenantId: string
): Promise<void> {
  await emitChannelEvent(
    channelId,
    'calendar',
    'calendar:reminder_triggered',
    { event, reminder },
    {
      tenantId,
      metadata: {
        eventId: event.id,
        title: event.title,
        minutesBefore: reminder.minutesBefore
      }
    }
  )

  console.log(`[CalendarChannel] Reminder triggered: ${event.title} in ${reminder.minutesBefore} minutes`)
}

/**
 * Quick add event (natural language)
 */
export async function quickAddEvent(
  channelId: string,
  text: string,
  options: {
    userId?: string
  } = {}
): Promise<{ queued: boolean; requestId?: string; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { queued: false, error: 'Channel not found' }
  }

  // Parse natural language (simplified)
  const parsed = parseNaturalLanguageEvent(text)
  if (!parsed) {
    return { queued: false, error: 'Could not parse event from text' }
  }

  return createEvent(channelId, parsed, options)
}

/**
 * Simple natural language parser for events
 */
function parseNaturalLanguageEvent(
  text: string
): Omit<CalendarEvent, 'id' | 'calendarId'> | null {
  // Very basic parsing - would use proper NLP in production
  const lowerText = text.toLowerCase()

  // Try to extract title and time
  let title = text
  let start = new Date()
  let durationMinutes = 60

  // Check for "manana" (tomorrow)
  if (lowerText.includes('manana') || lowerText.includes('mañana')) {
    start.setDate(start.getDate() + 1)
  }

  // Check for time patterns like "a las 10" or "at 3pm"
  const timeMatch = lowerText.match(/a las? (\d{1,2})(?::(\d{2}))?/i) ||
                    lowerText.match(/at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
  if (timeMatch) {
    let hours = parseInt(timeMatch[1])
    const minutes = parseInt(timeMatch[2]) || 0
    if (timeMatch[3]?.toLowerCase() === 'pm' && hours < 12) hours += 12
    start.setHours(hours, minutes, 0, 0)
  }

  // Remove time words from title
  title = title
    .replace(/manana|mañana/gi, '')
    .replace(/a las? \d{1,2}(:\d{2})?/gi, '')
    .replace(/at \d{1,2}(:\d{2})?\s*(am|pm)?/gi, '')
    .trim()

  if (!title) return null

  const end = new Date(start.getTime() + durationMinutes * 60 * 1000)

  return {
    title,
    start: start.toISOString(),
    end: end.toISOString(),
    isAllDay: false
  }
}

/**
 * Get calendar summary for UI
 */
export function getCalendarSummary(
  channelId: string
): {
  eventsToday: number
  eventsThisWeek: number
  nextEvent?: { title: string; start: string }
  hasConflicts: boolean
} {
  // TODO: Implement actual summary from synced data
  return {
    eventsToday: 0,
    eventsThisWeek: 0,
    hasConflicts: false
  }
}
