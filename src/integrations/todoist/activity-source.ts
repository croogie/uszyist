import { TodoistApi } from "@doist/todoist-sdk";
import { DateTime } from "luxon";
import type { ActivitySource } from "../../modules/activity/activity-source.js";
import type { Reference } from "../../time/reference.js";
import { mapTodoistActivity } from "./mapping.js";

export class TodoistActivitySource implements ActivitySource {
  constructor(private readonly api: Pick<TodoistApi, "getActivityLogs">) {}

  async listActivity(reference: Reference) {
    const startDate = DateTime.fromMillis(reference.dayStart)
      .toUTC()
      .toISODate();
    // The live API truncates dateTo to midnight despite the SDK's "inclusive"
    // description. Fetch through the following UTC date, then trim exact instants.
    const endDate = DateTime.fromMillis(reference.dayEnd - 1)
      .toUTC()
      .plus({ days: 1 })
      .toISODate();
    if (startDate === null || endDate === null) {
      throw new Error("Cannot derive Todoist activity date bounds");
    }

    const activity = [];
    const seenCursors = new Set<string>();
    let cursor: string | null | undefined;

    do {
      const page = await this.api.getActivityLogs(
        cursor === undefined
          ? { dateFrom: startDate, dateTo: endDate }
          : { dateFrom: startDate, dateTo: endDate, cursor }
      );

      for (const event of page.results) {
        const occurredAt = event.eventDate.getTime();
        if (occurredAt >= reference.dayStart && occurredAt < reference.dayEnd) {
          activity.push(mapTodoistActivity(event, reference));
        }
      }

      cursor = page.nextCursor;
      if (cursor !== null && seenCursors.has(cursor)) {
        throw new Error(
          "Todoist returned a repeated activity pagination cursor"
        );
      }
      if (cursor !== null) seenCursors.add(cursor);
    } while (cursor !== null);

    return activity;
  }
}

export function createActivitySource(token: string): ActivitySource {
  return new TodoistActivitySource(new TodoistApi(token));
}
