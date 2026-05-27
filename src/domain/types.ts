export type DateKey = string;

export type Priority = "none" | "low" | "medium" | "high";
export type TaskStatus = "open" | "completed";
export type ColorToken = "teal" | "blue" | "coral" | "amber" | "focus" | "violet";

export type RepeatRule =
  | { type: "daily"; interval: number }
  | { type: "weekly"; interval: number }
  | { type: "monthly"; interval: number }
  | { type: "interval"; interval: number; unit: "day" | "week" | "month" };

export interface Task {
  id: string;
  title: string;
  notes: string;
  status: TaskStatus;
  priority: Priority;
  scheduledDate?: DateKey;
  dueDate?: DateKey;
  projectId?: string;
  areaId?: string;
  sectionId?: string;
  tagIds: string[];
  repeatRule?: RepeatRule;
  pomodoroEstimate: number;
  checklistItems: ChecklistItem[];
  sortOrder: number;
  list?: "inbox" | "anytime";
  someday?: boolean;
  deletedAt?: string;
  recurrenceSourceId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface Project {
  id: string;
  name: string;
  color: ColorToken;
  areaId?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Area {
  id: string;
  name: string;
  color: ColorToken;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSection {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  sortOrder: number;
}

export interface Tag {
  id: string;
  name: string;
  color: ColorToken;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FocusSession {
  id: string;
  taskId?: string;
  plannedMinutes: number;
  startedAt: string;
  endedAt?: string;
  status: "completed" | "cancelled";
}
