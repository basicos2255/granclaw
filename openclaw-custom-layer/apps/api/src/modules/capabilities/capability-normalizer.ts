/**
 * Capability Key Normalizer
 * FIX 104: Normaliza y deduplica capability keys
 *
 * Toda capability se resuelve por una CLAVE CANÓNICA estable.
 */

/**
 * Quita acentos de un string
 */
function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Mapeos de sinónimos a capability key canónica
 */
const CAPABILITY_SYNONYMS: Record<string, string> = {
  // Calculadora
  'calculadora': 'open_calculator',
  'calculator': 'open_calculator',
  'calc': 'open_calculator',
  'calculadora del sistema': 'open_calculator',
  'abrir calculadora': 'open_calculator',
  'abre la calculadora': 'open_calculator',
  'abre calculadora': 'open_calculator',
  'open_calculator': 'open_calculator',

  // Editor de texto
  'editor': 'open_text_editor',
  'editor de texto': 'open_text_editor',
  'editor de notas': 'open_text_editor',
  'bloc de notas': 'open_text_editor',
  'notepad': 'open_text_editor',
  'textedit': 'open_text_editor',
  'notas': 'open_text_editor',
  'vscode': 'open_text_editor',
  'visual studio code': 'open_text_editor',
  'sublime': 'open_text_editor',
  'atom': 'open_text_editor',
  'open_text_editor': 'open_text_editor',

  // Navegador
  'navegador': 'open_web_browser',
  'browser': 'open_web_browser',
  'chrome': 'open_web_browser',
  'safari': 'open_web_browser',
  'firefox': 'open_web_browser',
  'edge': 'open_web_browser',
  'abre google': 'open_web_browser',
  'abrir web': 'open_web_browser',
  'abre la web': 'open_web_browser',
  'internet': 'open_web_browser',
  'open_web_browser': 'open_web_browser',

  // Comandos del sistema
  'terminal': 'run_system_command',
  'shell': 'run_system_command',
  'comando': 'run_system_command',
  'script': 'run_system_command',
  'powershell': 'run_system_command',
  'cmd': 'run_system_command',
  'consola': 'run_system_command',
  'run_system_command': 'run_system_command',

  // Aplicaciones locales
  'photoshop': 'open_local_application',
  'word': 'open_local_application',
  'excel': 'open_local_application',
  'powerpoint': 'open_local_application',
  'finder': 'open_local_application',
  'explorador': 'open_local_application',
  'spotify': 'open_local_application',
  'slack': 'open_local_application',
  'discord': 'open_local_application',
  'zoom': 'open_local_application',
  'teams': 'open_local_application',
  'aplicacion': 'open_local_application',
  'launch_application': 'open_local_application',
  'open_local_application': 'open_local_application',

  // Archivos
  'write_local_file': 'write_local_file',
  'file_write': 'write_local_file',
  'crear archivo': 'write_local_file',
  'guardar archivo': 'write_local_file',
  'escribir archivo': 'write_local_file',

  'read_local_file': 'read_local_file',
  'file_read': 'read_local_file',
  'leer archivo': 'read_local_file',
  'abrir archivo': 'read_local_file'
}

/**
 * Normaliza un input a una capability key canónica
 * @param input - proposedToolName, detectedCapability, o texto libre
 * @returns capability key normalizada (e.g., "open_calculator")
 */
export function normalizeCapabilityKey(input: string): string {
  if (!input) return 'unknown_capability'

  // Normalizar: lowercase, trim, quitar acentos
  const normalized = removeAccents(input.toLowerCase().trim())

  // Buscar en mapeos exactos primero
  if (CAPABILITY_SYNONYMS[normalized]) {
    return CAPABILITY_SYNONYMS[normalized]
  }

  // Buscar coincidencia parcial en sinónimos
  for (const [synonym, key] of Object.entries(CAPABILITY_SYNONYMS)) {
    if (normalized.includes(synonym) || synonym.includes(normalized)) {
      return key
    }
  }

  // Si ya tiene formato snake_case, asumimos que es una key válida
  if (normalized.includes('_') && !normalized.includes(' ')) {
    return normalized
  }

  // Fallback: convertir a snake_case básico
  return normalized.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

/**
 * Obtiene el nombre legible de una capability key
 */
export function getCapabilityDisplayName(capabilityKey: string): string {
  const displayNames: Record<string, string> = {
    'open_calculator': 'Calculadora',
    'open_text_editor': 'Editor de texto',
    'open_web_browser': 'Navegador web',
    'run_system_command': 'Comandos del sistema',
    'open_local_application': 'Aplicaciones locales',
    'write_local_file': 'Escribir archivos',
    'read_local_file': 'Leer archivos'
  }
  return displayNames[capabilityKey] || capabilityKey
}
