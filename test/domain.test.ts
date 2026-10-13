process.env.TZ = 'America/New_York'

import assert from 'node:assert/strict'
import test from 'node:test'

import {selectActivity} from '../src/modules/activity/queries.js'
import type {Activity} from '../src/modules/activity/activity.js'
import {assessPlanning} from '../src/modules/planning/assess-planning.js'
import {selectTasks} from '../src/modules/tasks/queries.js'
import type {Task} from '../src/modules/tasks/task.js'
import {clockInstant, createReference, parseClock} from '../src/time/reference.js'

const reference = createReference('2026-10-13', '10:00', new Date('2026-10-13T14:00:00Z'))

function task(overrides: Partial<Task> & Pick<Task, 'id'>): Task {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    labels: overrides.labels ?? [],
    plannedDate: overrides.plannedDate === undefined ? '2026-10-13' : overrides.plannedDate,
    start: overrides.start ?? null,
    end: overrides.end ?? null,
    deadline: overrides.deadline ?? null,
    url: overrides.url ?? `https://todoist.example/${overrides.id}`,
  }
}

function activity(overrides: Partial<Activity> & Pick<Activity, 'id' | 'occurredAt'>): Activity {
  return {
    id: overrides.id,
    eventType: overrides.eventType ?? 'updated',
    objectType: overrides.objectType ?? 'item',
    objectId: overrides.objectId ?? null,
    title: overrides.title ?? null,
    occurredAt: overrides.occurredAt,
  }
}

test('reference validates local calendars and resolves DST clocks deterministically', () => {
  assert.equal(parseClock('09:05'), '09:05:00')
  assert.equal(parseClock('09:05:06'), '09:05:06')
  assert.throws(() => parseClock('24:00'))
  const defaults = createReference(undefined, undefined, new Date('2026-10-13T14:00:05Z'))
  assert.equal(defaults.date, '2026-10-13')
  assert.equal(defaults.time, '10:00:05')
  assert.throws(() => createReference('2026-02-29', '09:00'))
  assert.throws(() => createReference('2026-10-13', '9:00'))
  assert.throws(() => createReference('2026-03-08', '02:30'))

  const ambiguous = createReference('2026-11-01', '01:30')
  assert.equal(ambiguous.instant, Date.parse('2026-11-01T05:30:00Z'))
  assert.equal(clockInstant(ambiguous, '01:30'), Date.parse('2026-11-01T05:30:00Z'))
})

test('task list selects the assigned day and orders starts before unscheduled tasks', () => {
  const tasks = [
    task({id: 'z', start: null}),
    task({id: 'b', start: '2026-10-13T09:00:00-04:00'}),
    task({id: 'a', start: '2026-10-13T09:00:00-04:00'}),
    task({id: 'other-day', plannedDate: '2026-10-12', start: '2026-10-12T09:00:00-04:00'}),
  ]

  assert.deepEqual(selectTasks(tasks, 'list', reference).map(({id}) => id), ['a', 'b', 'z'])
})

test('current, next, and elapsed task queries apply complete-block boundaries and ties', () => {
  const tasks = [
    task({id: 'current-a', start: '2026-10-13T09:00:00-04:00', end: '2026-10-13T10:30:00-04:00'}),
    task({id: 'current-b', start: '2026-10-13T10:00:00-04:00', end: '2026-10-13T11:00:00-04:00'}),
    task({id: 'ended', start: '2026-10-13T09:00:00-04:00', end: '2026-10-13T10:00:00-04:00'}),
    task({id: 'missing-end', start: '2026-10-13T09:30:00-04:00'}),
    task({id: 'reverse', start: '2026-10-13T11:00:00-04:00', end: '2026-10-13T10:30:00-04:00'}),
    task({id: 'next-b', start: '2026-10-13T11:00:00-04:00'}),
    task({id: 'next-a', start: '2026-10-13T11:00:00-04:00', end: '2026-10-13T11:30:00-04:00'}),
    task({id: 'later', start: '2026-10-13T12:00:00-04:00'}),
    task({id: 'other-day', plannedDate: '2026-10-14', start: '2026-10-14T09:00:00-04:00', end: '2026-10-14T11:00:00-04:00'}),
  ]

  assert.deepEqual(selectTasks(tasks, 'current', reference).map(({id}) => id), ['current-a', 'current-b'])
  // Next depends on the start, not on a valid duration or end.
  assert.deepEqual(selectTasks(tasks, 'next', reference).map(({id}) => id), ['next-a', 'next-b', 'reverse'])
  assert.deepEqual(selectTasks(tasks, 'elapsed', reference).map(({id}) => id), ['ended'])
})

