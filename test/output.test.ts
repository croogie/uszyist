import {test} from 'node:test';
import assert from 'node:assert/strict';
import {taskTable, activityTable} from '../src/cli/output.js';

test('Todoist task titles and labels cannot emit terminal control sequences', () => {
  const output = taskTable([{id: '1', title: 'Read\u001b[2J\nsecret', labels: ['x\u009by'], plannedDate: null, start: null, end: null, deadline: null, url: 'https://todoist.com'}]);
  assert.doesNotMatch(output, /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/u);
});

test('Activity metadata cannot emit escape sequences', () => {
  const output = activityTable([{id: '1', eventType: 'added', objectType: 'task', objectId: '2', title: '\u001b]52;c;secret\u0007', occurredAt: '2026-10-13T10:00:00Z'}]);
  assert.equal(output.includes('\u001b'), false);
  assert.equal(output.includes('\u0007'), false);
});
