import { TodoistApi } from '@doist/todoist-sdk'
import type { TaskSource } from '../../modules/tasks/task-source.js'
import { mapTodoistTask } from './mapping.js'

export class TodoistTaskSource implements TaskSource {
  constructor(private readonly api: Pick<TodoistApi, 'getTasks'>) {}

  async listTasks() {
    const mappedTasks = []
    const seenCursors = new Set<string>()
    let cursor: string | null | undefined

    do {
      const page = await this.api.getTasks(cursor === undefined ? {} : { cursor })
      for (const task of page.results) {
        if (!task.checked && !task.isDeleted) {
          mappedTasks.push(mapTodoistTask(task))
        }
      }

      cursor = page.nextCursor
      if (cursor !== null && seenCursors.has(cursor)) {
        throw new Error('Todoist returned a repeated task pagination cursor')
      }
      if (cursor !== null) seenCursors.add(cursor)
    } while (cursor !== null)

    return mappedTasks
  }
}

export function createTaskSource(token: string): TaskSource {
  return new TodoistTaskSource(new TodoistApi(token))
}
