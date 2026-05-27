import type { Area, FocusSession, Project, ProjectSection, Tag, Task } from "../domain/types";
import { addDays } from "../domain/date";

export interface SeedData {
  tasks: Task[];
  projects: Project[];
  areas: Area[];
  sections: ProjectSection[];
  tags: Tag[];
  sessions: FocusSession[];
}

export const createSeedData = (today: string): SeedData => {
  const now = `${today}T08:00:00.000Z`;
  const tomorrow = addDays(today, 1);
  const later = addDays(today, 3);

  const areas: Area[] = [
    {
      id: "area-work",
      name: "工作",
      color: "blue",
      archived: false,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "area-life",
      name: "生活",
      color: "teal",
      archived: false,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "area-study",
      name: "学习",
      color: "violet",
      archived: false,
      createdAt: now,
      updatedAt: now
    }
  ];

  const projects: Project[] = [
    {
      id: "project-design",
      name: "设计",
      color: "blue",
      areaId: "area-work",
      archived: false,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "project-work",
      name: "工作",
      color: "teal",
      areaId: "area-work",
      archived: false,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "project-life",
      name: "生活",
      color: "amber",
      areaId: "area-life",
      archived: false,
      createdAt: now,
      updatedAt: now
    }
  ];

  const sections: ProjectSection[] = [
    {
      id: "section-design-discovery",
      projectId: "project-design",
      name: "探索",
      sortOrder: 0,
      archived: false,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "section-design-polish",
      projectId: "project-design",
      name: "打磨",
      sortOrder: 1,
      archived: false,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "section-work-next",
      projectId: "project-work",
      name: "下一步",
      sortOrder: 0,
      archived: false,
      createdAt: now,
      updatedAt: now
    }
  ];

  const tags: Tag[] = [
    {
      id: "tag-deep-work",
      name: "深度工作",
      color: "teal",
      archived: false,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "tag-quick",
      name: "快速处理",
      color: "amber",
      archived: false,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "tag-writing",
      name: "写作",
      color: "violet",
      archived: false,
      createdAt: now,
      updatedAt: now
    }
  ];

  const tasks: Task[] = [
    {
      id: "task-design-workbench",
      title: "设计今日工作台",
      notes: "确认布局密度、颜色标记和专注面板的处理方式。",
      status: "open",
      priority: "high",
      scheduledDate: today,
      dueDate: today,
      projectId: "project-design",
      areaId: "area-work",
      sectionId: "section-design-polish",
      tagIds: [],
      pomodoroEstimate: 2,
      checklistItems: [
        { id: "check-design-density", title: "确认信息密度", completed: false, sortOrder: 0 },
        { id: "check-design-motion", title: "检查动效是否克制", completed: false, sortOrder: 1 }
      ],
      sortOrder: 0,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "task-repeat",
      title: "检查重复任务默认值",
      notes: "V1 保持重复规则简单可用。",
      status: "open",
      priority: "medium",
      scheduledDate: today,
      projectId: "project-work",
      areaId: "area-work",
      sectionId: "section-work-next",
      tagIds: ["tag-writing"],
      repeatRule: { type: "weekly", interval: 1 },
      pomodoroEstimate: 1,
      checklistItems: [],
      sortOrder: 1,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "task-mobile-polish",
      title: "记录移动端优化想法",
      notes: "",
      status: "open",
      priority: "low",
      projectId: "project-design",
      areaId: "area-work",
      sectionId: "section-design-discovery",
      tagIds: ["tag-quick"],
      pomodoroEstimate: 1,
      checklistItems: [],
      sortOrder: 2,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "task-upcoming",
      title: "规划 Vercel 部署清单",
      notes: "构建、冒烟测试和部署说明。",
      status: "open",
      priority: "medium",
      scheduledDate: tomorrow,
      dueDate: later,
      projectId: "project-work",
      areaId: "area-work",
      sectionId: "section-work-next",
      tagIds: [],
      pomodoroEstimate: 1,
      checklistItems: [],
      sortOrder: 3,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "task-completed-review",
      title: "晨间回顾",
      notes: "",
      status: "completed",
      priority: "none",
      scheduledDate: today,
      projectId: "project-life",
      areaId: "area-life",
      tagIds: [],
      pomodoroEstimate: 1,
      checklistItems: [],
      sortOrder: 4,
      createdAt: now,
      updatedAt: now,
      completedAt: `${today}T07:30:00.000Z`
    }
  ];

  return { tasks, projects, areas, sections, tags, sessions: [] };
};
