import { createSeedData } from "./seed";
import type { TaskRepository } from "./repository";
import type { Area, FocusSession, Project, ProjectSection, Tag, Task } from "../domain/types";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const createMemoryRepository = (today = "2026-05-27"): TaskRepository => {
  const seed = createSeedData(today);
  let tasks = clone(seed.tasks);
  let projects = clone(seed.projects);
  let areas = clone(seed.areas);
  let sections = clone(seed.sections);
  let tags = clone(seed.tags);
  let sessions = clone(seed.sessions);

  return {
    async listTasks() {
      return clone(tasks);
    },
    async saveTask(task: Task) {
      tasks = [...tasks.filter((item) => item.id !== task.id), clone(task)];
    },
    async deleteTask(taskId: string) {
      tasks = tasks.filter((task) => task.id !== taskId);
    },
    async listProjects() {
      return clone(projects);
    },
    async saveProject(project: Project) {
      projects = [...projects.filter((item) => item.id !== project.id), clone(project)];
    },
    async deleteProject(projectId: string) {
      projects = projects.filter((project) => project.id !== projectId);
    },
    async listAreas() {
      return clone(areas);
    },
    async saveArea(area: Area) {
      areas = [...areas.filter((item) => item.id !== area.id), clone(area)];
    },
    async deleteArea(areaId: string) {
      areas = areas.filter((area) => area.id !== areaId);
    },
    async listSections() {
      return clone(sections);
    },
    async saveSection(section: ProjectSection) {
      sections = [...sections.filter((item) => item.id !== section.id), clone(section)];
    },
    async deleteSection(sectionId: string) {
      sections = sections.filter((section) => section.id !== sectionId);
    },
    async listTags() {
      return clone(tags);
    },
    async saveTag(tag: Tag) {
      tags = [...tags.filter((item) => item.id !== tag.id), clone(tag)];
    },
    async listFocusSessions() {
      return clone(sessions);
    },
    async saveFocusSession(session: FocusSession) {
      sessions = [...sessions.filter((item) => item.id !== session.id), clone(session)];
    },
    async clear() {
      tasks = [];
      projects = [];
      areas = [];
      sections = [];
      tags = [];
      sessions = [];
    }
  };
};
