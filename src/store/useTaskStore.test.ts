import { describe, expect, it } from "vitest";
import { createMemoryRepository } from "../data/memoryRepository";
import { filterTasksForView } from "../domain/taskSelectors";
import { createTaskStore, isTaskStoreRuntimeCurrent, TASK_STORE_RUNTIME_VERSION } from "./useTaskStore";

describe("task store", () => {
  it("clears a repeat rule when updateTask receives repeatRule undefined", async () => {
    const store = createTaskStore(createMemoryRepository(), "2026-05-27");
    await store.getState().initialize();

    const task = store.getState().tasks.find((item) => item.id === "task-repeat");
    expect(task?.repeatRule).toEqual({ type: "weekly", interval: 1 });

    await store.getState().updateTask("task-repeat", { repeatRule: undefined });

    expect(store.getState().tasks.find((item) => item.id === "task-repeat")?.repeatRule).toBeUndefined();
  });

  it("adds a project and switches to it", async () => {
    const store = createTaskStore(createMemoryRepository(), "2026-05-27");
    await store.getState().initialize();

    await store.getState().addProject("学习");

    const project = store.getState().projects.find((item) => item.name === "学习");
    expect(project).toBeDefined();
    expect(store.getState().activeView).toBe("project");
    expect(store.getState().activeProjectId).toBe(project?.id);
  });

  it("adds a tag and persists it", async () => {
    const repository = createMemoryRepository();
    const store = createTaskStore(repository, "2026-05-27");
    await store.getState().initialize();

    const tag = await store.getState().addTag("灵感");

    expect(tag).toMatchObject({ name: "灵感", archived: false });
    expect(store.getState().tags.find((item) => item.name === "灵感")).toBeDefined();
    expect((await repository.listTags()).find((item) => item.name === "灵感")).toBeDefined();
  });

  it("detects stale hot-reload stores that are missing current actions", () => {
    const store = createTaskStore(createMemoryRepository(), "2026-05-27");
    const currentState = store.getState();
    const staleStore = {
      getState: () => ({
        ...currentState,
        runtimeVersion: TASK_STORE_RUNTIME_VERSION - 1,
        addTag: undefined
      })
    };

    expect(currentState.runtimeVersion).toBe(TASK_STORE_RUNTIME_VERSION);
    expect(isTaskStoreRuntimeCurrent(store)).toBe(true);
    expect(isTaskStoreRuntimeCurrent(staleStore)).toBe(false);
  });

  it("deletes a project without deleting its tasks", async () => {
    const store = createTaskStore(createMemoryRepository(), "2026-05-27");
    await store.getState().initialize();

    await store.getState().deleteProject("project-design");

    expect(store.getState().projects.find((item) => item.id === "project-design")).toBeUndefined();
    expect(store.getState().tasks.some((item) => item.title === "设计今日工作台")).toBe(true);
    expect(store.getState().tasks.some((item) => item.projectId === "project-design")).toBe(false);
  });

  it("exports a complete local data snapshot", async () => {
    const store = createTaskStore(createMemoryRepository(), "2026-05-27");
    await store.getState().initialize();

    const snapshot = await store.getState().exportData();

    expect(snapshot.version).toBe(2);
    expect(snapshot.tasks.map((task) => task.id)).toContain("task-repeat");
    expect(snapshot.projects.map((project) => project.id)).toContain("project-design");
    expect(snapshot.tags.map((tag) => tag.id)).toContain("tag-writing");
    expect(snapshot.areas.map((area) => area.id)).toContain("area-work");
    expect(snapshot.sections.map((section) => section.projectId)).toContain("project-design");
    expect(snapshot.tasks.every((task) => Array.isArray(task.checklistItems))).toBe(true);
    expect(snapshot.tasks.every((task) => typeof task.sortOrder === "number")).toBe(true);
    expect(snapshot.sessions).toEqual([]);
    expect(snapshot.exportedAt).toMatch(/T/);
  });

  it("imports a V1 local data snapshot by replacing and normalizing current data", async () => {
    const repository = createMemoryRepository();
    const store = createTaskStore(repository, "2026-05-27");
    await store.getState().initialize();

    const importedTask = {
      id: "task-imported",
      title: "从另一台设备导入的任务",
      notes: "",
      scheduledDate: "2026-05-27",
      dueDate: undefined,
      projectId: undefined,
      tagIds: [],
      repeatRule: undefined,
      priority: "none" as const,
      pomodoroEstimate: 1,
      status: "open" as const,
      completedAt: undefined,
      createdAt: "2026-05-27T11:00:00.000Z",
      updatedAt: "2026-05-27T11:00:00.000Z"
    };

    await store.getState().importData({
      version: 1,
      exportedAt: "2026-05-27T11:00:00.000Z",
      tasks: [importedTask],
      projects: [],
      tags: [],
      sessions: []
    });

    expect(store.getState().tasks.map((task) => task.id)).toEqual(["task-imported"]);
    expect(store.getState().projects).toEqual([]);
    expect(store.getState().tags).toEqual([]);
    expect(store.getState().areas).toEqual([]);
    expect(store.getState().sections).toEqual([]);
    expect(store.getState().tasks[0]).toMatchObject({
      checklistItems: [],
      sortOrder: 0
    });
    expect((await repository.listTasks()).map((task) => task.id)).toEqual(["task-imported"]);

    const nextStore = createTaskStore(repository, "2026-05-27");
    await nextStore.getState().initialize();

    expect(nextStore.getState().tasks.map((task) => task.id)).toEqual(["task-imported"]);
  });

  it("creates areas, sections, checklist items, and manual task order", async () => {
    const repository = createMemoryRepository();
    const store = createTaskStore(repository, "2026-05-27");
    await store.getState().initialize();

    const area = await store.getState().addArea("学习");
    expect(area).toMatchObject({ name: "学习", archived: false });
    expect((await repository.listAreas()).find((item) => item.name === "学习")).toBeDefined();

    const section = await store.getState().addSection("project-design", "准备");
    expect(section).toMatchObject({ projectId: "project-design", name: "准备", archived: false });
    expect((await repository.listSections()).find((item) => item.name === "准备")).toBeDefined();

    await store.getState().updateTask("task-design-workbench", {
      areaId: area?.id,
      sectionId: section?.id,
      checklistItems: [{ id: "check-1", title: "确认动效", completed: false, sortOrder: 0 }]
    });
    await store.getState().reorderTask("task-design-workbench", 10);

    const task = store.getState().tasks.find((item) => item.id === "task-design-workbench");
    expect(task).toMatchObject({
      areaId: area?.id,
      sectionId: section?.id,
      sortOrder: 10,
      checklistItems: [{ id: "check-1", title: "确认动效", completed: false, sortOrder: 0 }]
    });
  });

  it("clears all local data and does not reseed it on the next initialize", async () => {
    const repository = createMemoryRepository();
    const store = createTaskStore(repository, "2026-05-27");
    await store.getState().initialize();

    await store.getState().clearAllData();

    expect(store.getState().tasks).toEqual([]);
    expect(store.getState().projects).toEqual([]);
    expect(store.getState().tags).toEqual([]);
    expect(await repository.listTasks()).toEqual([]);

    const nextStore = createTaskStore(repository, "2026-05-27");
    await nextStore.getState().initialize();

    expect(nextStore.getState().tasks).toEqual([]);
    expect(nextStore.getState().projects).toEqual([]);
    expect(nextStore.getState().tags).toEqual([]);
  });

  it("soft deletes a task into trash without marking it completed", async () => {
    const repository = createMemoryRepository();
    const store = createTaskStore(repository, "2026-05-27");
    await store.getState().initialize();

    await store.getState().deleteTask("task-mobile-polish");

    const deletedTask = store.getState().tasks.find((item) => item.id === "task-mobile-polish");
    expect(deletedTask).toMatchObject({
      id: "task-mobile-polish",
      status: "open"
    });
    expect(deletedTask?.deletedAt).toMatch(/T/);
    expect((await repository.listTasks()).find((item) => item.id === "task-mobile-polish")?.deletedAt).toBe(
      deletedTask?.deletedAt
    );
    expect(filterTasksForView(store.getState().tasks, { type: "trash", today: "2026-05-27" }).map((item) => item.id)).toContain(
      "task-mobile-polish"
    );
  });

  it("keeps completed tasks in logbook instead of trash", async () => {
    const store = createTaskStore(createMemoryRepository(), "2026-05-27");
    await store.getState().initialize();

    await store.getState().toggleTask("task-design-workbench");

    const completedTask = store.getState().tasks.find((item) => item.id === "task-design-workbench");
    expect(completedTask?.status).toBe("completed");
    expect(completedTask?.deletedAt).toBeUndefined();
    expect(filterTasksForView(store.getState().tasks, { type: "logbook", today: "2026-05-27" }).map((item) => item.id)).toContain(
      "task-design-workbench"
    );
    expect(filterTasksForView(store.getState().tasks, { type: "trash", today: "2026-05-27" }).map((item) => item.id)).not.toContain(
      "task-design-workbench"
    );
  });

  it("removes the generated next recurring task when restoring from trash", async () => {
    const store = createTaskStore(createMemoryRepository(), "2026-05-27");
    await store.getState().initialize();

    await store.getState().toggleTask("task-repeat");

    expect(store.getState().tasks.find((item) => item.id === "task-repeat")?.status).toBe("completed");
    expect(
      store.getState().tasks.some(
        (item) =>
          item.status === "open" &&
          item.recurrenceSourceId === "task-repeat" &&
          item.scheduledDate === "2026-06-03"
      )
    ).toBe(true);

    await store.getState().toggleTask("task-repeat");

    const recurringTasks = store
      .getState()
      .tasks.filter((item) => item.title === "检查重复任务默认值" && item.status === "open");

    expect(recurringTasks).toHaveLength(1);
    expect(recurringTasks[0]).toMatchObject({
      id: "task-repeat",
      scheduledDate: "2026-05-27"
    });
    expect(recurringTasks[0]?.recurrenceSourceId).toBeUndefined();
  });

  it("cleans stale generated recurring duplicates during initialization", async () => {
    const repository = createMemoryRepository();
    const weeklyTask = (await repository.listTasks()).find((item) => item.id === "task-repeat");
    expect(weeklyTask).toBeDefined();

    await repository.saveTask({
      ...weeklyTask!,
      updatedAt: "2026-05-27T09:00:00.000Z"
    });
    await repository.saveTask({
      ...weeklyTask!,
      id: "task-repeat-stale-next",
      scheduledDate: "2026-06-03",
      recurrenceSourceId: "task-repeat",
      createdAt: "2026-05-27T08:30:00.000Z",
      updatedAt: "2026-05-27T08:30:00.000Z"
    });

    const store = createTaskStore(repository, "2026-05-27");
    await store.getState().initialize();

    expect(store.getState().tasks.find((item) => item.id === "task-repeat-stale-next")).toBeUndefined();
    expect((await repository.listTasks()).find((item) => item.id === "task-repeat-stale-next")).toBeUndefined();
  });

  it("does not create another next instance when one already exists", async () => {
    const repository = createMemoryRepository();
    const weeklyTask = (await repository.listTasks()).find((item) => item.id === "task-repeat");
    expect(weeklyTask).toBeDefined();

    await repository.saveTask({
      ...weeklyTask!,
      id: "task-repeat-existing-next",
      scheduledDate: "2026-06-03",
      recurrenceSourceId: "task-repeat",
      createdAt: "2026-05-27T09:30:00.000Z",
      updatedAt: "2026-05-27T09:30:00.000Z"
    });

    const store = createTaskStore(repository, "2026-05-27");
    await store.getState().initialize();
    await store.getState().toggleTask("task-repeat");

    const openRecurringTasks = store
      .getState()
      .tasks.filter((item) => item.title === "检查重复任务默认值" && item.status === "open");

    expect(openRecurringTasks).toHaveLength(1);
    expect(openRecurringTasks[0]).toMatchObject({
      id: "task-repeat-existing-next",
      scheduledDate: "2026-06-03"
    });
  });

  it("completes one generated duplicate and removes its open sibling", async () => {
    const repository = createMemoryRepository();
    const weeklyTask = (await repository.listTasks()).find((item) => item.id === "task-repeat");
    expect(weeklyTask).toBeDefined();

    await repository.saveTask({
      ...weeklyTask!,
      status: "completed",
      completedAt: "2026-05-27T08:30:00.000Z",
      updatedAt: "2026-05-27T08:30:00.000Z"
    });
    await repository.saveTask({
      ...weeklyTask!,
      id: "task-repeat-generated-a",
      scheduledDate: "2026-06-03",
      recurrenceSourceId: "task-repeat",
      createdAt: "2026-05-27T08:30:00.000Z",
      updatedAt: "2026-05-27T08:30:00.000Z"
    });
    await repository.saveTask({
      ...weeklyTask!,
      id: "task-repeat-generated-b",
      scheduledDate: "2026-06-03",
      recurrenceSourceId: "task-repeat",
      createdAt: "2026-05-27T09:00:00.000Z",
      updatedAt: "2026-05-27T09:00:00.000Z"
    });

    const store = createTaskStore(repository, "2026-05-27");
    await store.getState().initialize();
    await store.getState().toggleTask("task-repeat-generated-a");

    expect(store.getState().tasks.find((item) => item.id === "task-repeat-generated-b")).toBeUndefined();
    expect(store.getState().tasks.find((item) => item.id === "task-repeat-generated-a")?.status).toBe("completed");

    const openRecurringTasks = store
      .getState()
      .tasks.filter((item) => item.title === "检查重复任务默认值" && item.status === "open");

    expect(openRecurringTasks).toHaveLength(1);
    expect(openRecurringTasks[0]?.scheduledDate).toBe("2026-06-10");
  });
});
