import type {Task} from './task.js'

export interface TaskSource {
  listTasks(): Promise<Task[]>
}
