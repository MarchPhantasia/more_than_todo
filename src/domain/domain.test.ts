import { describe, expect, it } from "vitest";
import { createInitialFocusTimer, focusTimerReducer } from "./focusTimer";
import { getNextScheduledDate } from "./repeat";
import { buildMonthPlan, buildWeekPlan, filterTasksForView } from "./taskSelectors";
import type { Task } from "./types";

const baseTask = (overrides: Partial<Task>): Task => ({
  id: overrides.id ?? "task-1",
  title: overrides.title ?? "Task",
  notes: overrides.notes ?? "",
  status: overrides.status ?? "open",
  priority: overrides.priority ?? "none",
  scheduledDate: overrides.scheduledDate,
  dueDate: overrides.dueDate,
  projectId: overrides.projectId,
  areaId: overrides.areaId,
  sectionId: overrides.sectionId,
  tagIds: overrides.tagIds ?? [],
  repeatRule: overrides.repeatRule,
  pomodoroEstimate: overrides.pomodoroEstimate ?? 1,
  checklistItems: overrides.checklistItems ?? [],
  sortOrder: overrides.sortOrder ?? 0,
  list: overrides.list,
  someday: overrides.someday,
  deletedAt: overrides.deletedAt,
  recurrenceSourceId: overrides.recurrenceSourceId,
  createdAt: overrides.createdAt ?? "2026-05-27T08:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2026-05-27T08:00:00.000Z",
  completedAt: overrides.completedAt
});

describe("repeat scheduling", () => {
  it("creates the next daily scheduled date", () => {
    expect(
      getNextScheduledDate("2026-05-27", { type: "daily", interval: 1 })
    ).toBe("2026-05-28");
  });

  it("creates the next weekly scheduled date using an interval", () => {
    expect(
      getNextScheduledDate("2026-05-27", { type: "weekly", interval: 2 })
    ).toBe("2026-06-10");
  });

  it("clamps monthly repeats to the last valid day", () => {
    expect(
      getNextScheduledDate("2026-01-31", { type: "monthly", interval: 1 })
    ).toBe("2026-02-28");
  });
});

describe("task selectors", () => {
  const today = "2026-05-27";
  const tasks = [
    baseTask({ id: "overdue", scheduledDate: "2026-05-26", title: "Overdue" }),
    baseTask({ id: "today", scheduledDate: today, title: "Today task" }),
    baseTask({ id: "future", scheduledDate: "2026-05-29", title: "Future" }),
    baseTask({ id: "inbox", scheduledDate: undefined, title: "Inbox" }),
    baseTask({
      id: "done",
      scheduledDate: today,
      title: "Done",
      status: "completed",
      completedAt: "2026-05-27T09:00:00.000Z"
    })
  ];

  it("shows open overdue and scheduled-today tasks in Today", () => {
    const result = filterTasksForView(tasks, { type: "today", today });
    expect(result.map((task) => task.id)).toEqual(["overdue", "today"]);
  });

  it("shows unscheduled open tasks in Inbox", () => {
    const result = filterTasksForView(tasks, { type: "inbox", today });
    expect(result.map((task) => task.id)).toEqual(["inbox"]);
  });

  it("shows future scheduled tasks in Upcoming", () => {
    const result = filterTasksForView(tasks, { type: "upcoming", today });
    expect(result.map((task) => task.id)).toEqual(["future"]);
  });

  it("separates Things-style default lists", () => {
    const resultTasks = [
      baseTask({ id: "raw-inbox", scheduledDate: undefined, projectId: undefined, tagIds: [], priority: "none" }),
      baseTask({ id: "anytime-project", scheduledDate: undefined, projectId: "project-work" }),
      baseTask({ id: "someday", scheduledDate: undefined, someday: true }),
      baseTask({ id: "deleted", deletedAt: "2026-05-27T10:00:00.000Z" }),
      baseTask({
        id: "completed",
        status: "completed",
        completedAt: "2026-05-27T10:00:00.000Z"
      }),
      baseTask({ id: "deadline", dueDate: "2026-05-28" })
    ];

    expect(filterTasksForView(resultTasks, { type: "inbox", today }).map((task) => task.id)).toEqual(["raw-inbox"]);
    expect(filterTasksForView(resultTasks, { type: "anytime", today }).map((task) => task.id)).toEqual(["anytime-project"]);
    expect(filterTasksForView(resultTasks, { type: "someday", today }).map((task) => task.id)).toEqual(["someday"]);
    expect(filterTasksForView(resultTasks, { type: "logbook", today }).map((task) => task.id)).toEqual(["completed"]);
    expect(filterTasksForView(resultTasks, { type: "trash", today }).map((task) => task.id)).toEqual(["deleted"]);
    expect(filterTasksForView(resultTasks, { type: "deadlines", today }).map((task) => task.id)).toEqual(["deadline"]);
  });

  it("counts scheduled work across a seven-day plan", () => {
    const week = buildWeekPlan(tasks, today);
    expect(week).toHaveLength(7);
    expect(week[0]).toMatchObject({ date: today, openCount: 1, completedCount: 1 });
    expect(week[2]).toMatchObject({ date: "2026-05-29", openCount: 1 });
  });

  it("builds a Monday-first month grid with scheduled and deadline counts", () => {
    const month = buildMonthPlan(
      [
        ...tasks,
        baseTask({ id: "deadline", dueDate: "2026-05-29" }),
        baseTask({ id: "deleted-scheduled", scheduledDate: today, deletedAt: "2026-05-27T10:00:00.000Z" })
      ],
      today
    );

    expect(month).toHaveLength(42);
    expect(month[0]).toMatchObject({ date: "2026-04-27", inCurrentMonth: false });
    expect(month.find((day) => day.date === today)).toMatchObject({
      inCurrentMonth: true,
      openCount: 1,
      completedCount: 1
    });
    expect(month.find((day) => day.date === "2026-05-29")).toMatchObject({
      openCount: 1,
      deadlineCount: 1
    });
  });
});

describe("focus timer reducer", () => {
  it("runs, pauses, resumes, and completes a focus session", () => {
    let state = createInitialFocusTimer(25);

    state = focusTimerReducer(state, {
      type: "start",
      taskId: "task-1",
      startedAt: "2026-05-27T10:00:00.000Z"
    });
    expect(state.status).toBe("running");
    expect(state.remainingSeconds).toBe(1500);

    state = focusTimerReducer(state, { type: "tick", seconds: 60 });
    expect(state.remainingSeconds).toBe(1440);

    state = focusTimerReducer(state, { type: "pause" });
    expect(state.status).toBe("paused");

    state = focusTimerReducer(state, {
      type: "start",
      startedAt: "2026-05-27T10:01:00.000Z"
    });
    state = focusTimerReducer(state, { type: "tick", seconds: 1440 });
    expect(state.status).toBe("completed");
    expect(state.remainingSeconds).toBe(0);
  });

  it("starts a fresh full-duration round after completion", () => {
    let state = createInitialFocusTimer(25);

    state = focusTimerReducer(state, {
      type: "start",
      startedAt: "2026-05-27T10:00:00.000Z"
    });
    state = focusTimerReducer(state, { type: "tick", seconds: 1500 });

    state = focusTimerReducer(state, {
      type: "start",
      startedAt: "2026-05-27T10:30:00.000Z"
    });

    expect(state.status).toBe("running");
    expect(state.remainingSeconds).toBe(1500);
    expect(state.startedAt).toBe("2026-05-27T10:30:00.000Z");
  });
});
