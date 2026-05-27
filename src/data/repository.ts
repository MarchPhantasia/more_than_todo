import { createMoreTodoDb, type MoreTodoDb } from "./db";
import type { Area, FocusSession, Project, ProjectSection, Tag, Task } from "../domain/types";

export interface TaskRepository {
  listTasks(): Promise<Task[]>;
  saveTask(task: Task): Promise<void>;
  deleteTask(taskId: string): Promise<void>;
  listProjects(): Promise<Project[]>;
  saveProject(project: Project): Promise<void>;
  deleteProject(projectId: string): Promise<void>;
  listAreas(): Promise<Area[]>;
  saveArea(area: Area): Promise<void>;
  deleteArea(areaId: string): Promise<void>;
  listSections(): Promise<ProjectSection[]>;
  saveSection(section: ProjectSection): Promise<void>;
  deleteSection(sectionId: string): Promise<void>;
  listTags(): Promise<Tag[]>;
  saveTag(tag: Tag): Promise<void>;
  listFocusSessions(): Promise<FocusSession[]>;
  saveFocusSession(session: FocusSession): Promise<void>;
  clear?(): Promise<void>;
}

class DexieTaskRepository implements TaskRepository {
  constructor(private readonly db: MoreTodoDb) {}

  async listTasks(): Promise<Task[]> {
    return this.db.tasks.orderBy("createdAt").toArray();
  }

  async saveTask(task: Task): Promise<void> {
    await this.db.tasks.put(task);
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.db.tasks.delete(taskId);
  }

  async listProjects(): Promise<Project[]> {
    return this.db.projects.orderBy("createdAt").toArray();
  }

  async saveProject(project: Project): Promise<void> {
    await this.db.projects.put(project);
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.db.projects.delete(projectId);
  }

  async listAreas(): Promise<Area[]> {
    return this.db.areas.orderBy("createdAt").toArray();
  }

  async saveArea(area: Area): Promise<void> {
    await this.db.areas.put(area);
  }

  async deleteArea(areaId: string): Promise<void> {
    await this.db.areas.delete(areaId);
  }

  async listSections(): Promise<ProjectSection[]> {
    return this.db.sections.orderBy("sortOrder").toArray();
  }

  async saveSection(section: ProjectSection): Promise<void> {
    await this.db.sections.put(section);
  }

  async deleteSection(sectionId: string): Promise<void> {
    await this.db.sections.delete(sectionId);
  }

  async listTags(): Promise<Tag[]> {
    return this.db.tags.orderBy("createdAt").toArray();
  }

  async saveTag(tag: Tag): Promise<void> {
    await this.db.tags.put(tag);
  }

  async listFocusSessions(): Promise<FocusSession[]> {
    return this.db.focusSessions.orderBy("startedAt").toArray();
  }

  async saveFocusSession(session: FocusSession): Promise<void> {
    await this.db.focusSessions.put(session);
  }

  async clear(): Promise<void> {
    await this.db.transaction(
      "rw",
      [this.db.tasks, this.db.projects, this.db.areas, this.db.sections, this.db.tags, this.db.focusSessions],
      async () => {
        await Promise.all([
          this.db.tasks.clear(),
          this.db.projects.clear(),
          this.db.areas.clear(),
          this.db.sections.clear(),
          this.db.tags.clear(),
          this.db.focusSessions.clear()
        ]);
      }
    );
  }
}

export const createTaskRepository = (dbName?: string): TaskRepository =>
  new DexieTaskRepository(createMoreTodoDb(dbName));
