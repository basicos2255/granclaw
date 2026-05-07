/**
 * Workflow Validators
 * FEATURE 130.3: Validated Workflows & Artifact Verification
 *
 * Individual validators for different artifact types.
 */

import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import type { ValidationResult, ValidationType } from './types'

const execAsync = promisify(exec)

/**
 * Common download paths by platform
 */
const DOWNLOAD_PATHS: Record<string, string[]> = {
  win32: [
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'Downloads') : '',
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'Desktop') : ''
  ].filter(Boolean),
  darwin: [
    process.env.HOME ? path.join(process.env.HOME, 'Downloads') : '',
    process.env.HOME ? path.join(process.env.HOME, 'Desktop') : ''
  ].filter(Boolean),
  linux: [
    process.env.HOME ? path.join(process.env.HOME, 'Downloads') : '',
    process.env.HOME ? path.join(process.env.HOME, 'Desktop') : ''
  ].filter(Boolean)
}

/**
 * App installation paths by platform
 */
const APP_PATHS: Record<string, string[]> = {
  win32: [
    'C:\\Program Files',
    'C:\\Program Files (x86)',
    process.env.LOCALAPPDATA || ''
  ].filter(Boolean),
  darwin: [
    '/Applications',
    process.env.HOME ? path.join(process.env.HOME, 'Applications') : ''
  ].filter(Boolean),
  linux: [
    '/usr/bin',
    '/usr/local/bin',
    '/opt',
    process.env.HOME ? path.join(process.env.HOME, '.local/bin') : ''
  ].filter(Boolean)
}

/**
 * Normalize app name for search
 */
function normalizeAppName(name: string): string[] {
  const base = name.toLowerCase().trim()
  const variants = [base]

  // Common variations
  const mappings: Record<string, string[]> = {
    'chrome': ['google chrome', 'chromium', 'chrome'],
    'vscode': ['visual studio code', 'code', 'vscode'],
    'vlc': ['vlc media player', 'vlc'],
    'firefox': ['mozilla firefox', 'firefox'],
    'spotify': ['spotify'],
    'slack': ['slack'],
    'discord': ['discord'],
    'notepad++': ['notepad++', 'notepadplusplus']
  }

  if (mappings[base]) {
    variants.push(...mappings[base])
  }

  return [...new Set(variants)]
}

/**
 * Create base validation result
 */
function createResult(
  ok: boolean,
  validationType: ValidationType,
  reason?: string,
  evidence: string[] = [],
  warnings: string[] = []
): ValidationResult {
  return {
    ok,
    validationType,
    reason,
    evidence,
    warnings,
    checkedAt: new Date().toISOString()
  }
}

/**
 * Validate downloaded file exists and is valid
 */
