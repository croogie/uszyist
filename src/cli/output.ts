import type {Task} from '../modules/tasks/task.js';
import type {Activity} from '../modules/activity/activity.js';

// Todoist content is untrusted terminal input; keep control sequences out of tables.
function cell(value: string | null): string {
  return (value ?? '—').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ');
}
function table(headers: string[], rows: (string | null)[][]): string {
  const clean = [headers, ...rows].map(row => row.map(cell));
  const widths = headers.map((_, column) => Math.max(...clean.map(row => [...row[column]].length)));
  const line = (row: string[]) => row.map((value, i) => value + ' '.repeat(widths[i] - [...value].length)).join('  ').trimEnd();
  return [line(clean[0]), widths.map(width => '─'.repeat(width)).join('  '), ...clean.slice(1).map(line), ...(rows.length ? [] : ['No results.'])].join('\n');
}
export function taskTable(tasks: Task[]): string {
  return table(['ID', 'TASK', 'DATE', 'START', 'END', 'DEADLINE', 'LABELS'], tasks.map(task => [task.id, task.title, task.plannedDate, task.start, task.end, task.deadline, task.labels.join(', ')]));
}
export function activityTable(events: Activity[]): string {
  return table(['ID', 'OCCURRED AT', 'EVENT', 'OBJECT TYPE', 'OBJECT ID', 'TITLE'], events.map(event => [event.id, event.occurredAt, event.eventType, event.objectType, event.objectId, event.title]));
}
