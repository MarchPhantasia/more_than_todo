import { createContext, type ReactNode, useContext, useRef } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import { notifyFocusComplete, playCompletionTone } from "../domain/feedback";
import { createInitialFocusTimer, focusTimerReducer, type FocusTimerState } from "../domain/focusTimer";
import { getNextScheduledDate } from "../domain/repeat";
import { isDeleted, isOpen, sortTasks } from "../domain/taskSelectors";
import type {
  Area,
  ChecklistItem,
  ColorToken,
  DateKey,
  FocusSession,
  Project,
  ProjectSection,
  RepeatRule,
  Tag,
  Task
} from "../domain/types";
import type { TaskRepository } from "../data/repository";
import { createSeedData } from "../data/seed";

export type ActiveView =
  | "inbox"
  | "today"
  | "upcoming"
  | "anytime"
  | "someday"
  | "logbook"
  | "deadlines"
  | "focus"
  | "trash"
  | "area"
  | "project";

type ImportableTask = Omit<Task, "checklistItems" | "sortOrder"> &
  Partial<Pick<Task, "checklistItems" | "sortOrder">>;

export interface TaskDataExportV1 {
  version: 1;
  exportedAt: string;
  tasks: ImportableTask[];
  projects: Project[];
  tags: Tag[];
  sessions: FocusSession[];
}

export interface TaskDataExportV2 {
  version: 2;
  exportedAt: string;
  tasks: Task[];
  projects: Project[];
  areas: Area[];
  sections: ProjectSection[];
  tags: Tag[];
  sessions: FocusSession[];
}

export type TaskDataExport = TaskDataExportV1 | TaskDataExportV2;

interface AddProjectOptions extends Partial<Project> {
  activate?: boolean;
}

export interface TaskStoreState {
  runtimeVersion: number;
  loading: boolean;
  tasks: Task[];
  projects: Project[];
  areas: Area[];
  sections: ProjectSection[];
  tags: Tag[];
  sessions: FocusSession[];
  selectedTaskId?: string;
  detailsTaskId?: string;
  taskDetailsOpen: boolean;
  usageManualOpen: boolean;
  notice?: string;
  activeView: ActiveView;
  activeProjectId?: string;
  activeAreaId?: string;
  today: DateKey;
  focus: FocusTimerState;
  initialize(): Promise<void>;
  setActiveView(view: ActiveView, targetId?: string): void;
  selectTask(taskId?: string): void;
  openTaskDetails(taskId: string): void;
  closeTaskDetails(): void;
  openUsageManual(): void;
  closeUsageManual(): void;
  addTask(title: string, options?: Partial<Task>): Promise<Task | undefined>;
  addProject(name: string, options?: AddProjectOptions): Promise<Project | undefined>;
  updateProject(projectId: string, patch: Partial<Project>): Promise<void>;
  deleteProject(projectId: string): Promise<void>;
  addArea(name: string): Promise<Area | undefined>;
  updateArea(areaId: string, patch: Partial<Area>): Promise<void>;
  deleteArea(areaId: string): Promise<void>;
  addSection(projectId: string, name: string): Promise<ProjectSection | undefined>;
  updateSection(sectionId: string, patch: Partial<ProjectSection>): Promise<void>;
  deleteSection(sectionId: string): Promise<void>;
  addTag(name: string): Promise<Tag | undefined>;
  exportData(): Promise<TaskDataExportV2>;
  importData(snapshot: TaskDataExport): Promise<void>;
  clearAllData(): Promise<void>;
  updateTask(taskId: string, patch: Partial<Task>): Promise<void>;
  reorderTask(taskId: string, sortOrder: number): Promise<void>;
  toggleTask(taskId: string): Promise<void>;
  deleteTask(taskId: string): Promise<void>;
  startFocus(taskId?: string): void;
  pauseFocus(): void;
  resetFocus(): void;
  setFocusDuration(minutes: number): void;
  tickFocus(seconds?: number): Promise<void>;
  clearNotice(): void;
}

