/**
 * Tipos de Presets
 */

export interface Preset {
  id: string
  tenantId: string
  name: string
  description?: string
  systemPrompt: string
  enabled: boolean
}

export interface CreatePresetInput {
  name: string
  description?: string
  systemPrompt: string
  enabled?: boolean
}
