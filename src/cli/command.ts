import {Command} from '@oclif/core';
import {readConfig} from './config.js';
import {taskTable, activityTable} from './output.js';
import {createReference, clockInstant, parseClock} from '../time/reference.js';
import {selectTasks} from '../modules/tasks/queries.js';
import {assessPlanning} from '../modules/planning/assess-planning.js';
import {selectActivity} from '../modules/activity/queries.js';
import {createTaskSource} from '../integrations/todoist/task-source.js';
import {createActivitySource} from '../integrations/todoist/activity-source.js';

interface QueryFlags {date?: string; time?: string; json: boolean; 'time-blocked'?: boolean; since?: string}
type TaskQuery = Parameters<typeof selectTasks>[1];

export abstract class WorkflowCommand extends Command {
  protected async executeQuery(kind: TaskQuery | 'planning' | 'activity', flags: QueryFlags): Promise<void> {
    // Validate before making a request; capture the clock only once per command.
    const reference = createReference(flags.date, flags.time);
    const since = flags.since === undefined ? undefined : parseClock(flags.since);
    if (since !== undefined) clockInstant(reference, since);
    const config = readConfig();
    if (kind === 'activity') {
      const events = await this.readTodoist(() => createActivitySource(config.token).listActivity(reference));
      const activity = selectActivity(events, reference, since);
      this.log(flags.json ? JSON.stringify({date: reference.date, since: since ?? null, activity}, null, 2) : activityTable(activity));
      return;
    }
    const tasks = await this.readTodoist(() => createTaskSource(config.token).listTasks());
    if (kind === 'planning') {
      const result = assessPlanning(tasks, reference, config.dayTaskLabel);
      this.log(flags.json ? JSON.stringify(result, null, 2) : `Planning complete: ${result.complete ? 'yes' : 'no'}\nDate: ${result.date}\nTask-of-the-day label: ${result.dayTaskLabel}\n\n${taskTable(result.qualifyingTasks)}`);
      return;
    }
    const selected = selectTasks(tasks, kind, reference, {dayTaskLabel: config.dayTaskLabel, timeBlocked: flags['time-blocked']});
    const temporal = kind === 'current' || kind === 'next' || kind === 'elapsed';
    const result = {date: reference.date, ...(temporal ? {referenceTime: reference.time} : {}), tasks: selected};
    this.log(flags.json ? JSON.stringify(result, null, 2) : taskTable(selected));
  }

  private async readTodoist<T>(read: () => Promise<T>): Promise<T> {
    try {
      return await read();
    } catch (error) {
      // SDK errors may contain request metadata. Never serialize them or expose credentials.
      const status = error !== null && typeof error === 'object' && 'httpStatusCode' in error && typeof error.httpStatusCode === 'number' ? ` (HTTP ${error.httpStatusCode})` : '';
      this.error(`Unable to read Todoist data${status}. Check API access, network connectivity, and the supported data format.`);
    }
  }
}
