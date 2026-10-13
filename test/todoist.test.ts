import assert from "node:assert/strict";
import test from "node:test";
import type { ActivityEvent, Task as SdkTask } from "@doist/todoist-sdk";
import { TodoistApi } from "@doist/todoist-sdk";
import { DateTime } from "luxon";
import { TodoistActivitySource } from "../src/integrations/todoist/activity-source.js";
import { mapTodoistTask } from "../src/integrations/todoist/mapping.js";
import { TodoistTaskSource } from "../src/integrations/todoist/task-source.js";
import { TodoistTimelineSource } from "../src/integrations/todoist/timeline-source.js";
import type { Reference } from "../src/time/reference.js";

function sdkTask(overrides: Partial<SdkTask> = {}): SdkTask {
  return {
    id: "task-1",
    userId: "user-1",
    projectId: "project-1",
    sectionId: null,
    parentId: null,
    addedByUid: null,
    assignedByUid: null,
    responsibleUid: null,
    labels: [],
    deadline: null,
    duration: null,
    checked: false,
    isDeleted: false,
    addedAt: null,
    completedAt: null,
    updatedAt: null,
    due: null,
    priority: 1,
    childOrder: 1,
    content: "Task",
    description: "",
    dayOrder: 1,
    isCollapsed: false,
    isUncompletable: false,
    url: "https://app.todoist.com/app/task/task-1",
    ...overrides,
  };
}

function referenceIn(zone: string): Reference {
  const day = DateTime.fromObject(
    { year: 2026, month: 10, day: 13 },
    { zone }
  ).startOf("day");
  const end = day.plus({ days: 1 });

  return {
    date: "2026-10-13",
    time: "12:00:00",
    instant: day.plus({ hours: 12 }).toMillis(),
    dayStart: day.toMillis(),
    dayEnd: end.toMillis(),
    zone,
  };
}

function activityEvent(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: "event-1",
    objectType: "task",
    objectId: "task-1",
    eventType: "completed",
    eventDate: new Date("2026-10-13T12:00:00.000Z"),
    parentProjectId: null,
    parentItemId: null,
    initiatorId: null,
    extraData: null,
    ...overrides,
  };
}

test("lists every active Todoist task page and maps date-only and timed tasks", async () => {
  const source = new TodoistTaskSource({
    async getTasks(args = {}) {
      if (args.cursor === undefined) {
        return {
          results: [
            sdkTask({
              id: "date-only",
              due: { isRecurring: false, string: "13 Oct", date: "2026-10-13" },
            }),
            sdkTask({ id: "completed", checked: true }),
            sdkTask({ id: "deleted", isDeleted: true }),
          ],
          nextCursor: "page-2",
        };
      }

      return {
        results: [
          sdkTask({
            id: "timed",
            content: "Timed task",
            due: {
              isRecurring: false,
              string: "13 Oct 09:00",
              date: "2026-10-13",
              datetime: "2026-10-13T09:00:00",
            },
            duration: { amount: 90, unit: "minute" },
            deadline: { date: "2026-10-15", lang: "en" },
          }),
        ],
        nextCursor: null,
      };
    },
  });

  const tasks = await source.listTasks();

  assert.deepEqual(
    tasks.map((task) => task.id),
    ["date-only", "timed"]
  );
  assert.deepEqual(tasks[0], {
    id: "date-only",
    title: "Task",
    labels: [],
    plannedDate: "2026-10-13",
    start: null,
    end: null,
    deadline: null,
    url: "https://app.todoist.com/app/task/task-1",
  });
  assert.equal(tasks[1].plannedDate, "2026-10-13");
  assert.match(
    tasks[1].start ?? "",
    /^2026-10-13T09:00:00(?:[+-]\d{2}:\d{2}|Z)$/
  );
  assert.match(
    tasks[1].end ?? "",
    /^2026-10-13T10:30:00(?:[+-]\d{2}:\d{2}|Z)$/
  );
  assert.equal(tasks[1].deadline, "2026-10-15");
});

