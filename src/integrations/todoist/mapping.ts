import { DateTime } from "luxon";
import type { Activity } from "../../modules/activity/activity.js";
import type { Task } from "../../modules/tasks/task.js";
import type { Reference } from "../../time/reference.js";

interface TodoistDueDate {
  date: string;
  datetime?: string | null;
  timezone?: string | null;
}

interface TodoistDuration {
  amount: number;
  unit: string;
}

interface TodoistTaskRecord {
  id: string;
  content: string;
  labels: string[];
  due: TodoistDueDate | null;
  duration: TodoistDuration | null;
  deadline: { date: string } | null;
  url: string;
}

interface TodoistActivityRecord {
  id: string | null;
  eventType: string;
  objectType: string;
  objectId: string | null;
  eventDate: Date;
  extraData: Record<string, unknown> | null;
}

function isoDateTime(dateTime: DateTime): string {
  const value = dateTime.toISO({ suppressMilliseconds: true });
  if (value === null) {
    throw new Error("Todoist returned an invalid datetime");
  }

  return value;
}

function mapTimedDue(due: TodoistDueDate): {
  plannedDate: string;
  start: DateTime;
} {
  const datetime = due.datetime ?? (due.date.includes("T") ? due.date : null);
  if (datetime === null || datetime === undefined) {
    throw new Error(
      "Cannot map a date-only Todoist due date as a timed due date"
    );
  }

  const hasOffset = /(?:Z|[+-]\d{2}:\d{2})$/i.test(datetime);
  const start = hasOffset
    ? DateTime.fromISO(datetime, { setZone: true })
    : due.timezone === null || due.timezone === undefined
      ? DateTime.fromISO(datetime)
      : DateTime.fromISO(datetime, { zone: due.timezone });

  if (!start.isValid) {
    throw new Error(`Todoist returned an invalid due datetime: ${datetime}`);
  }

  const localStart = start.toLocal();
  const plannedDate = localStart.toISODate();
  if (plannedDate === null) {
    throw new Error(`Todoist returned an invalid due datetime: ${datetime}`);
  }

  return { plannedDate, start: localStart };
}

function endForDuration(
  start: DateTime,
  duration: TodoistDuration | null
): string | null {
  if (duration === null) {
    return null;
  }

  let end: DateTime;
  switch (duration.unit) {
    case "minute":
      if (duration.amount <= 0) return null;
      end = start.plus({ minutes: duration.amount });
      break;
    case "day":
      if (duration.amount <= 0) return null;
      end = start.plus({ days: duration.amount });
      break;
    default:
      throw new Error(
        `Todoist returned an unsupported duration unit: ${duration.unit}`
      );
  }

  if (!end.isValid) {
    throw new Error("Todoist returned an invalid duration");
  }

  return isoDateTime(end);
}

export function mapTodoistTask(task: TodoistTaskRecord): Task {
  if (
    task.duration !== null &&
    task.duration.unit !== "minute" &&
    task.duration.unit !== "day"
  ) {
    throw new Error(
      `Todoist returned an unsupported duration unit: ${task.duration.unit}`
    );
  }

  if (task.due === null) {
    return {
      id: task.id,
      title: task.content,
      labels: task.labels,
      plannedDate: null,
      start: null,
      end: null,
      deadline: task.deadline?.date ?? null,
      url: task.url,
    };
  }

  if (task.due.datetime == null && !task.due.date.includes("T")) {
    return {
      id: task.id,
      title: task.content,
      labels: task.labels,
      plannedDate: task.due.date,
      start: null,
      end: null,
      deadline: task.deadline?.date ?? null,
      url: task.url,
    };
  }

  const due = mapTimedDue(task.due);
  return {
    id: task.id,
    title: task.content,
    labels: task.labels,
    plannedDate: due.plannedDate,
    start: isoDateTime(due.start),
    end: endForDuration(due.start, task.duration),
    deadline: task.deadline?.date ?? null,
    url: task.url,
  };
}

function activityTitle(
  extraData: Record<string, unknown> | null
): string | null {
  if (extraData === null) return null;

  for (const key of ["content", "name", "title"]) {
    const value = extraData[key];
    if (typeof value === "string") return value;
  }

  return null;
}

export function mapTodoistActivity(
  event: TodoistActivityRecord,
  reference: Reference
): Activity {
  const occurredAt = DateTime.fromJSDate(event.eventDate, {
    zone: "utc",
  }).setZone(reference.zone);
  if (!occurredAt.isValid) {
    throw new Error("Todoist returned an invalid activity timestamp");
  }

  return {
    id:
      event.id ??
      `${event.objectType}:${event.objectId ?? ""}:${event.eventType}:${event.eventDate.toISOString()}`,
    eventType: event.eventType,
    objectType: event.objectType,
    objectId: event.objectId,
    title: activityTitle(event.extraData),
    occurredAt: isoDateTime(occurredAt),
  };
}
