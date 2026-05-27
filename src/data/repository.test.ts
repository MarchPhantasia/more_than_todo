import { afterEach, describe, expect, it } from "vitest";
import { createTaskRepository } from "./repository";
import type { Area, FocusSession, Project, ProjectSection, Tag, Task } from "../domain/types";

const dbNames: string[] = [];

const repository = () => {
  const name = `more-than-todo-test-${crypto.randomUUID()}`;
  dbNames.push(name);
  return createTaskRepository(name);
};

afterEach(async () => {
  await Promise.all(dbNames.splice(0).map((name) => indexedDB.deleteDatabase(name)));
});

describe("task repository", () => {
  it("persists tasks, projects, tags, and focus sessions in IndexedDB", async () => {
    const repo = repository();
    const task: Task = {
      id: "task-1",
      title: "Plan launch",
      notes: "",
      status: "open",
      priority: "high",
      scheduledDate: "2026-05-27",
      dueDate: "2026-05-28",
      projectId: "project-1",
      areaId: "area-1",
      sectionId: "section-1",
      tagIds: ["tag-1"],
      repeatRule: { type: "daily", interval: 1 },
      pomodoroEstimate: 2,
      checklistItems: [{ id: "check-1", title: "Confirm", completed: false, sortOrder: 0 }],
      sortOrder: 1,
      createdAt: "2026-05-27T08:00:00.000Z",
      updatedAt: "2026-05-27T08:00:00.000Z"
    };
    const area: Area = {
      id: "area-1",
      name: "Work",
      color: "blue",
      archived: false,
      createdAt: "2026-05-27T08:00:00.000Z",
      updatedAt: "2026-05-27T08:00:00.000Z"
    };
    const project: Project = {
      id: "project-1",
      name: "Launch",
      color: "blue",
      areaId: "area-1",
      archived: false,
      createdAt: "2026-05-27T08:00:00.000Z",
      updatedAt: "2026-05-27T08:00:00.000Z"
    };
    const section: ProjectSection = {
      id: "section-1",
      projectId: "project-1",
      name: "Planning",
      sortOrder: 0,
      archived: false,
      createdAt: "2026-05-27T08:00:00.000Z",
      updatedAt: "2026-05-27T08:00:00.000Z"
    };
    const tag: Tag = {
      id: "tag-1",
      name: "Deep Work",
      color: "teal",
      archived: false,
      createdAt: "2026-05-27T08:00:00.000Z",
      updatedAt: "2026-05-27T08:00:00.000Z"
    };
    const session: FocusSession = {
      id: "session-1",
      taskId: "task-1",
      plannedMinutes: 25,
      startedAt: "2026-05-27T09:00:00.000Z",
      endedAt: "2026-05-27T09:25:00.000Z",
      status: "completed"
    };

    await repo.saveArea(area);
    await repo.saveProject(project);
    await repo.saveSection(section);
    await repo.saveTag(tag);
    await repo.saveTask(task);
    await repo.saveFocusSession(session);

    expect(await repo.listAreas()).toEqual([area]);
    expect(await repo.listProjects()).toEqual([project]);
    expect(await repo.listSections()).toEqual([section]);
    expect(await repo.listTags()).toEqual([tag]);
    expect(await repo.listTasks()).toEqual([task]);
    expect(await repo.listFocusSessions()).toEqual([session]);

    await repo.saveTask({ ...task, title: "Plan V1 launch" });
    expect((await repo.listTasks())[0].title).toBe("Plan V1 launch");

    await repo.deleteTask(task.id);
    expect(await repo.listTasks()).toEqual([]);
  });
});