export async function validateDownloadedFile(
  filename: string,
  options?: {
    expectedType?: string
    downloadPath?: string
    minSize?: number
  }
): Promise<ValidationResult> {
  const startTime = Date.now()
  const platform = process.platform
  const searchPaths = options?.downloadPath
    ? [options.downloadPath]
    : DOWNLOAD_PATHS[platform] || []

  const evidence: string[] = []
  const warnings: string[] = []

  // Normalize filename (handle partial names)
  const filenameLower = filename.toLowerCase()
  const filePatterns = [
    filename,
    filenameLower,
    filenameLower.replace(/\s+/g, '_'),
    filenameLower.replace(/\s+/g, '-')
  ]

  for (const searchPath of searchPaths) {
    if (!fs.existsSync(searchPath)) continue

    try {
      const files = fs.readdirSync(searchPath)

      for (const file of files) {
        const fileLower = file.toLowerCase()

        // Check if file matches any pattern
        const matches = filePatterns.some(pattern =>
          fileLower.includes(pattern) ||
          fileLower.startsWith(pattern.split('.')[0])
        )

        if (matches) {
          const fullPath = path.join(searchPath, file)
          const stats = fs.statSync(fullPath)

          // Check file size
          const minSize = options?.minSize || 1024 // Default 1KB minimum
          if (stats.size < minSize) {
            warnings.push(`Archivo encontrado pero muy pequeño: ${stats.size} bytes`)
            continue
          }

          // Check for temp/partial indicators
          if (fileLower.endsWith('.tmp') ||
              fileLower.endsWith('.partial') ||
              fileLower.endsWith('.crdownload') ||
              fileLower.endsWith('.part')) {
            warnings.push(`Archivo parece incompleto: ${file}`)
            continue
          }

          // Check expected type if provided
          if (options?.expectedType) {
            const ext = path.extname(file).toLowerCase()
            if (!ext.includes(options.expectedType.toLowerCase())) {
              warnings.push(`Extensión inesperada: ${ext} (esperado: ${options.expectedType})`)
            }
          }

          evidence.push(`Archivo encontrado: ${fullPath}`)
          evidence.push(`Tamaño: ${stats.size} bytes`)
          evidence.push(`Modificado: ${stats.mtime.toISOString()}`)

          const result = createResult(true, 'file_downloaded', 'Archivo descargado verificado', evidence, warnings)
          result.durationMs = Date.now() - startTime
          result.artifactType = 'file'
          result.target = filename
          return result
        }
      }
    } catch (err) {
      warnings.push(`Error leyendo ${searchPath}: ${err instanceof Error ? err.message : 'Unknown'}`)
    }
  }

  const result = createResult(
    false,
    'file_downloaded',
    `Archivo no encontrado: ${filename}`,
    evidence,
    warnings
  )
  result.durationMs = Date.now() - startTime
  result.artifactType = 'file'
  result.target = filename
  return result
}

/**
 * Validate application is installed
 */
export async function validateInstalledApplication(
  appName: string,
  options?: {
    platform?: string
    checkPath?: string
  }
): Promise<ValidationResult> {
  const startTime = Date.now()
  const platform = options?.platform || process.platform
  const evidence: string[] = []
  const warnings: string[] = []
  const appVariants = normalizeAppName(appName)

  try {
    if (platform === 'win32') {
      // Windows: Check common paths and registry
      for (const appPath of APP_PATHS.win32) {
        if (!fs.existsSync(appPath)) continue

        try {
          const dirs = fs.readdirSync(appPath)
          for (const dir of dirs) {
            const dirLower = dir.toLowerCase()
            if (appVariants.some(v => dirLower.includes(v))) {
              const fullPath = path.join(appPath, dir)
              evidence.push(`Instalación encontrada: ${fullPath}`)

              const result = createResult(true, 'app_installed', 'Aplicación instalada verificada', evidence, warnings)
              result.durationMs = Date.now() - startTime
              result.artifactType = 'app'
              result.target = appName
              return result
            }
          }
        } catch {
          // Continue to next path
        }
      }

      // Try 'where' command
      for (const variant of appVariants) {
        try {
          const { stdout } = await execAsync(`where ${variant} 2>nul`, { timeout: 5000 })
          if (stdout.trim()) {
            evidence.push(`Ejecutable encontrado: ${stdout.trim()}`)
            const result = createResult(true, 'app_installed', 'Aplicación instalada verificada', evidence, warnings)
            result.durationMs = Date.now() - startTime
            result.artifactType = 'app'
            result.target = appName
            return result
          }
        } catch {
          // Command failed, continue
        }
      }
    } else if (platform === 'darwin') {
      // macOS: Check /Applications and use open -Ra
      for (const appPath of APP_PATHS.darwin) {
        if (!fs.existsSync(appPath)) continue

        try {
          const apps = fs.readdirSync(appPath)
          for (const app of apps) {
            const appLower = app.toLowerCase()
            if (appVariants.some(v => appLower.includes(v))) {
              const fullPath = path.join(appPath, app)
              evidence.push(`Aplicación encontrada: ${fullPath}`)

              const result = createResult(true, 'app_installed', 'Aplicación instalada verificada', evidence, warnings)
              result.durationMs = Date.now() - startTime
              result.artifactType = 'app'
              result.target = appName
              return result
            }
          }
        } catch {
          // Continue to next path
        }
      }

      // Try open -Ra
      for (const variant of appVariants) {
        try {
          await execAsync(`open -Ra "${variant}"`, { timeout: 5000 })
          evidence.push(`Aplicación registrada: ${variant}`)
          const result = createResult(true, 'app_installed', 'Aplicación instalada verificada', evidence, warnings)
          result.durationMs = Date.now() - startTime
          result.artifactType = 'app'
          result.target = appName
          return result
        } catch {
          // Command failed, continue
        }
      }
    } else {
      // Linux: Check common paths and which
      for (const variant of appVariants) {
        try {
          const { stdout } = await execAsync(`which ${variant}`, { timeout: 5000 })
          if (stdout.trim()) {
            evidence.push(`Ejecutable encontrado: ${stdout.trim()}`)
            const result = createResult(true, 'app_installed', 'Aplicación instalada verificada', evidence, warnings)
            result.durationMs = Date.now() - startTime
            result.artifactType = 'app'
            result.target = appName
            return result
          }
        } catch {
          // Command failed, continue
        }
      }
    }
  } catch (err) {
    warnings.push(`Error validando instalación: ${err instanceof Error ? err.message : 'Unknown'}`)
  }

  warnings.push('No se pudo verificar la instalación con certeza')

  const result = createResult(
    false,
    'app_installed',
    `Aplicación no encontrada: ${appName}`,
    evidence,
    warnings
  )
  result.durationMs = Date.now() - startTime
  result.artifactType = 'app'
  result.target = appName
  return result
}