test("maps API v1 floating and offset datetimes supplied in due.date", () => {
  const floating = mapTodoistTask(
    sdkTask({
      due: {
        date: "2026-10-13T09:00:00",
        isRecurring: false,
        string: "13 Oct 09:00",
      },
      duration: { amount: 30, unit: "minute" },
    })
  );
  assert.match(
    floating.start ?? "",
    /^2026-10-13T09:00:00(?:[+-]\d{2}:\d{2}|Z)$/
  );
  assert.equal(
    Date.parse(floating.end ?? "") - Date.parse(floating.start ?? ""),
    30 * 60_000
  );

  const zoned = mapTodoistTask(
    sdkTask({
      due: {
        date: "2026-10-13T09:00:00Z",
        isRecurring: false,
        string: "13 Oct 09:00",
      },
    })
  );
  assert.equal(
    Date.parse(zoned.start ?? ""),
    Date.parse("2026-10-13T09:00:00Z")
  );
  assert.equal(
    zoned.plannedDate,
    DateTime.fromISO("2026-10-13T09:00:00Z").toLocal().toISODate()
  );
  assert.equal(zoned.end, null);
});

test("rejects unsupported Todoist duration units instead of treating them as zero", () => {
  assert.throws(
    () =>
      mapTodoistTask({
        id: "unsupported-duration",
        content: "Task",
        labels: [],
        due: { date: "2026-10-13" },
        duration: { amount: 1, unit: "hour" },
        deadline: null,
        url: "https://app.todoist.com/app/task/unsupported-duration",
      }),
    /unsupported duration unit: hour/
  );
});

test("does not return a partial task result when a later Todoist page fails", async () => {
  const source = new TodoistTaskSource({
    async getTasks(args = {}) {
      if (args.cursor === undefined) {
        return { results: [sdkTask()], nextCursor: "page-2" };
      }

      throw new Error("Todoist unavailable");
    },
  });

  await assert.rejects(source.listTasks(), /Todoist unavailable/);
});

test("fetches activity across UTC date boundaries, paginates, and keeps only the local day", async () => {
  const reference = referenceIn("Pacific/Kiritimati");
  const source = new TodoistActivitySource({
    async getActivityLogs(args = {}) {
      if (args.cursor === undefined) {
        return {
          results: [
            activityEvent({
              id: "before",
              eventDate: new Date(reference.dayStart - 1),
            }),
            activityEvent({
              id: "inside-1",
              eventDate: new Date(reference.dayStart),
              extraData: { content: "Morning task" },
            }),
          ],
          nextCursor: "page-2",
        };
      }

      return {
        results: [
          activityEvent({
            id: "inside-2",
            eventDate: new Date(reference.dayEnd - 1),
            extraData: { name: "Project name" },
          }),
          activityEvent({
            id: "after",
            eventDate: new Date(reference.dayEnd),
          }),
        ],
        nextCursor: null,
      };
    },
  });

  const activity = await source.listActivity(reference);

  assert.deepEqual(
    activity.map((event) => event.id),
    ["inside-1", "inside-2"]
  );
  assert.deepEqual(
    activity.map((event) => event.title),
    ["Morning task", "Project name"]
  );
  assert.match(
    activity[0].occurredAt,
    /^2026-10-13T00:00:00(?:[+-]\d{2}:\d{2}|Z)$/
  );
});

test("keeps the entire local day when the API treats dateTo as a midnight boundary", async () => {
  const reference = referenceIn("Pacific/Kiritimati");
  const candidates = [
    activityEvent({
      id: "before",
      eventDate: new Date(reference.dayStart - 1),
    }),
    activityEvent({ id: "first", eventDate: new Date(reference.dayStart) }),
    activityEvent({ id: "last", eventDate: new Date(reference.dayEnd - 1) }),
    activityEvent({ id: "after", eventDate: new Date(reference.dayEnd) }),
  ];
  const source = new TodoistActivitySource({
    async getActivityLogs(args = {}) {
      const from = Date.parse(`${args.dateFrom}T00:00:00Z`);
      const to = Date.parse(`${args.dateTo}T00:00:00Z`);
      return {
        results: candidates.filter(
          (event) =>
            event.eventDate.getTime() >= from && event.eventDate.getTime() < to
        ),
        nextCursor: null,
      };
    },
  });
  assert.deepEqual(
    (await source.listActivity(reference)).map((event) => event.id),
    ["first", "last"]
  );
});

