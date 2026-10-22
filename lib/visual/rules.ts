import { ActivityEventLogSchema, type ActivityEvent } from "./contracts.ts";

/**
 * Returns the events a student may see. A result stays hidden until that same
 * activity has a prediction, so students can't read the outcome before committing.
 */
export function toStudentActivityEvents(
  events: readonly ActivityEvent[],
): ActivityEvent[] {
  const checked = ActivityEventLogSchema.parse(events);
  const predicted = new Set<string>();
  const visible: ActivityEvent[] = [];

  for (const event of checked) {
    if (event.type === "prediction") {
      predicted.add(event.activity_id);
    }
    if (
      event.type === "experiment_result" &&
      !predicted.has(event.activity_id)
    ) {
      continue;
    }
    visible.push(event);
  }

  return visible;
}
