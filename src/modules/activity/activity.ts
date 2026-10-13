export interface Activity {
  id: string;
  eventType: string;
  objectType: string;
  objectId: string | null;
  title: string | null;
  occurredAt: string;
}
