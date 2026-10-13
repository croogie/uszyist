import { DateTime } from "luxon";

import type { Reference } from "../../time/reference.js";
import type { Task } from "./task.js";

export type TaskSelection =
  | "list"
  | "day-tasks"
  | "current"
  | "next"
  | "elapsed"
  | "deadlines";

export interface TaskSelectionOptions {
  dayTaskLabel?: string;
  timeBlocked?: boolean;
}

function timestamp(value: string | null): number | null {
  if (value === null || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const parsed = DateTime.fromISO(value, { setZone: true });
  return parsed.isValid ? parsed.toMillis() : null;
}

function block(task: Task): { start: number; end: number } | null {
  const start = timestamp(task.start);
  const end = timestamp(task.end);
  return start !== null && end !== null && end > start ? { start, end } : null;
}

function compareTasks(left: Task, right: Task): number {
  const leftStart = timestamp(left.start);
  const rightStart = timestamp(right.start);
  if (leftStart === null && rightStart !== null) return 1;
  if (leftStart !== null && rightStart === null) return -1;
  if (leftStart !== null && rightStart !== null && leftStart !== rightStart)
    return leftStart - rightStart;
  return left.id.localeCompare(right.id);
}

function sorted<T extends Task>(tasks: T[]): T[] {
  return tasks.sort(compareTasks);
}

export function selectTasks<T extends Task>(
  tasks: T[],
  kind: TaskSelection,
  reference: Reference,
  options: TaskSelectionOptions = {}
): T[] {
  if (kind === "deadlines")
    return sorted(tasks.filter((task) => task.deadline === reference.date));

  const dated = tasks.filter((task) => task.plannedDate === reference.date);
  if (kind === "list") return sorted(dated);

  if (kind === "day-tasks") {
    const labeled = dated.filter((task) =>
      task.labels.includes(options.dayTaskLabel ?? "zadanie-dnia")
    );
    return sorted(
      options.timeBlocked
        ? labeled.filter((task) => block(task) !== null)
        : labeled
    );
  }

  if (kind === "current") {
    return sorted(
      dated.filter((task) => {
        const timeBlock = block(task);
        return (
          timeBlock !== null &&
          timeBlock.start <= reference.instant &&
          reference.instant < timeBlock.end
        );
      })
    );
  }

  if (kind === "elapsed") {
    return sorted(
      dated.filter((task) => {
        const timeBlock = block(task);
        return timeBlock !== null && timeBlock.end <= reference.instant;
      })
    );
  }

  const future = dated
    .map((task) => ({ task, start: timestamp(task.start) }))
    .filter(
      (entry): entry is { task: T; start: number } =>
        entry.start !== null && entry.start > reference.instant
    );
  const nearest = future.reduce<number | null>(
    (result, entry) =>
      result === null || entry.start < result ? entry.start : result,
    null
  );
  return nearest === null
    ? []
    : sorted(
        future
          .filter((entry) => entry.start === nearest)
          .map((entry) => entry.task)
      );
}
