# uszyist

A read-only CLI for the Uszy Todoist workflow: inspect daily tasks and time blocks, check planning criteria, and retrieve recorded activity.

## Status

The CLI implements nine commands using Oclif, TypeScript, and the official Todoist SDK. It does not modify tasks.

## Installation

The npm package is **not published yet**. After the authorized first publication, install the CLI globally or run it once without a global install:

```sh
npm install --global uszyist
uszyist --help

npx --yes uszyist --help
```

Requires Node.js >=24 and npm >=11. The Todoist SDK also declares both engine requirements, so npm >=11 is retained for consumers as well as development. Supported systems are Linux and macOS; Windows is outside the supported matrix.

To upgrade a global installation after publication:

```sh
npm install --global uszyist@latest
```

Keep `TODOIST_API_TOKEN` in your shell environment or secret manager. Never place it in command-line arguments, committed files, shell history, issue reports, or pull requests. Help requires no credentials.

```sh
uszyist tasks --help
uszyist tasks day-tasks --time-blocked
uszyist tasks timeline --date 2026-10-13
uszyist tasks current --date 2026-10-13 --time 10:15 --json
uszyist planning status
uszyist activity list --since 07:00
```

## Development from source

Source installation is for development, not the consumer installation path. It requires Node.js >=24 and npm >=11.

```sh
git clone https://github.com/croogie/uszyist.git
cd uszyist
npm ci
npm run build
npm link
uszyist --help
```

Alternatively, run `node bin/run.js` after building.

## Commands

| Command                   | Purpose                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `uszyist tasks list`      | List incomplete tasks assigned to a selected day                                                                 |
| `uszyist tasks timeline`  | List open and completed tasks assigned to a day, ordered by planned start; tasks without a start appear last     |
| `uszyist tasks day-tasks` | List tasks of the day using the configured label; optionally require a complete time block with `--time-blocked` |
| `uszyist tasks current`   | List all tasks whose time blocks contain the reference moment                                                    |
| `uszyist tasks next`      | List tasks sharing the nearest future start time                                                                 |
| `uszyist tasks elapsed`   | List incomplete tasks whose time blocks have ended                                                               |
| `uszyist tasks deadlines` | List tasks with a deadline on the selected day                                                                   |
| `uszyist planning status` | Check whether at least one task of the day has a complete time block                                             |
| `uszyist activity list`   | List recorded Todoist events without inferring focus or productivity                                             |

All commands support `--date YYYY-MM-DD`, `--json`, and `--help`. The date defaults to today in the system's local timezone.

Time-based task queries accept `--time HH:mm[:ss]`, defaulting to the current local clock time, even for another selected date. Activity accepts `--since HH:mm[:ss]`; without it, the query covers the whole selected day. Output is a human-readable table by default, with a stable JSON contract for scripts.

`tasks timeline` covers the whole selected day and does not accept `--time`. It includes all labels. Completed history is queried by assigned date, not completion date: a task completed on another day still belongs to its planned day. Recurring completions are retained as separate occurrences, even if they share an ID. The table distinguishes `open` and `done`.

Invalid calendar dates and nonexistent daylight-saving clock times are rejected. Explicit ambiguous fall-back clock times resolve to the earlier instant; the default “now” preserves the actual current instant. Local days that begin after midnight remain queryable. SDK minute durations represent elapsed minutes; day durations use calendar days in the normalized local timezone.

## Workflow semantics

- A task of the day is designated by a label, defaulting to `zadanie-dnia`.
- A complete time block requires a concrete start time and a positive duration. Its start is inclusive and its end is exclusive.
- Current-task queries return all overlapping blocks; next-task queries return all ties at the nearest future start.
- Deadlines are independent of assigned task dates and time blocks.
- Planning assessment uses incomplete tasks only. Completing the last qualifying task can change the status to false: this describes the current plan, not a persisted record of morning planning.
- Queries use current Todoist data; selecting a past date does not reconstruct historical task state.
- The tool does not modify tasks.

## Architecture

- **Oclif + TypeScript** for commands, parameters, and help.
- **Official Todoist SDK** (`@doist/todoist-sdk`) behind an adapter; no `td` subprocesses.
- **Node.js >=24**, with Todoist SDK **15.3.1** pinned in the lockfile.
- Separate task, planning, and activity modules. Workflow rules remain independent of SDK types and command rendering.
- Complete cursor pagination rather than silently returning only the first page.

## Configuration

| Environment variable     | Purpose                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `TODOIST_API_TOKEN`      | API access token, required for queries; never passed as a command-line argument or printed |
| `USZYIST_DAY_TASK_LABEL` | Task-of-the-day label; defaults to `zadanie-dnia` when absent                              |

An explicitly empty `USZYIST_DAY_TASK_LABEL` is rejected. Help works without credentials or network access. Never commit API tokens or private task data to this public repository.

## Output and errors

Task-list JSON contains `date`, `tasks`, and, for time-based queries, normalized `referenceTime`. Tasks expose `id`, `title`, `labels`, `plannedDate`, `start`, `end`, `deadline`, and `url`; absent temporal values are `null`.

Timeline JSON uses `date` and `tasks`, adding `completed` and `completedAt` to each task; it has no `referenceTime`. `completedAt` is a local-offset ISO timestamp when available, otherwise `null`.

Planning JSON contains `date`, `dayTaskLabel`, `complete`, and `qualifyingTasks`. Activity JSON contains `date`, normalized `since` (or `null`), and `activity`; events expose `id`, `eventType`, `objectType`, `objectId`, `title`, and `occurredAt`. Missing titles are `null`; when Todoist omits an event ID, a deterministic identifier is derived from its object and timestamp.

Empty results and `complete: false` return exit code 0. Parameter, configuration, and API failures return a nonzero exit code with an error on stderr, without partial results or request credentials. API timestamps are rendered with the system's local offset.

## Development

```sh
npm run build
npm run check
npm test
```

Tests cover query boundaries, overlaps, nearest-start ties, planning criteria, deadline independence, DST, activity windows, SDK mapping, pagination failures, and terminal control characters. Tests use deterministic fixtures and do not require a token.

## Design documentation

- [Domain glossary](https://github.com/croogie/uszyist/blob/main/CONTEXT.md)
- [Approved CLI design, module structure, development sequence, and acceptance criteria](https://github.com/croogie/uszyist/blob/main/docs/development-plan.md)
- [npm publication and open-source CLI standards implementation plan](https://github.com/croogie/uszyist/blob/main/docs/npm-release-plan.md)

Read-only SDK access and all nine CLI commands have been smoke-tested against a real Todoist account in both JSON and table modes. Root, group, and command help were also verified without credentials. Timeline verification included both open and completed tasks, chronological ordering, the default date, and rejection of `--time`. No private task content is stored in this repository.
