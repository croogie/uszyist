import type {Reference} from '../../time/reference.js'
import type {Task} from './task.js'

/** A currently open task or a completed occurrence returned by Todoist history. */
export interface TimelineTask extends Task {
  completed: boolean
  completedAt: string | null
}

export interface TimelineSource {
  listDayTasks(reference: Reference): Promise<TimelineTask[]>
}