const makeId = (prefix: string) => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2)}`;
};

const nowIso = () => new Date().toISOString();

const hasStringId = (value: unknown): value is { id: string } =>
  typeof value === "object" && value !== null && typeof (value as { id?: unknown }).id === "string";

const isTaskLike = (value: unknown): value is Task =>
  hasStringId(value) &&
  typeof (value as Partial<Task>).title === "string" &&
  typeof (value as Partial<Task>).notes === "string" &&
  ((value as Partial<Task>).status === "open" || (value as Partial<Task>).status === "completed") &&
  Array.isArray((value as Partial<Task>).tagIds) &&
  typeof (value as Partial<Task>).createdAt === "string" &&
  typeof (value as Partial<Task>).updatedAt === "string";

const isProjectLike = (value: unknown): value is Project =>
  hasStringId(value) &&
  typeof (value as Partial<Project>).name === "string" &&
  typeof (value as Partial<Project>).createdAt === "string" &&
  typeof (value as Partial<Project>).updatedAt === "string";

const isAreaLike = (value: unknown): value is Area =>
  hasStringId(value) &&
  typeof (value as Partial<Area>).name === "string" &&
  typeof (value as Partial<Area>).createdAt === "string" &&
  typeof (value as Partial<Area>).updatedAt === "string";

const isProjectSectionLike = (value: unknown): value is ProjectSection =>
  hasStringId(value) &&
  typeof (value as Partial<ProjectSection>).projectId === "string" &&
  typeof (value as Partial<ProjectSection>).name === "string" &&
  typeof (value as Partial<ProjectSection>).createdAt === "string" &&
  typeof (value as Partial<ProjectSection>).updatedAt === "string";

const isTagLike = (value: unknown): value is Tag =>
  hasStringId(value) &&
  typeof (value as Partial<Tag>).name === "string" &&
  typeof (value as Partial<Tag>).createdAt === "string" &&
  typeof (value as Partial<Tag>).updatedAt === "string";

const isFocusSessionLike = (value: unknown): value is FocusSession =>
  hasStringId(value) &&
  typeof (value as Partial<FocusSession>).plannedMinutes === "number" &&
  typeof (value as Partial<FocusSession>).startedAt === "string" &&
  ((value as Partial<FocusSession>).status === "completed" ||
    (value as Partial<FocusSession>).status === "cancelled");

export const isTaskDataExport = (value: unknown): value is TaskDataExport => {
  if (typeof value !== "object" || value === null) return false;
  const snapshot = value as {
    version?: unknown;
    exportedAt?: unknown;
    tasks?: unknown[];
    projects?: unknown[];
    areas?: unknown[];
    sections?: unknown[];
    tags?: unknown[];
    sessions?: unknown[];
  };
  return (
    (snapshot.version === 1 || snapshot.version === 2) &&
    typeof snapshot.exportedAt === "string" &&
    Array.isArray(snapshot.tasks) &&
    Array.isArray(snapshot.projects) &&
    Array.isArray(snapshot.tags) &&
    Array.isArray(snapshot.sessions) &&
    snapshot.tasks.every(isTaskLike) &&
    snapshot.projects.every(isProjectLike) &&
    snapshot.tags.every(isTagLike) &&
    snapshot.sessions.every(isFocusSessionLike) &&
    (snapshot.version === 1 ||
      (Array.isArray(snapshot.areas) &&
        Array.isArray(snapshot.sections) &&
        snapshot.areas.every(isAreaLike) &&
        snapshot.sections.every(isProjectSectionLike)))
  );
};

const seedStateKey = "more-than-todo:default-data-initialized";
export const TASK_STORE_RUNTIME_VERSION = 4;

const canUseLocalStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const hasInitializedDefaultData = () => canUseLocalStorage() && window.localStorage.getItem(seedStateKey) === "true";

const markDefaultDataInitialized = () => {
  if (!canUseLocalStorage()) return;
  window.localStorage.setItem(seedStateKey, "true");
};

const cloneData = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const uniqueById = <T extends { id: string }>(items: T[]): T[] => [...new Map(items.map((item) => [item.id, item])).values()];

const getDefaultSelectedTaskId = (tasks: Task[], today: DateKey) =>
  sortTasks(tasks).find((task) => isOpen(task) && task.scheduledDate === today)?.id ??
  sortTasks(tasks).find(isOpen)?.id;

const normalizeRepeatRule = (repeatRule?: RepeatRule): RepeatRule | undefined => {
  if (!repeatRule) return undefined;
  return { ...repeatRule, interval: Math.max(1, Math.floor(repeatRule.interval || 1)) };
};

const normalizeFocusDuration = (minutes: number): number =>
  Math.min(120, Math.max(1, Math.floor(Number.isFinite(minutes) ? minutes : 25)));

const normalizeChecklistItems = (items?: ChecklistItem[]): ChecklistItem[] =>
  Array.isArray(items)
    ? items
        .filter((item) => item && typeof item.id === "string" && typeof item.title === "string")
        .map((item, index) => ({
          id: item.id,
          title: item.title,
          completed: Boolean(item.completed),
          sortOrder: Number.isFinite(item.sortOrder) ? item.sortOrder : index
        }))
        .sort((left, right) => left.sortOrder - right.sortOrder)
    : [];

const normalizeTask = (task: ImportableTask, index: number): Task => ({
  ...task,
  notes: task.notes ?? "",
  priority: task.priority ?? "none",
  tagIds: Array.isArray(task.tagIds) ? [...new Set(task.tagIds)] : [],
  pomodoroEstimate: Math.max(1, Math.floor(task.pomodoroEstimate || 1)),
  repeatRule: normalizeRepeatRule(task.repeatRule),
  checklistItems: normalizeChecklistItems(task.checklistItems),
  sortOrder: typeof task.sortOrder === "number" && Number.isFinite(task.sortOrder) ? task.sortOrder : index
});

const normalizeTasks = (tasks: ImportableTask[]): Task[] =>
  sortTasks(tasks.map((task, index) => normalizeTask(task, index)));

const getTaskSeriesId = (task: Task): string => task.recurrenceSourceId ?? task.id;

const repeatRuleKey = (repeatRule?: RepeatRule): string => {
  if (!repeatRule) return "";
  if (repeatRule.type === "interval") {
    return `${repeatRule.type}:${repeatRule.interval}:${repeatRule.unit}`;
  }
  return `${repeatRule.type}:${repeatRule.interval}`;
};

const recurringInstanceKey = (task: Task): string =>
  [
    getTaskSeriesId(task),
    task.scheduledDate ?? "",
    task.title.trim().toLowerCase(),
    task.projectId ?? "",
    task.priority,
    repeatRuleKey(task.repeatRule),
    [...task.tagIds].sort().join(",")
  ].join("|");

const findGeneratedSuccessorsForRestore = (tasks: Task[], restoredTask: Task): Task[] => {
  if (!restoredTask.completedAt) return [];
  const sourceId = getTaskSeriesId(restoredTask);

  return tasks.filter(
    (task) =>
      task.id !== restoredTask.id &&
      task.status === "open" &&
      !isDeleted(task) &&
      task.recurrenceSourceId === sourceId &&
      task.createdAt === restoredTask.completedAt
  );
};

const findOpenRecurringDuplicates = (tasks: Task[], target: Task): Task[] => {
  if (!target.repeatRule || !target.scheduledDate) return [];
  const targetKey = recurringInstanceKey(target);

  return tasks.filter(
    (task) =>
      task.id !== target.id &&
      task.status === "open" &&
      !isDeleted(task) &&
      task.repeatRule &&
      task.scheduledDate &&
      recurringInstanceKey(task) === targetKey
  );
};

const findStaleGeneratedSuccessorIds = (tasks: Task[]): Set<string> => {
  const staleIds = new Set<string>();

  tasks.forEach((sourceTask) => {
    if (sourceTask.status !== "open" || isDeleted(sourceTask) || !sourceTask.repeatRule) return;
    const nextScheduledDate = getNextScheduledDate(sourceTask.scheduledDate, sourceTask.repeatRule);
    if (!nextScheduledDate) return;

    const sourceId = getTaskSeriesId(sourceTask);
    tasks.forEach((candidate) => {
      if (
        candidate.id !== sourceTask.id &&
        candidate.status === "open" &&
        !isDeleted(candidate) &&
        candidate.recurrenceSourceId === sourceId &&
        candidate.scheduledDate === nextScheduledDate &&
        candidate.createdAt <= sourceTask.updatedAt
      ) {
        staleIds.add(candidate.id);
      }
    });
  });

  return staleIds;
};

const findDuplicateOpenRecurringInstanceIds = (tasks: Task[]): Set<string> => {
  const duplicateIds = new Set<string>();
  const firstByKey = new Map<string, Task>();

  tasks.forEach((task) => {
    if (task.status !== "open" || isDeleted(task) || !task.repeatRule || !task.scheduledDate || !task.recurrenceSourceId) {
      return;
    }

    const key = recurringInstanceKey(task);
    const existing = firstByKey.get(key);
    if (!existing) {
      firstByKey.set(key, task);
      return;
    }

    duplicateIds.add(task.createdAt >= existing.createdAt ? task.id : existing.id);
    if (task.createdAt < existing.createdAt) {
      firstByKey.set(key, task);
    }
  });

  return duplicateIds;
};

const projectColors: ColorToken[] = ["blue", "teal", "amber", "coral", "focus", "violet"];
const areaColors: ColorToken[] = ["blue", "teal", "violet", "amber", "coral", "focus"];
const tagColors: ColorToken[] = ["teal", "violet", "amber", "blue", "coral", "focus"];

type StoreRuntimeCandidate = {
  getState(): Partial<TaskStoreState>;
};

export const isTaskStoreRuntimeCurrent = (store?: StoreRuntimeCandidate | null): boolean => {
  const state = store?.getState();
  return Boolean(
      state &&
      state.runtimeVersion === TASK_STORE_RUNTIME_VERSION &&
      typeof state.addTag === "function" &&
      typeof state.addArea === "function" &&
      typeof state.addSection === "function" &&
      typeof state.openTaskDetails === "function" &&
      typeof state.openUsageManual === "function"
  );
};

export const createTaskStore = (
  repository: TaskRepository,
  today: DateKey
): StoreApi<TaskStoreState> =>
  createStore<TaskStoreState>((set, get) => ({
    runtimeVersion: TASK_STORE_RUNTIME_VERSION,
    loading: true,
    tasks: [],
    projects: [],
    areas: [],
    sections: [],
    tags: [],
    sessions: [],
    activeView: "today",
    taskDetailsOpen: false,
    usageManualOpen: false,
    today,
    focus: createInitialFocusTimer(25),

    async initialize() {
      let [tasks, projects, areas, sections, tags, sessions] = await Promise.all([
        repository.listTasks(),
        repository.listProjects(),
        repository.listAreas(),
        repository.listSections(),
        repository.listTags(),
        repository.listFocusSessions()
      ]);

      if (
        tasks.length === 0 &&
        projects.length === 0 &&
        areas.length === 0 &&
        sections.length === 0 &&
        tags.length === 0 &&
        !hasInitializedDefaultData()
      ) {
        const seed = createSeedData(today);
        await Promise.all([
          ...seed.areas.map((area) => repository.saveArea(area)),
          ...seed.projects.map((project) => repository.saveProject(project)),
          ...seed.sections.map((section) => repository.saveSection(section)),
          ...seed.tags.map((tag) => repository.saveTag(tag)),
          ...seed.tasks.map((task) => repository.saveTask(task))
        ]);
        tasks = seed.tasks;
        projects = seed.projects;
        areas = seed.areas;
        sections = seed.sections;
        tags = seed.tags;
        sessions = seed.sessions;
      }

      tasks = normalizeTasks(tasks);

      if (tasks.length > 0 || projects.length > 0 || areas.length > 0 || sections.length > 0 || tags.length > 0 || sessions.length > 0) {
        markDefaultDataInitialized();
      }

      const staleGeneratedSuccessorIds = findStaleGeneratedSuccessorIds(tasks);
      const duplicateOpenRecurringInstanceIds = findDuplicateOpenRecurringInstanceIds(tasks);
      const cleanupTaskIds = new Set([
        ...staleGeneratedSuccessorIds,
        ...duplicateOpenRecurringInstanceIds
      ]);

      if (cleanupTaskIds.size > 0) {
        await Promise.all(
          [...cleanupTaskIds].map((taskId) => repository.deleteTask(taskId))
        );
        tasks = tasks.filter((task) => !cleanupTaskIds.has(task.id));
      }

      const selectedTaskId = getDefaultSelectedTaskId(tasks, today);

      set({
        loading: false,
        tasks: normalizeTasks(tasks),
        projects,
        areas,
        sections: [...sections].sort((left, right) => left.sortOrder - right.sortOrder),
        tags,
        sessions,
        selectedTaskId,
        activeProjectId: projects[0]?.id,
        activeAreaId: areas[0]?.id
      });
    },

    setActiveView(view, targetId) {
      set({
        activeView: view,
        activeProjectId: view === "project" ? targetId ?? get().activeProjectId : get().activeProjectId,
        activeAreaId: view === "area" ? targetId ?? get().activeAreaId : get().activeAreaId
      });
    },

    selectTask(taskId) {
      set({ selectedTaskId: taskId });
    },

    openTaskDetails(taskId) {
      set({ selectedTaskId: taskId, detailsTaskId: taskId, taskDetailsOpen: true });
    },

    closeTaskDetails() {
      set({ taskDetailsOpen: false });
    },

    openUsageManual() {
      set({ usageManualOpen: true });
    },

    closeUsageManual() {
      set({ usageManualOpen: false });
    },

    async addTask(title, options = {}) {
      const trimmed = title.trim();
      if (!trimmed) return undefined;
      const timestamp = nowIso();
      const sortOrder =
        Number.isFinite(options.sortOrder)
          ? Number(options.sortOrder)
          : get().tasks.reduce((max, task) => Math.max(max, Number.isFinite(task.sortOrder) ? task.sortOrder : 0), -1) + 1;
      const task: Task = {
        id: makeId("task"),
        title: trimmed,
        notes: options.notes ?? "",
        status: "open",
        priority: options.priority ?? "none",
        scheduledDate: options.scheduledDate,
        dueDate: options.dueDate,
        projectId: options.projectId,
        areaId: options.areaId,
        sectionId: options.sectionId,
        tagIds: options.tagIds ?? [],
        repeatRule: normalizeRepeatRule(options.repeatRule),
        pomodoroEstimate: options.pomodoroEstimate ?? 1,
        checklistItems: normalizeChecklistItems(options.checklistItems),
        sortOrder,
        list: options.list,
        someday: options.someday,
        deletedAt: options.deletedAt,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await repository.saveTask(task);
      set({ tasks: sortTasks([...get().tasks, task]), selectedTaskId: task.id });
      return task;
    },

    async addProject(name, options = {}) {
      const trimmed = name.trim();
      if (!trimmed) return undefined;

      const existing = get().projects.find(
        (project) => project.name.toLowerCase() === trimmed.toLowerCase() && !project.archived
      );
      if (existing) {
        if (options.activate !== false) {
          set({ activeView: "project", activeProjectId: existing.id });
        }
        return existing;
      }

      const timestamp = nowIso();
      const project: Project = {
        id: makeId("project"),
        name: trimmed,
        color: options.color ?? projectColors[get().projects.length % projectColors.length],
        areaId: options.areaId,
        archived: false,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await repository.saveProject(project);
      set({
        projects: [...get().projects, project],
        ...(options.activate === false
          ? {}
          : {
              activeView: "project" as const,
              activeProjectId: project.id
            })
      });
      return project;
    },

    async updateProject(projectId, patch) {
      const project = get().projects.find((item) => item.id === projectId);
      if (!project) return;

      const updated: Project = { ...project, ...patch, updatedAt: nowIso() };
      await repository.saveProject(updated);
      set({ projects: get().projects.map((item) => (item.id === projectId ? updated : item)) });
    },

    async deleteProject(projectId) {
      const project = get().projects.find((item) => item.id === projectId);
      if (!project) return;

      const timestamp = nowIso();
      const updatedTasks = get().tasks.map((task) =>
        task.projectId === projectId
          ? {
              ...task,
              projectId: undefined,
              sectionId: undefined,
              updatedAt: timestamp
            }
          : task
      );
      const changedTasks = updatedTasks.filter((task, index) => task !== get().tasks[index]);
      const deletedSections = get().sections.filter((section) => section.projectId === projectId);

      await Promise.all([
        ...changedTasks.map((task) => repository.saveTask(task)),
        ...deletedSections.map((section) => repository.deleteSection(section.id)),
        repository.deleteProject(projectId)
      ]);

      const remainingProjects = get().projects.filter((item) => item.id !== projectId);
      set({
        projects: remainingProjects,
        sections: get().sections.filter((section) => section.projectId !== projectId),
        tasks: sortTasks(updatedTasks),
        activeView: get().activeProjectId === projectId ? "today" : get().activeView,
        activeProjectId:
          get().activeProjectId === projectId
            ? remainingProjects[0]?.id
            : get().activeProjectId,
        notice: `项目“${project.name}”已删除，任务已保留`
      });
    },

    async addArea(name) {
      const trimmed = name.trim();
      if (!trimmed) return undefined;

      const existing = get().areas.find(
        (area) => area.name.toLowerCase() === trimmed.toLowerCase() && !area.archived
      );
      if (existing) {
        set({ activeView: "area", activeAreaId: existing.id });
        return existing;
      }

      const timestamp = nowIso();
      const area: Area = {
        id: makeId("area"),
        name: trimmed,
        color: areaColors[get().areas.length % areaColors.length],
        archived: false,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await repository.saveArea(area);
      set({
        areas: [...get().areas, area],
        activeView: "area",
        activeAreaId: area.id,
        notice: `领域“${area.name}”已创建`
      });
      return area;
    },

    async updateArea(areaId, patch) {
      const area = get().areas.find((item) => item.id === areaId);
      if (!area) return;

      const updated: Area = { ...area, ...patch, updatedAt: nowIso() };
      await repository.saveArea(updated);
      set({ areas: get().areas.map((item) => (item.id === areaId ? updated : item)) });
    },

    async deleteArea(areaId) {
      const area = get().areas.find((item) => item.id === areaId);
      if (!area) return;

      const timestamp = nowIso();
      const updatedTasks = get().tasks.map((task) =>
        task.areaId === areaId ? { ...task, areaId: undefined, updatedAt: timestamp } : task
      );
      const updatedProjects = get().projects.map((project) =>
        project.areaId === areaId ? { ...project, areaId: undefined, updatedAt: timestamp } : project
      );
      const changedTasks = updatedTasks.filter((task, index) => task !== get().tasks[index]);
      const changedProjects = updatedProjects.filter((project, index) => project !== get().projects[index]);

      await Promise.all([
        ...changedTasks.map((task) => repository.saveTask(task)),
        ...changedProjects.map((project) => repository.saveProject(project)),
        repository.deleteArea(areaId)
      ]);

      const remainingAreas = get().areas.filter((item) => item.id !== areaId);
      set({
        areas: remainingAreas,
        projects: updatedProjects,
        tasks: sortTasks(updatedTasks),
        activeView: get().activeAreaId === areaId ? "today" : get().activeView,
        activeAreaId: get().activeAreaId === areaId ? remainingAreas[0]?.id : get().activeAreaId,
        notice: `领域“${area.name}”已删除，任务已保留`
      });
    },

    async addSection(projectId, name) {
      const project = get().projects.find((item) => item.id === projectId);
      const trimmed = name.trim();
      if (!project || !trimmed) return undefined;

      const existing = get().sections.find(
        (section) =>
          section.projectId === projectId &&
          section.name.toLowerCase() === trimmed.toLowerCase() &&
          !section.archived
      );
      if (existing) return existing;

      const timestamp = nowIso();
      const projectSections = get().sections.filter((section) => section.projectId === projectId);
      const section: ProjectSection = {
        id: makeId("section"),
        projectId,
        name: trimmed,
        sortOrder:
          projectSections.reduce((max, item) => Math.max(max, Number.isFinite(item.sortOrder) ? item.sortOrder : 0), -1) + 1,
        archived: false,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      await repository.saveSection(section);
      set({
        sections: [...get().sections, section].sort((left, right) => left.sortOrder - right.sortOrder),
        notice: `阶段“${section.name}”已创建`
      });
      return section;
    },

    async updateSection(sectionId, patch) {
      const section = get().sections.find((item) => item.id === sectionId);
      if (!section) return;

      const updated: ProjectSection = { ...section, ...patch, updatedAt: nowIso() };
      await repository.saveSection(updated);
      set({
        sections: get()
          .sections.map((item) => (item.id === sectionId ? updated : item))
          .sort((left, right) => left.sortOrder - right.sortOrder)
      });
    },

    async deleteSection(sectionId) {
      const section = get().sections.find((item) => item.id === sectionId);
      if (!section) return;

      const timestamp = nowIso();
      const updatedTasks = get().tasks.map((task) =>
        task.sectionId === sectionId ? { ...task, sectionId: undefined, updatedAt: timestamp } : task
      );
      const changedTasks = updatedTasks.filter((task, index) => task !== get().tasks[index]);

      await Promise.all([
        ...changedTasks.map((task) => repository.saveTask(task)),
        repository.deleteSection(sectionId)
      ]);

      set({
        sections: get().sections.filter((item) => item.id !== sectionId),
        tasks: sortTasks(updatedTasks),
        notice: `阶段“${section.name}”已删除，任务已保留`
      });
    },

    async addTag(name) {
      const trimmed = name.trim();
      if (!trimmed) return undefined;

      const existing = get().tags.find(
        (tag) => tag.name.toLowerCase() === trimmed.toLowerCase() && !tag.archived
      );
      if (existing) return existing;

      const timestamp = nowIso();
      const tag: Tag = {
        id: makeId("tag"),
        name: trimmed,
        color: tagColors[get().tags.length % tagColors.length],
        archived: false,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await repository.saveTag(tag);
      set({ tags: [...get().tags, tag], notice: `标签“${tag.name}”已创建` });
      return tag;
    },

    async exportData() {
      return cloneData({
        version: 2 as const,
        exportedAt: nowIso(),
        tasks: normalizeTasks(get().tasks),
        projects: get().projects,
        areas: get().areas,
        sections: get().sections,
        tags: get().tags,
        sessions: get().sessions
      });
    },

    async importData(snapshot) {
      if (!isTaskDataExport(snapshot) || !repository.clear) {
        throw new Error("Invalid task data export");
      }

      const tasks = normalizeTasks(uniqueById(cloneData(snapshot.tasks)));
      const projects = uniqueById(cloneData(snapshot.projects));
      const areas = snapshot.version === 2 ? uniqueById(cloneData(snapshot.areas)) : [];
      const sections = snapshot.version === 2 ? uniqueById(cloneData(snapshot.sections)) : [];
      const tags = uniqueById(cloneData(snapshot.tags));
      const sessions = uniqueById(cloneData(snapshot.sessions));

      await repository.clear();
      await Promise.all([
        ...areas.map((area) => repository.saveArea(area)),
        ...projects.map((project) => repository.saveProject(project)),
        ...sections.map((section) => repository.saveSection(section)),
        ...tags.map((tag) => repository.saveTag(tag)),
        ...tasks.map((task) => repository.saveTask(task)),
        ...sessions.map((session) => repository.saveFocusSession(session))
      ]);

      markDefaultDataInitialized();
      set({
        tasks,
        projects,
        areas,
        sections,
        tags,
        sessions,
        selectedTaskId: getDefaultSelectedTaskId(tasks, today),
        detailsTaskId: undefined,
        taskDetailsOpen: false,
        usageManualOpen: false,
        activeView: "today",
        activeProjectId: projects[0]?.id,
        activeAreaId: areas[0]?.id,
        notice: "数据已导入"
      });
    },

    async clearAllData() {
      if (!repository.clear) {
        throw new Error("Task repository does not support clearing all data");
      }

      await repository.clear();
      markDefaultDataInitialized();
      set({
        tasks: [],
        projects: [],
        areas: [],
        sections: [],
        tags: [],
        sessions: [],
        selectedTaskId: undefined,
        detailsTaskId: undefined,
        taskDetailsOpen: false,
        usageManualOpen: false,
        activeView: "today",
        activeProjectId: undefined,
        activeAreaId: undefined,
        focus: createInitialFocusTimer(25),
        notice: "所有本地数据已清空"
      });
    },

    async updateTask(taskId, patch) {
      const task = get().tasks.find((item) => item.id === taskId);
      if (!task) return;
      const repeatRule = Object.prototype.hasOwnProperty.call(patch, "repeatRule")
        ? normalizeRepeatRule(patch.repeatRule)
        : task.repeatRule;
      const updated: Task = {
        ...task,
        ...patch,
        repeatRule,
        checklistItems: Object.prototype.hasOwnProperty.call(patch, "checklistItems")
          ? normalizeChecklistItems(patch.checklistItems)
          : task.checklistItems,
        sortOrder: Object.prototype.hasOwnProperty.call(patch, "sortOrder")
          ? Number(patch.sortOrder)
          : task.sortOrder,
        updatedAt: nowIso()
      };
      await repository.saveTask(updated);
      set({ tasks: sortTasks(get().tasks.map((item) => (item.id === taskId ? updated : item))) });
    },

    async reorderTask(taskId, sortOrder) {
      await get().updateTask(taskId, { sortOrder });
    },

    async toggleTask(taskId) {
      const task = get().tasks.find((item) => item.id === taskId);
      if (!task) return;

      if (task.status === "completed") {
        const reopened: Task = { ...task, status: "open", completedAt: undefined, updatedAt: nowIso() };
        const generatedSuccessors = findGeneratedSuccessorsForRestore(get().tasks, task);
        const generatedSuccessorIds = new Set(generatedSuccessors.map((item) => item.id));

        await repository.saveTask(reopened);
        await Promise.all(generatedSuccessors.map((item) => repository.deleteTask(item.id)));

        set({
          tasks: sortTasks(
            get()
              .tasks.filter((item) => !generatedSuccessorIds.has(item.id))
              .map((item) => (item.id === taskId ? reopened : item))
          ),
          selectedTaskId: reopened.id,
          notice:
            generatedSuccessors.length > 0
              ? "任务已恢复，下一次重复任务已撤销"
              : "任务已恢复"
        });
        return;
      }

      const completedAt = nowIso();
      const completed: Task = { ...task, status: "completed", completedAt, updatedAt: completedAt };
      const nextDate = getNextScheduledDate(task.scheduledDate, task.repeatRule);
      const proposedNextTask: Task | undefined = nextDate
        ? {
            ...task,
            id: makeId("task"),
            status: "open",
            scheduledDate: nextDate,
            dueDate: task.dueDate ? nextDate : undefined,
            recurrenceSourceId: task.recurrenceSourceId ?? task.id,
            createdAt: completedAt,
            updatedAt: completedAt,
            completedAt: undefined
          }
        : undefined;
      const duplicateOpenSiblings = findOpenRecurringDuplicates(get().tasks, task);
      const duplicateOpenSiblingIds = new Set(duplicateOpenSiblings.map((item) => item.id));
      const existingNextTasks = proposedNextTask
        ? findOpenRecurringDuplicates(get().tasks, proposedNextTask).filter(
            (item) => !duplicateOpenSiblingIds.has(item.id)
          )
        : [];
      const nextTask = existingNextTasks.length === 0 ? proposedNextTask : undefined;
      const extraExistingNextTasks = existingNextTasks.slice(1);
      const cleanupTasks = [...duplicateOpenSiblings, ...extraExistingNextTasks];
      const cleanupTaskIds = new Set(cleanupTasks.map((item) => item.id));

      await repository.saveTask(completed);
      if (nextTask) await repository.saveTask(nextTask);
      await Promise.all(cleanupTasks.map((item) => repository.deleteTask(item.id)));
      playCompletionTone();

      set({
        tasks: sortTasks([
          ...get()
            .tasks.filter((item) => !cleanupTaskIds.has(item.id))
            .map((item) => (item.id === taskId ? completed : item)),
          ...(nextTask ? [nextTask] : [])
        ]),
        selectedTaskId: nextTask?.id ?? existingNextTasks[0]?.id ?? get().selectedTaskId,
        notice:
          nextTask || existingNextTasks[0]
            ? `已完成，下一次已安排到 ${(nextTask ?? existingNextTasks[0]).scheduledDate}`
            : "任务已完成"
      });
    },

    async deleteTask(taskId) {
      const task = get().tasks.find((item) => item.id === taskId);
      if (!task) return;

      const deletedAt = nowIso();
      const deleted: Task = { ...task, deletedAt, updatedAt: deletedAt };
      await repository.saveTask(deleted);
      const tasks = sortTasks(get().tasks.map((item) => (item.id === taskId ? deleted : item)));
      set({
        tasks,
        selectedTaskId: get().selectedTaskId === taskId ? tasks.find(isOpen)?.id : get().selectedTaskId,
        taskDetailsOpen: get().detailsTaskId === taskId ? false : get().taskDetailsOpen,
        notice: "任务已移入回收站"
      });
    },

    startFocus(taskId) {
      set({
        focus: focusTimerReducer(get().focus, {
          type: "start",
          taskId,
          startedAt: nowIso()
        })
      });
    },

    pauseFocus() {
      set({ focus: focusTimerReducer(get().focus, { type: "pause" }) });
    },

    resetFocus() {
      set({ focus: focusTimerReducer(get().focus, { type: "reset" }) });
    },

    setFocusDuration(minutes) {
      const focus = get().focus;
      if (focus.status === "running") return;
      set({
        focus: focusTimerReducer(focus, {
          type: "reset",
          durationMinutes: normalizeFocusDuration(minutes)
        })
      });
    },

    async tickFocus(seconds = 1) {
      const previous = get().focus;
      const next = focusTimerReducer(previous, { type: "tick", seconds });
      set({ focus: next });

      if (previous.status !== "completed" && next.status === "completed" && next.startedAt) {
        const taskTitle = get().tasks.find((task) => task.id === next.taskId)?.title;
        const session: FocusSession = {
          id: makeId("focus"),
          taskId: next.taskId,
          plannedMinutes: next.durationMinutes,
          startedAt: next.startedAt,
          endedAt: nowIso(),
          status: "completed"
        };
        await repository.saveFocusSession(session);
        playCompletionTone();
        const notified = await notifyFocusComplete(taskTitle);
        set({
          sessions: [...get().sessions, session],
          notice: notified ? "番茄钟已结束，通知已发送" : "番茄钟已结束"
        });
      }
    },

    clearNotice() {
      set({ notice: undefined });
    }
  }));

const TaskStoreContext = createContext<StoreApi<TaskStoreState> | null>(null);

export const TaskStoreProvider = ({
  repository,
  today,
  children
}: {
  repository: TaskRepository;
  today: DateKey;
  children: ReactNode;
}) => {
  const storeRef = useRef<StoreApi<TaskStoreState>>();
  if (!isTaskStoreRuntimeCurrent(storeRef.current)) {
    const previousState = storeRef.current?.getState();
    const nextStore = createTaskStore(repository, today);

    if (previousState && !previousState.loading) {
      const nextState = nextStore.getState();
      nextStore.setState(
        {
          ...nextState,
          loading: previousState.loading,
          tasks: previousState.tasks,
          projects: previousState.projects,
          areas: previousState.areas ?? [],
          sections: previousState.sections ?? [],
          tags: previousState.tags,
          sessions: previousState.sessions,
          selectedTaskId: previousState.selectedTaskId,
          detailsTaskId: previousState.detailsTaskId,
          taskDetailsOpen: previousState.taskDetailsOpen ?? false,
          usageManualOpen: previousState.usageManualOpen ?? false,
          notice: previousState.notice,
          activeView: previousState.activeView,
          activeProjectId: previousState.activeProjectId,
          activeAreaId: previousState.activeAreaId,
          today: previousState.today,
          focus: previousState.focus
        },
        true
      );
    }

    storeRef.current = nextStore;
  }

  const store = storeRef.current;
  if (!store) throw new Error("Task store was not initialized");

  return <TaskStoreContext.Provider value={store}>{children}</TaskStoreContext.Provider>;
};

export const useTaskStore = <T,>(selector: (state: TaskStoreState) => T): T => {
  const store = useContext(TaskStoreContext);
  if (!store) throw new Error("useTaskStore must be used within TaskStoreProvider");
  return useStore(store, selector);
};
