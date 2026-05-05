import type {
  ConfigAdapter,
  Preset,
  PresetConfig
} from '@granclaw/core'

/**
 * OpenClaw Config Adapter - Skeleton
 * Implementación vacía del contrato ConfigAdapter
 */
export class OpenClawConfigAdapter implements ConfigAdapter {
  async getPreset(presetId: string): Promise<Preset | null> {
    // TODO: Implementar obtención real
    return null
  }

  async listPresets(tenantId: string): Promise<Preset[]> {
    // TODO: Implementar listado real
    return []
  }

  async createPreset(tenantId: string, name: string, config: PresetConfig): Promise<Preset> {
    // TODO: Implementar creación real
    return {
      id: '',
      tenantId,
      name,
      config,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  async updatePreset(presetId: string, config: Partial<PresetConfig>): Promise<Preset> {
    // TODO: Implementar actualización real
    return {
      id: presetId,
      tenantId: '',
      name: '',
      config: {},
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  async deletePreset(presetId: string): Promise<void> {
    // TODO: Implementar eliminación real
  }

  async getDefaultPreset(tenantId: string): Promise<Preset | null> {
    // TODO: Implementar obtención real
    return null
  }

  async setDefaultPreset(tenantId: string, presetId: string): Promise<void> {
    // TODO: Implementar establecimiento real
  }
}
