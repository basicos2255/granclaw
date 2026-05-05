/**
 * Service de Agents
 * Multi-tenant aware
 */

import { storage } from '../../storage'
import { getPresetById, getPresetByIdForTenant } from '../presets/service'
import type { Agent, CreateAgentInput } from './types'

/**
 * Get all agents (internal, no tenant filter)
 */
export function getAllAgentsInternal(): Agent[] {
  return storage.getAll<Agent>('agents')
}

/**
 * Get all agents for a tenant
 */
export function getAllAgents(tenantId?: string): Agent[] {
  const agents = getAllAgentsInternal()
  if (!tenantId) return agents
  return agents.filter((a) => a.tenantId === tenantId)
}

/**
 * Get agent by id (internal, no tenant check)
 */
export function getAgentById(id: string): Agent | null {
  return storage.getById<Agent>('agents', id)
}

/**
 * Get agent by id for a specific tenant
 */
export function getAgentByIdForTenant(id: string, tenantId: string): Agent | null {
  const agent = getAgentById(id)
  if (!agent || agent.tenantId !== tenantId) return null
  return agent
}

export interface CreateAgentResult {
  success: boolean
  agent?: Agent
  error?: string
}

/**
 * Create agent for a tenant
 */
export function createAgent(input: CreateAgentInput, tenantId: string): CreateAgentResult {
  // Validar que el preset existe y pertenece al mismo tenant
  const preset = getPresetByIdForTenant(input.presetId, tenantId)
  if (!preset) {
    return {
      success: false,
      error: `Preset with id "${input.presetId}" not found for this tenant`
    }
  }

  const id = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const agent: Agent = {
    id,
    tenantId,
    name: input.name,
    presetId: input.presetId,
    tools: input.tools ?? [],
    toolsConfig: input.toolsConfig,
    active: input.active ?? true
  }

  storage.add('agents', agent)
  return { success: true, agent }
}
