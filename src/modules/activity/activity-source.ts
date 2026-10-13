import type { Reference } from "../../time/reference.js";
import type { Activity } from "./activity.js";

export interface ActivitySource {
  listActivity(reference: Reference): Promise<Activity[]>;
}
