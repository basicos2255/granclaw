import type {
  TaskFlowAdapter,
  Task,
  TaskInput
} from '@granclaw/core'

/**
 * OpenClaw TaskFlow Adapter - Skeleton
 * Implementación vacía del contrato TaskFlowAdapter
 */
export class OpenClawTaskFlowAdapter implements TaskFlowAdapter {
  async createTask(tenantId: string, input: TaskInput): Promise<Task> {
    // TODO: Implementar creación real
    return {
      id: '',
      tenantId,
      name: input.name,
      description: input.description,
      status: 'pending',
      priority: input.priority ?? 'medium',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  async getTask(taskId: string): Promise<Task | null> {
    // TODO: Implementar obtención real
    return null
  }

  async listTasks(tenantId: string): Promise<Task[]> {
    // TODO: Implementar listado real
    return []
  }

  async cancelTask(taskId: string): Promise<void> {
    // TODO: Implementar cancelación real
  }

  async retryTask(taskId: string): Promise<Task> {
    // TODO: Implementar retry real
    return {
      id: taskId,
      tenantId: '',
      name: '',
      status: 'pending',
      priority: 'medium',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  async getTaskStatus(taskId: string): Promise<Task['status']> {
    // TODO: Implementar obtención de estado real
    return 'pending'
  }
}
