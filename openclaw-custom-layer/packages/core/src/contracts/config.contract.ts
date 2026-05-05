import type { Preset, PresetConfig } from '../types'

export interface ConfigAdapter {
  getPreset(presetId: string): Promise<Preset | null>
  listPresets(tenantId: string): Promise<Preset[]>
  createPreset(tenantId: string, name: string, config: PresetConfig): Promise<Preset>
  updatePreset(presetId: string, config: Partial<PresetConfig>): Promise<Preset>
  deletePreset(presetId: string): Promise<void>
  getDefaultPreset(tenantId: string): Promise<Preset | null>
  setDefaultPreset(tenantId: string, presetId: string): Promise<void>
}
