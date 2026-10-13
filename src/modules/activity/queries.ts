import { DateTime } from "luxon";

import { clockInstant } from "../../time/reference.js";
import type { Reference } from "../../time/reference.js";
import type { Activity } from "./activity.js";

export function selectActivity(
  events: Activity[],
  reference: Reference,
  since?: string
): Activity[] {
  const lowerBound =
    since === undefined ? reference.dayStart : clockInstant(reference, since);
  return events
    .map((event) => {
      const parsed = DateTime.fromISO(event.occurredAt, { setZone: true });
      return { event, instant: parsed.isValid ? parsed.toMillis() : null };
    })
    .filter(
      (entry): entry is { event: Activity; instant: number } =>
        entry.instant !== null &&
        entry.instant >= lowerBound &&
        entry.instant < reference.dayEnd
    )
    .sort(
      (left, right) =>
        left.instant - right.instant ||
        left.event.id.localeCompare(right.event.id)
    )
    .map((entry) => entry.event);
}
