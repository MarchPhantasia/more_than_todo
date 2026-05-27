import Dexie, { type EntityTable } from "dexie";
import type { Area, FocusSession, Project, ProjectSection, Tag, Task } from "../domain/types";

export class MoreTodoDb extends Dexie {
  tasks!: EntityTable<Task, "id">;
  projects!: EntityTable<Project, "id">;
  areas!: EntityTable<Area, "id">;
  sections!: EntityTable<ProjectSection, "id">;
  tags!: EntityTable<Tag, "id">;
  focusSessions!: EntityTable<FocusSession, "id">;

  constructor(name = "more-than-todo") {
    super(name);
    this.version(1).stores({
      tasks: "id, status, scheduledDate, dueDate, projectId, createdAt, updatedAt, completedAt",
      projects: "id, archived, createdAt, updatedAt",
      tags: "id, archived, createdAt, updatedAt",
      focusSessions: "id, taskId, status, startedAt"
    });

    this.version(2).stores({
      tasks:
        "id, status, scheduledDate, dueDate, projectId, areaId, sectionId, sortOrder, createdAt, updatedAt, completedAt",
      projects: "id, areaId, archived, createdAt, updatedAt",
      areas: "id, archived, createdAt, updatedAt",
      sections: "id, projectId, sortOrder, archived, createdAt, updatedAt",
      tags: "id, archived, createdAt, updatedAt",
      focusSessions: "id, taskId, status, startedAt"
    });
  }
}

export const createMoreTodoDb = (name?: string): MoreTodoDb => new MoreTodoDb(name);
