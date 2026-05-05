/**
 * Sandbox Filesystem
 * FEATURE 100: Real Capabilities v1 - Secure sandbox for file operations
 *
 * Security rules:
 * - All operations restricted to sandbox directory
 * - Path traversal prevention (no ../)
 * - File size limit: 1MB
 * - No code execution
 * - Audit logging
 */

import * as fs from 'fs'
import * as path from 'path'

// Sandbox directory (relative to process.cwd())
const SANDBOX_DIR = path.join(process.cwd(), 'data', 'sandbox')
const MAX_FILE_SIZE = 1024 * 1024 // 1MB

// Allowed file extensions (no executable code)
const ALLOWED_EXTENSIONS = ['.txt', '.md', '.json', '.csv', '.log', '.xml', '.html', '.css']

export interface SandboxResult {
  success: boolean
  error?: string
  data?: string
  filePath?: string
  files?: SandboxFileInfo[]
}

export interface SandboxFileInfo {
  name: string
  path: string
  size: number
  createdAt: string
  modifiedAt: string
  isDirectory: boolean
}

/**
 * Ensures sandbox directory exists
 */
function ensureSandboxDir(): void {
  if (!fs.existsSync(SANDBOX_DIR)) {
    fs.mkdirSync(SANDBOX_DIR, { recursive: true })
  }
}

/**
 * Validates and normalizes a path within sandbox
 * Returns null if path is invalid or outside sandbox
 */
function validatePath(inputPath: string): string | null {
  // Remove leading/trailing whitespace
  const cleanPath = inputPath.trim()

  // Block obvious path traversal
  if (cleanPath.includes('..') || cleanPath.includes('~')) {
    return null
  }

  // Block absolute paths
  if (path.isAbsolute(cleanPath)) {
    return null
  }

  // Normalize and resolve
  const resolved = path.resolve(SANDBOX_DIR, cleanPath)

  // Verify it's still within sandbox
  if (!resolved.startsWith(SANDBOX_DIR)) {
    return null
  }

  return resolved
}

/**
 * Validates file extension
 */
function validateExtension(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return ext === '' || ALLOWED_EXTENSIONS.includes(ext)
}

/**
 * Generates a unique filename if file exists
 */
function generateUniqueFilename(basePath: string): string {
  if (!fs.existsSync(basePath)) {
    return basePath
  }

  const dir = path.dirname(basePath)
  const ext = path.extname(basePath)
  const name = path.basename(basePath, ext)

  let counter = 1
  let newPath = basePath

  while (fs.existsSync(newPath)) {
    newPath = path.join(dir, `${name}_${counter}${ext}`)
    counter++
    if (counter > 1000) {
      throw new Error('Too many files with same name')
    }
  }

  return newPath
}

/**
 * Reads a file from sandbox
 */
export function readFile(filePath: string): SandboxResult {
  try {
    ensureSandboxDir()

    const validPath = validatePath(filePath)
    if (!validPath) {
      return { success: false, error: 'Invalid path: access denied' }
    }

    if (!fs.existsSync(validPath)) {
      return { success: false, error: 'File not found' }
    }

    const stats = fs.statSync(validPath)
    if (stats.isDirectory()) {
      return { success: false, error: 'Cannot read directory as file' }
    }

    if (stats.size > MAX_FILE_SIZE) {
      return { success: false, error: 'File too large (max 1MB)' }
    }

    const content = fs.readFileSync(validPath, 'utf-8')
    const relativePath = path.relative(SANDBOX_DIR, validPath)

    return {
      success: true,
      data: content,
      filePath: relativePath
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error reading file'
    }
  }
}

/**
 * Writes a file to sandbox
 */
export function writeFile(filePath: string, content: string, overwrite = false): SandboxResult {
  try {
    ensureSandboxDir()

    const validPath = validatePath(filePath)
    if (!validPath) {
      return { success: false, error: 'Invalid path: access denied' }
    }

    if (!validateExtension(validPath)) {
      return { success: false, error: 'File extension not allowed' }
    }

    // Check content size
    const contentSize = Buffer.byteLength(content, 'utf-8')
    if (contentSize > MAX_FILE_SIZE) {
      return { success: false, error: 'Content too large (max 1MB)' }
    }

    // Ensure parent directory exists
    const dir = path.dirname(validPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Handle existing file
    let finalPath = validPath
    if (!overwrite && fs.existsSync(validPath)) {
      finalPath = generateUniqueFilename(validPath)
    }

    fs.writeFileSync(finalPath, content, 'utf-8')
    const relativePath = path.relative(SANDBOX_DIR, finalPath)

    return {
      success: true,
      filePath: relativePath,
      data: content
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error writing file'
    }
  }
}

/**
 * Lists files in sandbox directory
 */
export function listFiles(subPath = ''): SandboxResult {
  try {
    ensureSandboxDir()

    let targetDir = SANDBOX_DIR
    if (subPath) {
      const validPath = validatePath(subPath)
      if (!validPath) {
        return { success: false, error: 'Invalid path: access denied' }
      }
      targetDir = validPath
    }

    if (!fs.existsSync(targetDir)) {
      return { success: true, files: [] }
    }

    const stats = fs.statSync(targetDir)
    if (!stats.isDirectory()) {
      return { success: false, error: 'Path is not a directory' }
    }

    const entries = fs.readdirSync(targetDir, { withFileTypes: true })
    const files: SandboxFileInfo[] = []

    for (const entry of entries) {
      const entryPath = path.join(targetDir, entry.name)
      const entryStats = fs.statSync(entryPath)
      const relativePath = path.relative(SANDBOX_DIR, entryPath)

      files.push({
        name: entry.name,
        path: relativePath,
        size: entryStats.size,
        createdAt: entryStats.birthtime.toISOString(),
        modifiedAt: entryStats.mtime.toISOString(),
        isDirectory: entry.isDirectory()
      })
    }

    // Sort: directories first, then by name
    files.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })

    return { success: true, files }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error listing files'
    }
  }
}

/**
 * Deletes a file from sandbox (optional, for future use)
 */
export function deleteFile(filePath: string): SandboxResult {
  try {
    ensureSandboxDir()

    const validPath = validatePath(filePath)
    if (!validPath) {
      return { success: false, error: 'Invalid path: access denied' }
    }

    if (!fs.existsSync(validPath)) {
      return { success: false, error: 'File not found' }
    }

    const stats = fs.statSync(validPath)
    if (stats.isDirectory()) {
      return { success: false, error: 'Cannot delete directory' }
    }

    fs.unlinkSync(validPath)
    const relativePath = path.relative(SANDBOX_DIR, validPath)

    return { success: true, filePath: relativePath }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error deleting file'
    }
  }
}

/**
 * Gets file info without reading content
 */
export function getFileInfo(filePath: string): SandboxResult & { info?: SandboxFileInfo } {
  try {
    ensureSandboxDir()

    const validPath = validatePath(filePath)
    if (!validPath) {
      return { success: false, error: 'Invalid path: access denied' }
    }

    if (!fs.existsSync(validPath)) {
      return { success: false, error: 'File not found' }
    }

    const stats = fs.statSync(validPath)
    const relativePath = path.relative(SANDBOX_DIR, validPath)

    return {
      success: true,
      filePath: relativePath,
      info: {
        name: path.basename(validPath),
        path: relativePath,
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString(),
        isDirectory: stats.isDirectory()
      }
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error getting file info'
    }
  }
}

/**
 * Gets sandbox directory path (for logging/audit)
 */
export function getSandboxPath(): string {
  return SANDBOX_DIR
}
