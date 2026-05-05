/**
 * Execution Policy Service
 * FEATURE 120: Hybrid Execution Policy v1
 *
 * Manages execution policy configuration per tenant.
 */

import * as fileDb from '../../storage/file-db'
import type { ExecutionPolicyConfig } from './types'
import { DEFAULT_EXECUTION_POLICY } from './types'

const ENTITY = 'execution-policy'

/**
 * Get execution policy for a tenant
 */
export function getExecutionPolicy(tenantId: string): ExecutionPolicyConfig {
  const policies = fileDb.read<ExecutionPolicyConfig>(ENTITY)
  const existing = policies.find(p => p.tenantId === tenantId)

  if (existing) {
    return existing
  }

  // Return default config for this tenant
  return {
    ...DEFAULT_EXECUTION_POLICY,
    tenantId,
    updatedAt: new Date().toISOString()
  }
}

/**
 * Set execution policy for a tenant
 */
export function setExecutionPolicy(
  tenantId: string,
  updates: Partial<Omit<ExecutionPolicyConfig, 'tenantId' | 'updatedAt'>>
): ExecutionPolicyConfig {
  const policies = fileDb.read<ExecutionPolicyConfig>(ENTITY)
  const existingIndex = policies.findIndex(p => p.tenantId === tenantId)

  const updatedPolicy: ExecutionPolicyConfig = {
    ...DEFAULT_EXECUTION_POLICY,
    ...(existingIndex >= 0 ? policies[existingIndex] : {}),
    ...updates,
    tenantId,
    updatedAt: new Date().toISOString()
  }

  if (existingIndex >= 0) {
    policies[existingIndex] = updatedPolicy
  } else {
    policies.push(updatedPolicy)
  }

  fileDb.write(ENTITY, policies)
  return updatedPolicy
}

/**
 * Get all execution policies
 */
export function getAllExecutionPolicies(): ExecutionPolicyConfig[] {
  return fileDb.read<ExecutionPolicyConfig>(ENTITY)
}

/**
 * Delete execution policy for a tenant (resets to default)
 */
export function deleteExecutionPolicy(tenantId: string): boolean {
  const policies = fileDb.read<ExecutionPolicyConfig>(ENTITY)
  const filtered = policies.filter(p => p.tenantId !== tenantId)

  if (filtered.length === policies.length) {
    return false
  }

  fileDb.write(ENTITY, filtered)
  return true
}