test('day-task and planning queries require the selected label and positive time block', () => {
  const tasks = [
    task({id: 'qualifying-b', labels: ['day'], start: '2026-10-13T12:00:00-04:00', end: '2026-10-13T13:00:00-04:00'}),
    task({id: 'qualifying-a', labels: ['day'], start: '2026-10-13T11:00:00-04:00', end: '2026-10-13T12:00:00-04:00'}),
    task({id: 'start-only', labels: ['day'], start: '2026-10-13T09:00:00-04:00'}),
    task({id: 'wrong-label', labels: ['other'], start: '2026-10-13T09:00:00-04:00', end: '2026-10-13T10:00:00-04:00'}),
  ]

  assert.deepEqual(selectTasks(tasks, 'day-tasks', reference, {dayTaskLabel: 'day'}).map(({id}) => id), [
    'start-only',
    'qualifying-a',
    'qualifying-b',
  ])
  assert.deepEqual(selectTasks(tasks, 'day-tasks', reference, {dayTaskLabel: 'day', timeBlocked: true}).map(({id}) => id), [
    'qualifying-a',
    'qualifying-b',
  ])
  assert.deepEqual(assessPlanning(tasks, reference, 'day'), {
    date: '2026-10-13',
    dayTaskLabel: 'day',
    complete: true,
    qualifyingTasks: [tasks[1], tasks[0]],
  })
  assert.deepEqual(assessPlanning([tasks[2]], reference, 'day'), {
    date: '2026-10-13',
    dayTaskLabel: 'day',
    complete: false,
    qualifyingTasks: [],
  })
})

test('deadline selection ignores a task assigned date', () => {
  const tasks = [
    task({id: 'unassigned', plannedDate: null, deadline: '2026-10-13'}),
    task({id: 'another-day', plannedDate: '2026-10-20', deadline: '2026-10-13', start: '2026-10-20T09:00:00-04:00'}),
    task({id: 'other-deadline', deadline: '2026-10-14'}),
  ]

  assert.deepEqual(selectTasks(tasks, 'deadlines', reference).map(({id}) => id), ['another-day', 'unassigned'])
})

test('activity selection uses the local half-open day and an inclusive since clock', () => {
  const events = [
    activity({id: 'after', occurredAt: '2026-10-13T11:00:00-04:00'}),
    activity({id: 'end', occurredAt: '2026-10-14T00:00:00-04:00'}),
    activity({id: 'start', occurredAt: '2026-10-13T00:00:00-04:00'}),
    activity({id: 'before', occurredAt: '2026-10-12T23:59:59-04:00'}),
    activity({id: 'since', occurredAt: '2026-10-13T10:00:00-04:00'}),
  ]

  assert.deepEqual(selectActivity(events, reference).map(({id}) => id), ['start', 'since', 'after'])
  assert.deepEqual(selectActivity(events, reference, '10:00').map(({id}) => id), ['since', 'after'])
})

test('implicit now preserves the actual instant in the repeated fall-back hour', () => {
  const now = new Date('2026-11-01T06:30:05Z')
  const value = createReference(undefined, undefined, now)
  assert.equal(value.time, '01:30:05')
  assert.equal(value.instant, now.getTime())
})

test('a local day remains queryable when DST skips midnight', () => {
  const originalZone = process.env.TZ
  process.env.TZ = 'America/Santiago'
  try {
    const value = createReference('2026-09-06', '12:00')
    assert.equal(value.dayEnd - value.dayStart, 23 * 60 * 60_000)
    assert.equal(value.dayStart, Date.parse('2026-09-06T01:00:00-03:00'))
  } finally {
    process.env.TZ = originalZone
  }
})
