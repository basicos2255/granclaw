/**
 * Service de Presets
 * Multi-tenant aware
 */

import { storage } from '../../storage'
import type { Preset, CreatePresetInput } from './types'

/**
 * Get all presets (internal, no tenant filter)
 */
export function getAllPresetsInternal(): Preset[] {
  return storage.getAll<Preset>('presets')
}

/**
 * Get all presets for a tenant
 */
export function getAllPresets(tenantId?: string): Preset[] {
  const presets = getAllPresetsInternal()
  if (!tenantId) return presets
  return presets.filter((p) => p.tenantId === tenantId)
}

/**
 * Get preset by id (internal, no tenant check)
 */
export function getPresetById(id: string): Preset | null {
  return storage.getById<Preset>('presets', id)
}

/**
 * Get preset by id for a specific tenant
 */
export function getPresetByIdForTenant(id: string, tenantId: string): Preset | null {
  const preset = getPresetById(id)
  if (!preset || preset.tenantId !== tenantId) return null
  return preset
}

/**
 * Create preset for a tenant
 */
export function createPreset(input: CreatePresetInput, tenantId: string): Preset {
  const id = `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const preset: Preset = {
    id,
    tenantId,
    name: input.name,
    description: input.description,
    systemPrompt: input.systemPrompt,
    enabled: input.enabled ?? true
  }

  storage.add('presets', preset)
  return preset
}