/**
 * Validate application is running/opened
 */
export async function validateOpenedApplication(
  appName: string,
  options?: {
    platform?: string
    timeout?: number
  }
): Promise<ValidationResult> {
  const startTime = Date.now()
  const platform = options?.platform || process.platform
  const evidence: string[] = []
  const warnings: string[] = []
  const appVariants = normalizeAppName(appName)
  const timeout = options?.timeout || 5000

  try {
    if (platform === 'win32') {
      // Windows: Use tasklist
      const { stdout } = await execAsync('tasklist /FO CSV /NH', { timeout })
      const processes = stdout.toLowerCase()

      for (const variant of appVariants) {
        if (processes.includes(variant)) {
          evidence.push(`Proceso encontrado: ${variant}`)
          const result = createResult(true, 'app_opened', 'Aplicación abierta verificada', evidence, warnings)
          result.durationMs = Date.now() - startTime
          result.artifactType = 'process'
          result.target = appName
          return result
        }
      }
    } else if (platform === 'darwin') {
      // macOS: Use pgrep or ps
      const { stdout } = await execAsync('ps aux', { timeout })
      const processes = stdout.toLowerCase()

      for (const variant of appVariants) {
        if (processes.includes(variant)) {
          evidence.push(`Proceso encontrado: ${variant}`)
          const result = createResult(true, 'app_opened', 'Aplicación abierta verificada', evidence, warnings)
          result.durationMs = Date.now() - startTime
          result.artifactType = 'process'
          result.target = appName
          return result
        }
      }
    } else {
      // Linux: Use pgrep or ps
      const { stdout } = await execAsync('ps aux', { timeout })
      const processes = stdout.toLowerCase()

      for (const variant of appVariants) {
        if (processes.includes(variant)) {
          evidence.push(`Proceso encontrado: ${variant}`)
          const result = createResult(true, 'app_opened', 'Aplicación abierta verificada', evidence, warnings)
          result.durationMs = Date.now() - startTime
          result.artifactType = 'process'
          result.target = appName
          return result
        }
      }
    }
  } catch (err) {
    warnings.push(`Error verificando proceso: ${err instanceof Error ? err.message : 'Unknown'}`)
  }

  warnings.push('No se pudo verificar que la aplicación esté abierta')

  const result = createResult(
    false,
    'app_opened',
    `Proceso no detectado: ${appName}`,
    evidence,
    warnings
  )
  result.durationMs = Date.now() - startTime
  result.artifactType = 'process'
  result.target = appName
  return result
}

