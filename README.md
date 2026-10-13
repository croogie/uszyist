# uszyist

A planned read-only CLI for the Uszy Todoist workflow: inspect daily tasks and time blocks, check planning criteria, and retrieve recorded activity.

## Status

**Design approved; implementation has not started.** This repository currently contains the domain glossary and development plan. There is no runnable CLI or installation package yet. The commands below describe the approved interface, not available functionality.

## Planned interface

| Command | Purpose |
| --- | --- |
| `uszyist tasks list` | List incomplete tasks assigned to a selected day |
| `uszyist tasks day-tasks` | List tasks of the day using the configured label; optionally require a complete time block with `--time-blocked` |
| `uszyist tasks current` | List all tasks whose time blocks contain the reference moment |
| `uszyist tasks next` | List tasks sharing the nearest future start time |
| `uszyist tasks elapsed` | List incomplete tasks whose time blocks have ended |
| `uszyist tasks deadlines` | List tasks with a deadline on the selected day |
| `uszyist planning status` | Check whether at least one task of the day has a complete time block |
| `uszyist activity list` | List recorded Todoist events without inferring focus or productivity |

All commands will support `--date YYYY-MM-DD`, `--json`, and `--help`. The date defaults to today in the system's local timezone.

Time-based task queries will accept `--time HH:mm[:ss]`, defaulting to the current local clock time. Activity will accept `--since HH:mm[:ss]`; without it, the query covers the whole selected day. Output will be a human-readable table by default, with a stable JSON contract for scripts.

## Workflow semantics

- A task of the day is designated by a label, defaulting to `zadanie-dnia`.
- A complete time block requires a concrete start time and a positive duration. Its start is inclusive and its end is exclusive.
- Current-task queries return all overlapping blocks; next-task queries return all ties at the nearest future start.
- Deadlines are independent of assigned task dates and time blocks.
- Planning assessment uses incomplete tasks only. Completing the last qualifying task can change the status to false: this describes the current plan, not a persisted record of morning planning.
- Queries use current Todoist data; selecting a past date does not reconstruct historical task state.
- The tool will not modify tasks.

## Planned implementation

- **Oclif + TypeScript** for commands, parameters, and help.
- **Official Todoist SDK** (`@doist/todoist-sdk`) behind an adapter; no `td` subprocesses.
- **Node.js >=24**, with the SDK version pinned and verified during development.
- Separate task, planning, and activity modules. Workflow rules remain independent of SDK types and command rendering.
- Complete cursor pagination rather than silently returning only the first page.

Planned configuration:

| Environment variable | Purpose |
| --- | --- |
| `TODOIST_API_TOKEN` | API access token, required for queries; never passed as a command-line argument or printed |
| `USZYIST_DAY_TASK_LABEL` | Task-of-the-day label; defaults to `zadanie-dnia` when absent |

Help will work without credentials or network access. Never commit API tokens or private task data to this public repository.

## Design documentation

- [Domain glossary](CONTEXT.md)
- [Approved CLI design, module structure, development sequence, and acceptance criteria](docs/development-plan.md)

Development starts by verifying the published SDK's date, timezone, duration, deadline, activity, and pagination behavior against real read-only Todoist data. No authenticated runtime verification has been performed yet.
