import type { Task, TaskInput } from '../types'

export interface TaskFlowAdapter {
  createTask(tenantId: string, input: TaskInput): Promise<Task>
  getTask(taskId: string): Promise<Task | null>
  listTasks(tenantId: string): Promise<Task[]>
  cancelTask(taskId: string): Promise<void>
  retryTask(taskId: string): Promise<Task>
  getTaskStatus(taskId: string): Promise<Task['status']>
}
