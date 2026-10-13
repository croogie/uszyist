export interface Task {
  id: string;
  title: string;
  labels: string[];
  plannedDate: string | null;
  start: string | null;
  end: string | null;
  deadline: string | null;
  url: string;
}
