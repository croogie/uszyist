import {DateTime} from 'luxon'

export interface Reference {
  date: string
  time: string
  instant: number
  dayStart: number
  dayEnd: number
  zone: string
}

interface DateParts {
  year: number
  month: number
  day: number
}

function parseDate(value: string): DateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error(`Invalid date: ${value}`)

  const [year, month, day] = match.slice(1).map(Number)
  const parsed = DateTime.fromObject({year, month, day}, {zone: 'UTC'})
  if (!parsed.isValid || parsed.year !== year || parsed.month !== month || parsed.day !== day) {
    throw new Error(`Invalid date: ${value}`)
  }

  return {year, month, day}
}

/** Parses a wall-clock value and returns its canonical HH:mm:ss representation. */
export function parseClock(value: string): string {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match) throw new Error(`Invalid time: ${value}`)

  const hour = Number(match[1])
  const minute = Number(match[2])
  const second = match[3] === undefined ? 0 : Number(match[3])
  if (hour > 23 || minute > 59 || second > 59) throw new Error(`Invalid time: ${value}`)

  return `${match[1]}:${match[2]}:${String(second).padStart(2, '0')}`
}

function localDateTime(date: string, time: string, zone: string): DateTime {
  const {year, month, day} = parseDate(date)
  const [hour, minute, second] = parseClock(time).split(':').map(Number)
  const value = DateTime.fromObject({year, month, day, hour, minute, second}, {zone})
  const wallClock = `${date} ${time}`

  // Luxon shifts nonexistent wall clocks forward. Reject that normalization instead.
  if (!value.isValid || value.toFormat('yyyy-MM-dd HH:mm:ss') !== wallClock) {
    throw new Error(`Nonexistent local time: ${wallClock}`)
  }

  return value
}

/**
 * Resolves a clock on the reference date. During a fall-back ambiguity, use the
 * earliest instant so every caller makes the same deterministic choice.
 */
export function clockInstant(reference: Reference, time: string): number {
  const normalizedTime = parseClock(time)
  const value = localDateTime(reference.date, normalizedTime, reference.zone)
  const possible = value.getPossibleOffsets()
  return possible.reduce((earliest, candidate) =>
    candidate.toMillis() < earliest.toMillis() ? candidate : earliest,
  ).toMillis()
}

/** Whole-day queries resolve date boundaries without constructing an irrelevant clock. */
export function createDayReference(date?: string, now?: Date): Reference {
  const current = now ?? new Date()
  const currentLocal = DateTime.fromJSDate(current)
  const zone = currentLocal.zoneName
  if (zone === null) throw new Error('Unable to determine local timezone')
  const selectedDate = date ?? currentLocal.toISODate()
  if (selectedDate === null) throw new Error('Unable to determine local date')
  const dateParts = parseDate(selectedDate)

  // Some zones begin a DST day at 01:00 rather than midnight.
  const dayStartValue = DateTime.fromObject(dateParts, {zone}).startOf('day')
  if (!dayStartValue.isValid || dayStartValue.toISODate() !== selectedDate) {
    throw new Error(`Nonexistent local date: ${selectedDate}`)
  }
  const dayEndValue = dayStartValue.plus({days: 1}).startOf('day')
  return {
    date: selectedDate,
    time: dayStartValue.toFormat('HH:mm:ss'),
    instant: dayStartValue.toMillis(),
    dayStart: dayStartValue.toMillis(),
    dayEnd: dayEndValue.toMillis(),
    zone,
  }
}

export function createReference(date?: string, time?: string, now?: Date): Reference {
  const current = now ?? new Date()
  const currentLocal = DateTime.fromJSDate(current)
  const reference = createDayReference(date, current)
  const selectedTime = parseClock(time ?? currentLocal.toFormat('HH:mm:ss'))
  const instant = time === undefined && reference.date === currentLocal.toISODate()
    ? currentLocal.startOf('second').toMillis()
    : clockInstant(reference, selectedTime)
  return {...reference, time: selectedTime, instant}
}
