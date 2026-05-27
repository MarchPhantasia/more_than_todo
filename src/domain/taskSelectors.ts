import { addDays, compareDateKey, getWeekDates, parseDateKey, toDateKey } from "./date";
import type { DateKey, Priority, Task } from "./types";

export type TaskViewFilter =
  | { type: "inbox"; today: DateKey }
  | { type: "today"; today: DateKey }
  | { type: "upcoming"; today: DateKey }
  | { type: "anytime"; today: DateKey }
  | { type: "someday"; today: DateKey }
  | { type: "logbook"; today: DateKey }
  | { type: "deadlines"; today: DateKey }
  | { type: "area"; today: DateKey; areaId: string }
  | { type: "project"; today: DateKey; projectId: string }
  | { type: "focus"; today: DateKey }
  | { type: "trash"; today: DateKey };

const priorityRank: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3
};

export const isDeleted = (task: Task): boolean => Boolean(task.deletedAt);

export const isOpen = (task: Task): boolean => task.status === "open" && !isDeleted(task);

const isInboxTask = (task: Task): boolean =>
  isOpen(task) &&
  task.list !== "anytime" &&
  !task.scheduledDate &&
  !task.dueDate &&
  !task.someday &&
  !task.projectId &&
  !task.areaId &&
  !task.sectionId &&
  task.tagIds.length === 0 &&
  task.priority === "none" &&
  !task.repeatRule;

const isAnytimeTask = (task: Task): boolean =>
  isOpen(task) &&
  !task.scheduledDate &&
  !task.dueDate &&
  !task.someday &&
  (task.list === "anytime" || !isInboxTask(task));

export const sortTasks = (tasks: Task[]): Task[] =>
  [...tasks].sort((left, right) => {
    const date = compareDateKey(left.scheduledDate, right.scheduledDate);
    if (date !== 0) return date;
    const priority = priorityRank[left.priority] - priorityRank[right.priority];
    if (priority !== 0) return priority;
    const sortOrder = left.sortOrder - right.sortOrder;
    if (sortOrder !== 0) return sortOrder;
    return left.createdAt.localeCompare(right.createdAt);
  });

const sortCompletedTasks = (tasks: Task[]): Task[] =>
  [...tasks].sort((left, right) =>
    (right.completedAt ?? right.updatedAt).localeCompare(left.completedAt ?? left.updatedAt)
  );

export const filterTasksForView = (tasks: Task[], filter: TaskViewFilter): Task[] => {
  const openTasks = tasks.filter(isOpen);

  if (filter.type === "trash") {
    return sortCompletedTasks(tasks.filter(isDeleted));
  }

  if (filter.type === "logbook") {
    return sortCompletedTasks(tasks.filter((task) => task.status === "completed" && !isDeleted(task)));
  }

  if (filter.type === "inbox") {
    return sortTasks(openTasks.filter(isInboxTask));
  }

  if (filter.type === "today") {
    return sortTasks(
      openTasks.filter(
        (task) => !task.someday && task.scheduledDate !== undefined && task.scheduledDate <= filter.today
      )
    );
  }

  if (filter.type === "upcoming") {
    return sortTasks(
      openTasks.filter(
        (task) => !task.someday && task.scheduledDate !== undefined && task.scheduledDate > filter.today
      )
    );
  }

  if (filter.type === "anytime") {
    return sortTasks(openTasks.filter(isAnytimeTask));
  }

  if (filter.type === "someday") {
    return sortTasks(openTasks.filter((task) => task.someday));
  }

  if (filter.type === "deadlines") {
    return sortTasks(openTasks.filter((task) => task.dueDate !== undefined && !task.someday));
  }

  if (filter.type === "area") {
    return sortTasks(openTasks.filter((task) => task.areaId === filter.areaId));
  }

  if (filter.type === "project") {
    return sortTasks(openTasks.filter((task) => task.projectId === filter.projectId));
  }

  return sortTasks(
    openTasks.filter(
      (task) =>
        task.scheduledDate !== undefined &&
        task.scheduledDate >= filter.today &&
        task.scheduledDate <= addDays(filter.today, 6)
    )
  );
};

export interface WeekPlanDay {
  date: DateKey;
  openCount: number;
  completedCount: number;
  deadlineCount: number;
}

export const buildWeekPlan = (tasks: Task[], startDate: DateKey): WeekPlanDay[] =>
  getWeekDates(startDate).map((date) => {
    const availableTasks = tasks.filter((task) => !isDeleted(task));
    const scheduled = availableTasks.filter((task) => task.scheduledDate === date);
    return {
      date,
      openCount: scheduled.filter((task) => task.status === "open").length,
      completedCount: scheduled.filter((task) => task.status === "completed").length,
      deadlineCount: availableTasks.filter((task) => task.status === "open" && task.dueDate === date).length
    };
  });

export interface MonthPlanDay extends WeekPlanDay {
  inCurrentMonth: boolean;
}

const getMonthGridStart = (focusDate: DateKey): DateKey => {
  const firstDay = parseDateKey(`${focusDate.slice(0, 7)}-01`);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  firstDay.setDate(firstDay.getDate() - mondayOffset);
  return toDateKey(firstDay);
};

export const buildMonthPlan = (tasks: Task[], focusDate: DateKey): MonthPlanDay[] => {
  const gridStart = getMonthGridStart(focusDate);
  const currentMonth = focusDate.slice(0, 7);
  return Array.from({ length: 42 }, (_, index) => {
    const day = buildWeekPlan(tasks, addDays(gridStart, index))[0];
    return {
      ...day,
      inCurrentMonth: day.date.startsWith(currentMonth)
    };
  });
};

export const countTodayCompleted = (tasks: Task[], today: DateKey): number =>
  tasks.filter((task) => task.status === "completed" && !isDeleted(task) && task.completedAt?.startsWith(today)).length;