/**
 * Validate URL is reachable
 */
export async function validateUrlReachable(
  url: string,
  options?: {
    timeout?: number
    allowRedirects?: boolean
  }
): Promise<ValidationResult> {
  const startTime = Date.now()
  const evidence: string[] = []
  const warnings: string[] = []
  const timeout = options?.timeout || 5000

  try {
    // Validate URL format
    const urlObj = new URL(url)
    evidence.push(`URL válida: ${urlObj.href}`)

    // Simple fetch check
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: options?.allowRedirects ? 'follow' : 'manual'
      })
      clearTimeout(timeoutId)

      if (response.ok || response.status < 400) {
        evidence.push(`Status: ${response.status}`)
        const result = createResult(true, 'url_reachable', 'URL accesible', evidence, warnings)
        result.durationMs = Date.now() - startTime
        result.artifactType = 'url'
        result.target = url
        return result
      } else {
        warnings.push(`Status: ${response.status}`)
      }
    } catch (fetchErr) {
      clearTimeout(timeoutId)
      if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
        warnings.push('Timeout alcanzado')
      } else {
        warnings.push(`Error de conexión: ${fetchErr instanceof Error ? fetchErr.message : 'Unknown'}`)
      }
    }
  } catch (err) {
    warnings.push(`URL inválida: ${err instanceof Error ? err.message : 'Unknown'}`)
  }

  const result = createResult(
    false,
    'url_reachable',
    `URL no accesible: ${url}`,
    evidence,
    warnings
  )
  result.durationMs = Date.now() - startTime
  result.artifactType = 'url'
  result.target = url
  return result
}

/**
 * Validate file exists
 */
export function validateFileExists(
  filePath: string,
  options?: {
    minSize?: number
  }
): ValidationResult {
  const startTime = Date.now()
  const evidence: string[] = []
  const warnings: string[] = []

  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath)

      if (options?.minSize && stats.size < options.minSize) {
        warnings.push(`Archivo muy pequeño: ${stats.size} bytes`)
      }

      evidence.push(`Archivo existe: ${filePath}`)
      evidence.push(`Tamaño: ${stats.size} bytes`)

      const result = createResult(true, 'file_exists', 'Archivo existe', evidence, warnings)
      result.durationMs = Date.now() - startTime
      result.artifactType = 'file'
      result.target = filePath
      return result
    }
  } catch (err) {
    warnings.push(`Error verificando archivo: ${err instanceof Error ? err.message : 'Unknown'}`)
  }

  const result = createResult(
    false,
    'file_exists',
    `Archivo no existe: ${filePath}`,
    evidence,
    warnings
  )
  result.durationMs = Date.now() - startTime
  result.artifactType = 'file'
  result.target = filePath
  return result
}

/**
 * Validate directory exists
 */
export function validateDirectoryExists(dirPath: string): ValidationResult {
  const startTime = Date.now()
  const evidence: string[] = []
  const warnings: string[] = []

  try {
    if (fs.existsSync(dirPath)) {
      const stats = fs.statSync(dirPath)

      if (stats.isDirectory()) {
        evidence.push(`Directorio existe: ${dirPath}`)

        const result = createResult(true, 'directory_exists', 'Directorio existe', evidence, warnings)
        result.durationMs = Date.now() - startTime
        result.artifactType = 'directory'
        result.target = dirPath
        return result
      } else {
        warnings.push('Ruta existe pero no es directorio')
      }
    }
  } catch (err) {
    warnings.push(`Error verificando directorio: ${err instanceof Error ? err.message : 'Unknown'}`)
  }

  const result = createResult(
    false,
    'directory_exists',
    `Directorio no existe: ${dirPath}`,
    evidence,
    warnings
  )
  result.durationMs = Date.now() - startTime
  result.artifactType = 'directory'
  result.target = dirPath
  return result
}
