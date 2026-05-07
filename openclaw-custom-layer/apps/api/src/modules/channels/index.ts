/**
 * Channels Module
 * P3: Real Integrations & Operational Channels
 *
 * Main entry point for all channel implementations.
 */

// Re-export channel-specific modules
export * as email from './email'
export * as ftp from './ftp'
export * as browser from './browser'
export * as whatsapp from './whatsapp'
export * as calendar from './calendar'

// Re-export runtime
export * from '../channels-runtime'
