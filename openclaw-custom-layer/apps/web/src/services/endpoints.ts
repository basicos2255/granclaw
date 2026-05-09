/**
 * GranClaw API Endpoints Registry
 * P6.5: Runtime API Connectivity, Endpoint Registry & Dev Startup Fix
 *
 * Canonical endpoint definitions. All API calls should use these constants.
 * NO hardcoded strings in components.
 */

// =============================================================================
// Health & Status
// =============================================================================

export const ENDPOINTS = {
  // Health checks
  health: '/health',
  runtimeState: '/runtime/state',
  runtimeHealth: '/runtime/health',
  runtimeConsistency: '/runtime/consistency',

  // OpenClaw auth (P6.4R - canonical)
  openclawHealth: '/openclaw/health',
  openclawStatus: '/openclaw/auth/status',
  openclawState: '/openclaw/auth/state',
  openclawCheck: '/openclaw/check',
  openclawRefresh: '/openclaw/refresh',
  openclawCanExecute: '/openclaw/can-execute',
  openclawScopesNeedingAuth: '/openclaw/scopes-needing-auth',
  openclawCapability: (scopeKey: string) => `/openclaw/capability/${encodeURIComponent(scopeKey)}`,
  openclawRepair: '/openclaw/auth/repair',
  openclawRepairActive: '/openclaw/auth/repair/active',
  openclawQuickRepair: '/openclaw/quick-repair',
  openclawReset: '/openclaw/reset',
  openclawReload: '/openclaw/reload',

  // Pairing (legacy - still supported but prefer openclawHealth)
  pairingHealth: '/pairing/health',
  pairingState: '/pairing/state',
  pairingCombined: '/pairing/combined',
  pairingCheck: '/pairing/check',
  pairingReset: '/pairing/reset',
  pairingReload: '/pairing/reload',

  // Auth
  authLogin: '/auth/login',
  authRegister: '/auth/register',
  authLogout: '/auth/logout',
  authMe: '/auth/me',

  // Tasks
  tasks: '/tasks',
  taskById: (id: string) => `/tasks/${id}`,
  taskResult: (id: string) => `/tasks/${id}/result`,
  taskExecuteSteps: '/tasks/execute-steps',

  // Sessions
  sessions: '/sessions',
  sessionById: (id: string) => `/sessions/${id}`,
  sessionMessage: (id: string) => `/sessions/${id}/message`,

  // Queue
  queueStats: '/queue/stats',
  queueJobs: '/queue/jobs',
  queueJobById: (id: string) => `/queue/jobs/${id}`,
  queueJobCancel: (id: string) => `/queue/jobs/${id}/cancel`,
  queuePause: '/queue/pause',
  queueResume: '/queue/resume',
  queueDeadLetter: '/queue/dead-letter',
  queueDeadLetterRequeue: (id: string) => `/queue/dead-letter/${id}/requeue`,
  queueEvents: '/queue/events',
  queueHealth: '/queue/health',

  // DAG
  dagExecutions: '/dag/executions',
  dagExecutionById: (id: string) => `/dag/executions/${id}`,
  dagConfig: '/dag/config',
  dagExecute: '/dag/execute',

  // Orchestrator
  orchestratorRun: '/orchestrator/run',
  orchestratorRunStream: '/orchestrator/run-stream',

  // Tools & Capabilities
  tools: '/tools',
  toolById: (id: string) => `/tools/${id}`,
  capabilities: '/capabilities',
  capabilityById: (id: string) => `/capabilities/${id}`,
  capabilityEnable: (id: string) => `/capabilities/${id}/enable`,
  capabilityDisable: (id: string) => `/capabilities/${id}/disable`,

  // Tool Proposals
  toolProposals: '/tool-proposals',
  toolProposalById: (id: string) => `/tool-proposals/${id}`,
  toolProposalApprove: (id: string) => `/tool-proposals/${id}/approve`,
  toolProposalReject: (id: string) => `/tool-proposals/${id}/reject`,
  toolProposalArchive: (id: string) => `/tool-proposals/${id}/archive`,

  // OS Tools
  osTools: '/os-tools',
  osToolsPending: '/os-tools/pending',
  osToolsConfirm: '/os-tools/confirm',
  osToolsCleanup: '/os-tools/cleanup',

  // Execution Policy
  executionPolicy: '/execution-policy',

  // System State
  systemState: '/system/state',
  systemPendingAction: '/system/pending-action',
  systemClearPendingAction: '/system/clear-pending-action',
  systemConsumePendingAction: '/system/consume-pending-action',
  systemMarkOpenClawReady: '/system/mark-openclaw-ready',

  // Task Memory
  taskMemoryPatterns: '/task-memory/patterns',
  taskMemoryStats: '/task-memory/stats',
  taskMemoryFind: '/task-memory/find',
  taskMemoryNormalize: '/task-memory/normalize',
  taskMemoryClear: '/task-memory/clear',

  // Composite Tasks
  compositeTasks: '/composite-tasks',
  compositeTaskStats: '/composite-tasks/stats',
  compositeTaskById: (id: string) => `/composite-tasks/${id}`,
  compositeTaskFind: '/composite-tasks/find',
  compositeTaskExecute: '/composite-tasks/execute',

  // Repair (legacy FIX 125)
  repairStart: '/openclaw/repair/start',
  repairActive: '/openclaw/repair/active',
  repairHistory: '/openclaw/repair/history',
  repairById: (id: string) => `/openclaw/repair/${id}`,
  repairCheck: (id: string) => `/openclaw/repair/${id}/check`,
  repairCancel: (id: string) => `/openclaw/repair/${id}/cancel`,
  repairRetry: (id: string) => `/openclaw/repair/${id}/retry`,

  // Tenants, Users, Presets, Agents
  tenants: '/tenants',
  users: '/users',
  presets: '/presets',
  agents: '/agents',
  audit: '/audit',

  // GranClaw Hub Config
  hubConfig: '/granclaw-hub/config',
  hubConfigByTenant: (tenantId: string) => `/granclaw-hub/config/${tenantId}`,

  // OpenClaw status (legacy)
  openclawStatusLegacy: '/openclaw/status',
  openclawWsStatus: '/openclaw/ws-status',
  openclawWsRpcStatus: '/openclaw/ws-rpc-status',
  openclawToolsStatus: '/openclaw/tools-status',
  openclawAuthStatus: '/openclaw/auth-status',
  openclawCheckAuth: '/openclaw/check-auth'
} as const

// =============================================================================
// Type Exports
// =============================================================================

export type EndpointKey = keyof typeof ENDPOINTS
