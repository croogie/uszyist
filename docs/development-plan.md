# Uszyist CLI: approved design and development plan

## Scope

Read-only Todoist workflow CLI: task queries, activity queries, and planning assessment. No task mutations, focus inference, historical state reconstruction, local workflow state, external plugin system, or `td` subprocesses.

Use Oclif, TypeScript, and the official `@doist/todoist-sdk`. Require Node >=24; the currently published SDK 15.3.1 declares npm >=11. Pin and verify the published SDK during development rather than assuming the repository's main branch exactly matches the release.

The domain glossary is in [CONTEXT.md](../CONTEXT.md).

## Commands

Executable: `uszyist`. Command separator: space. Commands, flags, help, messages, and JSON fields are English.

| Command | Meaning | Additional flags |
| --- | --- | --- |
| `tasks list` | Incomplete tasks assigned to the selected day, including tasks without a start time | None |
| `tasks day-tasks` | Incomplete tasks assigned to the selected day with the configured task-of-the-day label | `--time-blocked` |
| `tasks current` | All incomplete tasks assigned to the selected day whose complete time blocks contain the reference moment | `--time` |
| `tasks next` | All incomplete tasks assigned to the selected day sharing the nearest start strictly after the reference moment; duration is not required | `--time` |
| `tasks elapsed` | Incomplete tasks assigned to the selected day whose complete time blocks have ended | `--time` |
| `tasks deadlines` | Incomplete tasks with a deadline on the selected day, regardless of their assigned day | None |
| `planning status` | Whether at least one incomplete task of the day has a complete time block on the selected day | None |
| `activity list` | Recorded Todoist events within the selected day, without interpreting focus | `--since` |

All commands accept `--date YYYY-MM-DD`, `--json`, and `--help`.

- Date defaults to today's date in the system's local timezone.
- `--time HH:mm[:ss]` defaults to the current local clock time, including when another date is explicitly selected.
- `--since HH:mm[:ss]` is an optional activity lower boundary; omission means the whole selected day, not the current time.
- `--time-blocked` restricts task-of-the-day results to tasks with a concrete start and positive duration.
- Help works at root, group, and command levels without a token or network access. It explains semantics, parameters, defaults, and examples.
- Each execution resolves the current moment once. API timestamps must be normalized to the reference timezone before comparison; date-only values must not be converted to midnight time blocks.
- A time block includes its start and excludes its end: `start <= reference < end`. At its end it belongs to `elapsed`, not `current`.
- Queries use current Todoist data. Selecting a past date does not reconstruct past task state.

Examples:

```sh
uszyist --help
uszyist tasks --help
uszyist tasks current --help
uszyist tasks day-tasks --time-blocked
uszyist tasks current --date 2026-10-13 --time 10:15
uszyist tasks next --json
uszyist planning status
uszyist activity list --since 07:00
```

## Configuration

| Variable | Contract |
| --- | --- |
| `TODOIST_API_TOKEN` | Required for API queries; never passed as a command-line flag or printed |
| `USZYIST_DAY_TASK_LABEL` | Defaults to `zadanie-dnia` when absent; an explicitly empty value is a configuration error |

The label is shared by task-of-the-day listing and planning assessment. No configuration file, authentication command, keychain integration, or OAuth flow is included.

## Results and errors

Human-readable tables by default; `--json` outputs an independently owned contract, never raw SDK responses. Both representations use the same query result.

- Empty query results are successful, with exit code 0.
- Planning not complete is a successful result with `complete: false`.
- Invalid parameters, invalid configuration, and API failures report errors on stderr and return a nonzero exit code.
- Never present partially fetched pages as a complete successful result.
- Task results sort by start, with tasks without a start last and ID as a tie-breaker. Activity sorts chronologically.

Proposed task-list JSON fields: `date`, optional `referenceTime`, and `tasks`. Each task has `id`, `title`, `labels`, `plannedDate`, `start`, `end`, `deadline`, and `url`. Missing temporal values are `null`.

Planning JSON fields: `date`, `dayTaskLabel`, `complete`, and `qualifyingTasks`. Human output includes the status and its supporting tasks.

Planning completion requires at least one task with the configured label and a complete block. It does not depend on title grammar, breaks, or overlap checks. Completed tasks do not participate: completing the last qualifying task can change the status to false. This evaluates the present plan, not a persisted fact that morning planning occurred.

Activity JSON fields are `date`, normalized `since` (or `null`), and `activity`. Each event exposes `id`, `eventType`, `objectType`, `objectId`, `title`, and `occurredAt`; missing metadata is `null`. When the API omits an event ID, the adapter derives a deterministic identifier from object type, object ID, event type, and timestamp. SDK types remain confined to the adapter.

## Module structure

