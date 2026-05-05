export interface Preset {
  id: string
  tenantId: string
  name: string
  description?: string
  config: PresetConfig
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PresetConfig {
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  tools?: string[]
  customSettings?: Record<string, unknown>
}