test("does not return partial activity when a later Todoist page fails", async () => {
  const reference = referenceIn("UTC");
  const source = new TodoistActivitySource({
    async getActivityLogs(args = {}) {
      if (args.cursor === undefined) {
        return { results: [activityEvent()], nextCursor: "page-2" };
      }

      throw new Error("Todoist unavailable");
    },
  });

  await assert.rejects(source.listActivity(reference), /Todoist unavailable/);
});

test("timeline merges every active and completed page by planned start and retains recurring occurrences", async () => {
  const reference = referenceIn(DateTime.local().zoneName ?? "UTC");
  const due = (date: string) => ({ date, isRecurring: false, string: date });
  const source = new TodoistTimelineSource({
    async getTasks(args = {}) {
      return args.cursor === undefined
        ? {
            results: [sdkTask({ id: "open", due: due("2026-10-13T10:00:00") })],
            nextCursor: "active-2",
          }
        : {
            results: [
              sdkTask({ id: "no-time", due: due("2026-10-13") }),
              sdkTask({ id: "cycle", due: due("2026-10-13T14:00:00") }),
              sdkTask({ id: "other-open", due: due("2026-10-12") }),
            ],
            nextCursor: null,
          };
    },
    async getCompletedTasksByDueDate(args) {
      return args.cursor === undefined
        ? {
            items: [
              sdkTask({
                id: "early-done",
                checked: true,
                due: due("2026-10-13T09:00:00"),
                completedAt: new Date("2026-10-14T00:30:00Z"),
              }),
            ],
            nextCursor: "done-2",
          }
        : {
            items: [
              sdkTask({
                id: "late-done",
                checked: true,
                due: due("2026-10-13T11:00:00"),
                completedAt: new Date("2026-10-13T13:00:00Z"),
              }),
              sdkTask({
                id: "cycle",
                due: due("2026-10-13T12:00:00"),
                completedAt: new Date("2026-10-13T12:30:00Z"),
              }),
              sdkTask({
                id: "cycle",
                due: due("2026-10-13T13:00:00"),
                completedAt: new Date("2026-10-13T13:30:00Z"),
              }),
              sdkTask({
                id: "neighbor-done",
                checked: true,
                due: due("2026-10-14"),
              }),
            ],
            nextCursor: null,
          };
    },
  });
  const tasks = await source.listDayTasks(reference);
  assert.deepEqual(
    tasks.map((task) => [task.id, task.completed]),
    [
      ["early-done", true],
      ["open", false],
      ["late-done", true],
      ["cycle", true],
      ["cycle", true],
      ["cycle", false],
      ["no-time", false],
    ]
  );
  assert.equal(
    Date.parse(tasks[0].completedAt ?? ""),
    Date.parse("2026-10-14T00:30:00Z")
  );
  assert.equal(tasks[1].completedAt, null);
  assert.equal(tasks.at(-1)?.start, null);
});

test("timeline fails atomically when a later completed-task page fails", async () => {
  const source = new TodoistTimelineSource({
    async getTasks() {
      return {
        results: [
          sdkTask({
            due: { date: "2026-10-13", isRecurring: false, string: "13 Oct" },
          }),
        ],
        nextCursor: null,
      };
    },
    async getCompletedTasksByDueDate(args) {
      if (args.cursor === undefined)
        return { items: [sdkTask({ checked: true })], nextCursor: "done-2" };
      throw new Error("Completed history unavailable");
    },
  });
  await assert.rejects(
    source.listDayTasks(referenceIn("UTC")),
    /Completed history unavailable/
  );
});

test("timeline terminates when the completed endpoint omits its final cursor despite SDK types", async () => {
  const api = new TodoistApi("fixture-token", {
    async customFetch(url) {
      const body = url.includes("/completed/")
        ? {
            items: [
              sdkTask({
                id: "done",
                checked: true,
                due: {
                  date: "2026-10-13",
                  isRecurring: false,
                  string: "13 Oct",
                },
              }),
            ],
          }
        : { results: [], nextCursor: null };
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        async text() {
          return JSON.stringify(body);
        },
        async json() {
          return body;
        },
      };
    },
  });
  const tasks = await new TodoistTimelineSource(api).listDayTasks(
    referenceIn("UTC")
  );
  assert.deepEqual(
    tasks.map((task) => [task.id, task.completed]),
    [["done", true]]
  );
});
