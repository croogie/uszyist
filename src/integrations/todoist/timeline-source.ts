import { TodoistApi } from "@doist/todoist-sdk";
import { DateTime } from "luxon";
import type { Reference } from "../../time/reference.js";
import type {
  TimelineSource,
  TimelineTask,
} from "../../modules/tasks/timeline.js";
import { selectTasks } from "../../modules/tasks/queries.js";
import { TodoistTaskSource } from "./task-source.js";
import { mapTodoistTask } from "./mapping.js";

export class TodoistTimelineSource implements TimelineSource {
  constructor(
    private readonly api: Pick<
      TodoistApi,
      "getTasks" | "getCompletedTasksByDueDate"
    >
  ) {}

  async listDayTasks(reference: Reference): Promise<TimelineTask[]> {
    // Due-date history, not completion-date history: a task completed tomorrow
    // still belongs to today's plan. Widen UTC bounds to retain date-only and
    // floating due values, then apply the exact normalized assigned-day filter.
    const since = DateTime.fromMillis(reference.dayStart)
      .toUTC()
      .minus({ days: 1 })
      .toISO();
    const until = DateTime.fromMillis(reference.dayEnd)
      .toUTC()
      .plus({ days: 1 })
      .toISO();
    if (since === null || until === null)
      throw new Error("Cannot derive completed task date bounds");

    const active = await new TodoistTaskSource(this.api).listTasks();
    const tasks: TimelineTask[] = selectTasks(active, "list", reference).map(
      (task) => ({ ...task, completed: false, completedAt: null })
    );
    const seenCursors = new Set<string>();
    let cursor: string | null | undefined;
    do {
      const page = await this.api.getCompletedTasksByDueDate({
        since,
        until,
        ...(cursor === undefined ? {} : { cursor }),
      });
      for (const task of page.items) {
        const mapped = mapTodoistTask(task);
        if (mapped.plannedDate !== reference.date) continue;
        tasks.push({
          ...mapped,
          completed: true,
          completedAt:
            task.completedAt === null
              ? null
              : DateTime.fromJSDate(task.completedAt).toLocal().toISO(),
        });
      }
      // The completed-task endpoint can omit next_cursor on its final page.
      cursor = page.nextCursor ?? null;
      if (cursor !== null && seenCursors.has(cursor))
        throw new Error(
          "Todoist returned a repeated completed-task pagination cursor"
        );
      if (cursor !== null) seenCursors.add(cursor);
    } while (cursor !== null);

    // Do not deduplicate by task ID: recurring completions can share an ID.
    return selectTasks(tasks, "list", reference);
  }
}

export function createTimelineSource(token: string): TimelineSource {
  return new TodoistTimelineSource(new TodoistApi(token));
}
