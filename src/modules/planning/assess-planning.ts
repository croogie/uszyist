import type {Reference} from '../../time/reference.js'
import {selectTasks} from '../tasks/queries.js'
import type {Task} from '../tasks/task.js'

export interface PlanningAssessment {
  date: string
  dayTaskLabel: string
  complete: boolean
  qualifyingTasks: Task[]
}

export function assessPlanning(tasks: Task[], reference: Reference, dayTaskLabel: string): PlanningAssessment {
  const qualifyingTasks = selectTasks(tasks, 'day-tasks', reference, {
    dayTaskLabel,
    timeBlocked: true,
  })
  return {
    date: reference.date,
    dayTaskLabel,
    complete: qualifyingTasks.length > 0,
    qualifyingTasks,
  }
}