```text
src/
├── commands/
│   ├── tasks/
│   │   ├── list.ts
│   │   ├── day-tasks.ts
│   │   ├── current.ts
│   │   ├── next.ts
│   │   ├── elapsed.ts
│   │   └── deadlines.ts
│   ├── planning/status.ts
│   └── activity/list.ts
├── modules/
│   ├── tasks/
│   │   ├── task.ts
│   │   ├── queries.ts
│   │   └── task-source.ts
│   ├── planning/
│   │   └── assess-planning.ts
│   └── activity/
│       ├── activity.ts
│       ├── queries.ts
│       └── activity-source.ts
├── integrations/todoist/
│   ├── task-source.ts
│   ├── activity-source.ts
│   └── mapping.ts
├── cli/
│   ├── config.ts
│   ├── flags.ts
│   └── output.ts
└── time/
    └── reference.ts
```

- Commands parse parameters, invoke queries, and render output. No workflow rules or SDK imports.
- Tasks owns the task model and query selection rules.
- Planning assesses task data without independently fetching the same tasks.
- Activity owns event representation and time-window selection.
- Todoist adapters own SDK calls, cursor pagination, and API-to-domain mapping.
- Source interfaces expose only required reads, not the entire SDK.
- Time utilities resolve and interpret the reference moment consistently.
- CLI utilities own configuration, shared flags, and output formats.

Add a query to its existing module plus an Oclif command. Add a module for a new functional area. Do not introduce a generic query registry, workflow engine, or dynamic plugin architecture.

## Development sequence

1. **Verify the published SDK contract.** Pin the package. Check task date/time/timezone, duration, deadline, and activity fields. Exercise mapping and pagination with real account data using read-only requests. Do not interpret date-only tasks as midnight blocks.
2. **Make the CLI runnable.** Configure Oclif and TypeScript, command groups, help, shared flags, configuration, and errors. Verify help without credentials.
3. **Complete the first vertical slice.** SDK adapter → task model → `tasks list` → table and JSON. Compare actual output with Todoist, including date-only tasks.
4. **Implement task queries.** Add `day-tasks`, `deadlines`, `current`, `next`, and `elapsed`. Test interval boundaries, overlapping blocks, tied next starts, missing duration, and deadline independence. Verify API timezone interpretation and daylight-saving boundaries.
5. **Implement planning assessment.** Add `planning status` and configurable label. Verify both outcomes; label alone or a start without duration must not qualify.
6. **Implement activity.** Complete pagination, local day boundaries, optional lower time boundary, chronological ordering, and stable event output. No productivity assessment.
7. **Verify and document the complete CLI.** Exercise all eight commands against real Todoist data. Check tables, parseable JSON, help, empty results, and access errors. Document configuration, temporal semantics, and historical-query limitations.

Permanent tests target consumer-visible boundaries and invariants, not source text, wiring, or mock forwarding. CLI smoke runs against actual surfaces supplement tests.

## Acceptance criteria

- All eight commands operate end-to-end; command stubs do not constitute delivery.
- Root, group, and command help reflect implemented behavior and work without API access.
- Date and time defaults match the specified contracts.
- Pagination cannot silently omit matching data.
- Tables and JSON express the same results; SDK types do not leak into domain modules or public output.
- Time selection returns all current overlaps and all nearest-next ties.
- Planning requires a complete block and the configured label, using active tasks only.
- Deadline queries do not depend on the assigned task date.
- Activity exposes recorded events without unsupported focus claims.
- No task mutations occur.

## Research evidence and verification status

Official sources consulted:

- [SDK repository and README](https://github.com/Doist/todoist-sdk-typescript): official package and client usage.
- [Task client](https://github.com/Doist/todoist-sdk-typescript/blob/main/src/clients/task-client.ts): task/filter reads and cursor-based responses.
- [Activity client](https://github.com/Doist/todoist-sdk-typescript/blob/main/src/clients/activity-client.ts): activity reads, date boundaries, and cursor-based responses.
- [Published npm metadata](https://registry.npmjs.org/@doist%2Ftodoist-sdk/latest): version 15.3.1 and Node >=24 / npm >=11 requirements observed during design. The README's lower Node requirement conflicts with published metadata; use package requirements.

Version 0.1.0 implements all eight commands. Authenticated SDK reads and each CLI command have been exercised against real Todoist data in JSON and table modes; root, group, and command help were checked without credentials. Real API v1 data supplied timed values in `due.date` without `due.datetime`; the adapter supports both representations and retains date-only tasks without manufacturing midnight blocks. Deterministic tests cover temporal rules, mapping, pagination, failures, and terminal output. API calls performed during verification were read-only.

Live activity verification also established that `dateTo` excludes events later on its named UTC date, despite the SDK's inclusive wording. The adapter requests through the next UTC date and applies the exact local half-open day window afterward. A regression test and a real-account check confirm that the latest event is retained.

Explicit ambiguous fall-back clocks use the earlier instant, while an omitted time on today's date preserves the actual current instant. Nonexistent explicit clocks are rejected; dates whose first valid instant is after midnight remain queryable.
