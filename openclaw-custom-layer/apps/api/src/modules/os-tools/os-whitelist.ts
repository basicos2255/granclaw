/**
 * OS Tools Whitelist
 * FEATURE 110: Controlled OS Tools v1
 *
 * Defines the allowed OS applications per platform.
 * Only applications in this whitelist can be executed.
 */

import type { OSCapabilityKey, OSToolConfig, Platform } from './types'

/**
 * Whitelist of allowed OS tools
 */
export const OS_TOOLS_WHITELIST: Record<OSCapabilityKey, OSToolConfig> = {
  open_calculator: {
    capabilityKey: 'open_calculator',
    displayName: 'Calculadora',
    description: 'Abre la aplicación de calculadora del sistema',
    riskLevel: 'low',
    requiresConfirmation: false,
    platforms: {
      darwin: {
        command: 'open',
        args: ['-a', 'Calculator']
      },
      win32: {
        command: 'calc.exe',
        args: []
      },
      linux: {
        command: 'gnome-calculator',
        args: []
      }
    }
  },

  open_web_browser: {
    capabilityKey: 'open_web_browser',
    displayName: 'Navegador Web',
    description: 'Abre el navegador web predeterminado',
    riskLevel: 'low',
    requiresConfirmation: false,
    platforms: {
      darwin: {
        command: 'open',
        args: ['-a', 'Safari']
      },
      win32: {
        command: 'cmd.exe',
        args: ['/c', 'start', 'msedge']
      },
      linux: {
        command: 'xdg-open',
        args: ['https://www.google.com']
      }
    }
  },

  open_text_editor_os: {
    capabilityKey: 'open_text_editor_os',
    displayName: 'Editor de Texto',
    description: 'Abre el editor de texto del sistema',
    riskLevel: 'low',
    requiresConfirmation: false,
    platforms: {
      darwin: {
        command: 'open',
        args: ['-a', 'TextEdit']
      },
      win32: {
        command: 'notepad.exe',
        args: []
      },
      linux: {
        command: 'gedit',
        args: []
      }
    }
  },

  open_file_explorer: {
    capabilityKey: 'open_file_explorer',
    displayName: 'Explorador de Archivos',
    description: 'Abre el explorador de archivos del sistema',
    riskLevel: 'low',
    requiresConfirmation: false,
    platforms: {
      darwin: {
        command: 'open',
        args: ['.']
      },
      win32: {
        command: 'explorer.exe',
        args: ['.']
      },
      linux: {
        command: 'xdg-open',
        args: ['.']
      }
    }
  },

  open_terminal: {
    capabilityKey: 'open_terminal',
    displayName: 'Terminal',
    description: 'Abre una nueva ventana de terminal',
    riskLevel: 'medium',
    requiresConfirmation: true,
    platforms: {
      darwin: {
        command: 'open',
        args: ['-a', 'Terminal']
      },
      win32: {
        command: 'cmd.exe',
        args: ['/c', 'start', 'cmd']
      },
      linux: {
        command: 'gnome-terminal',
        args: []
      }
    }
  }
}

/**
 * Get current platform
 */
export function getCurrentPlatform(): Platform {
  const platform = process.platform
  if (platform === 'darwin' || platform === 'win32' || platform === 'linux') {
    return platform
  }
  // Default to linux for unknown platforms
  console.warn(`[OS-TOOLS] Unknown platform "${platform}", defaulting to linux`)
  return 'linux'
}

/**
 * Check if a capability key is a valid OS tool
 */
export function isOSToolCapability(capabilityKey: string): capabilityKey is OSCapabilityKey {
  return capabilityKey in OS_TOOLS_WHITELIST
}

/**
 * Get OS tool config by capability key
 */
export function getOSToolConfig(capabilityKey: string): OSToolConfig | null {
  if (!isOSToolCapability(capabilityKey)) {
    return null
  }
  return OS_TOOLS_WHITELIST[capabilityKey]
}

/**
 * Get all OS tool capability keys
 */
export function getAllOSToolKeys(): OSCapabilityKey[] {
  return Object.keys(OS_TOOLS_WHITELIST) as OSCapabilityKey[]
}

/**
 * Check if OS tool is supported on current platform
 */
export function isOSToolSupportedOnPlatform(
  capabilityKey: OSCapabilityKey,
  platform?: Platform
): boolean {
  const config = OS_TOOLS_WHITELIST[capabilityKey]
  const targetPlatform = platform || getCurrentPlatform()
  return config.platforms[targetPlatform] !== undefined
}
