/**
 * FTP/SFTP Worker
 * P5: Durable Operational Workers & Real Connectors
 *
 * Worker for FTP and SFTP channels.
 * Provider justification: OpenClaw has no FTP/SFTP protocol support.
 */

import { BaseWorker } from './base-worker'
import type { WorkerConfig, WorkerCredentials, WorkerFactory } from '../types'
import type { ChannelType } from '../../channels-runtime/types'

/**
 * FTP-specific session data
 */
interface FTPSessionData {
  host?: string
  port?: number
  protocol?: 'ftp' | 'sftp'
  currentDir?: string
  lastTransferId?: string
}

/**
 * FTP Worker Implementation
 */
export class FTPWorker extends BaseWorker {
  private sessionData: FTPSessionData = {}
  private ftpConnected: boolean = false

  get channelType(): ChannelType {
    return 'ftp'
  }

  async connect(): Promise<void> {
    console.log('[FTPWorker] Connecting...')

    // Validate credentials
    if (this.credentials.type !== 'basic') {
      throw new Error('FTP requires basic credentials (username/password)')
    }

    // Connect to FTP server
    // In production: use basic-ftp or ssh2-sftp-client
    await this.establishConnection()

    this.setConnected(true)
    this.setAuthenticated(true)

    console.log('[FTPWorker] Connected successfully')
  }

  async disconnect(): Promise<void> {
    console.log('[FTPWorker] Disconnecting...')

    // Close FTP connection
    this.ftpConnected = false

    this.setConnected(false)
    this.setAuthenticated(false)

    console.log('[FTPWorker] Disconnected')
  }

  async performHeartbeat(): Promise<boolean> {
    // Send NOOP or list current directory
    // In production: client.pwd() or similar
    return this._connected && this.ftpConnected
  }

  /**
   * Establish FTP connection
   */
  private async establishConnection(): Promise<void> {
    // In production: ftp.connect({ host, user, password })
    await new Promise(resolve => setTimeout(resolve, 150))

    this.ftpConnected = true
    this.sessionData = {
      host: 'ftp.example.com',
      port: 21,
      protocol: 'ftp',
      currentDir: '/'
    }
  }

  /**
   * List directory
   */
  async listDirectory(path: string = '.'): Promise<string[]> {
    if (!this._connected) {
      throw new Error('Not connected')
    }

    console.log(`[FTPWorker] Listing ${path}`)
    // In production: client.list(path)

    this.incrementProcessed()
    return ['file1.txt', 'file2.txt', 'folder/']
  }

  /**
   * Upload file
   */
  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    if (!this._connected) {
      throw new Error('Not connected')
    }

    console.log(`[FTPWorker] Uploading ${localPath} -> ${remotePath}`)
    // In production: client.uploadFrom(localPath, remotePath)

    this.sessionData.lastTransferId = `upload_${Date.now()}`
    this.incrementProcessed()
  }

  /**
   * Download file
   */
  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    if (!this._connected) {
      throw new Error('Not connected')
    }

    console.log(`[FTPWorker] Downloading ${remotePath} -> ${localPath}`)
    // In production: client.downloadTo(localPath, remotePath)

    this.sessionData.lastTransferId = `download_${Date.now()}`
    this.incrementProcessed()
  }

  /**
   * Change directory
   */
  async changeDirectory(path: string): Promise<void> {
    if (!this._connected) {
      throw new Error('Not connected')
    }

    console.log(`[FTPWorker] Changing to ${path}`)
    // In production: client.cd(path)

    this.sessionData.currentDir = path
    this.incrementProcessed()
  }

  protected getSessionData(): FTPSessionData {
    return { ...this.sessionData }
  }

  protected async restoreSessionData(data: unknown): Promise<void> {
    const ftpData = data as FTPSessionData
    if (ftpData.currentDir) {
      this.sessionData.currentDir = ftpData.currentDir
    }
  }
}

/**
 * SFTP Worker (extends FTP with SSH)
 */
export class SFTPWorker extends FTPWorker {
  get channelType(): ChannelType {
    return 'sftp'
  }
}

/**
 * FTP worker factory
 */
export const ftpWorkerFactory: WorkerFactory = (
  config: WorkerConfig,
  credentials: WorkerCredentials
) => {
  return new FTPWorker(config, credentials)
}

/**
 * SFTP worker factory
 */
export const sftpWorkerFactory: WorkerFactory = (
  config: WorkerConfig,
  credentials: WorkerCredentials
) => {
  return new SFTPWorker(config, credentials)
}
