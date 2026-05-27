# Things-Inspired V2 First Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first usable Things-inspired slice: clearer default lists, Logbook/Trash separation, and an Upcoming list/week/month planning shell.

**Architecture:** Keep the existing Zustand store and repository boundary. Add task state fields without destructive migration, extend domain selectors, then update the current `App.tsx` UI in place before later component extraction.

**Tech Stack:** Vite, React, TypeScript, Tailwind CSS, Zustand, Dexie, Vitest, React Testing Library.

---

## Files

- Modify `src/domain/types.ts`: add optional task list/deletion/deadline fields.
- Modify `src/domain/taskSelectors.ts`: add Things-like filters and calendar helpers.
- Modify `src/domain/domain.test.ts`: selector and calendar tests.
- Modify `src/store/useTaskStore.tsx`: soft-delete behavior, restore behavior, import/export normalization.
- Modify `src/store/useTaskStore.test.ts`: store behavior tests.
- Modify `src/App.tsx`: sidebar nav, quick-add defaults, Upcoming view modes, Logbook/Trash labels.
- Modify `src/App.test.tsx`: component tests for new views.

## Task 1: Domain Task States

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/taskSelectors.ts`
- Test: `src/domain/domain.test.ts`

- [ ] **Step 1: Write failing selector tests**

Add tests that assert:

```ts
const tasks = [
  baseTask({ id: "raw-inbox", scheduledDate: undefined, projectId: undefined, tagIds: [], priority: "none" }),
  baseTask({ id: "anytime-project", scheduledDate: undefined, projectId: "project-work" }),
  baseTask({ id: "someday", scheduledDate: undefined, someday: true }),
  baseTask({ id: "deleted", deletedAt: "2026-05-27T10:00:00.000Z" }),
  baseTask({ id: "completed", status: "completed", completedAt: "2026-05-27T10:00:00.000Z" }),
  baseTask({ id: "deadline", dueDate: "2026-05-28" })
];

expect(filterTasksForView(tasks, { type: "inbox", today }).map((task) => task.id)).toEqual(["raw-inbox"]);
expect(filterTasksForView(tasks, { type: "anytime", today }).map((task) => task.id)).toEqual(["anytime-project"]);
expect(filterTasksForView(tasks, { type: "someday", today }).map((task) => task.id)).toEqual(["someday"]);
expect(filterTasksForView(tasks, { type: "logbook", today }).map((task) => task.id)).toEqual(["completed"]);
expect(filterTasksForView(tasks, { type: "trash", today }).map((task) => task.id)).toEqual(["deleted"]);
expect(filterTasksForView(tasks, { type: "deadlines", today }).map((task) => task.id)).toEqual(["deadline"]);
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm run test -- src/domain/domain.test.ts`

Expected: TypeScript or assertion failure because `someday`, `deletedAt`, and new filter types do not exist.

- [ ] **Step 3: Implement task fields and filters**

Add to `Task`:

```ts
someday?: boolean;
deletedAt?: string;
```

Extend `TaskViewFilter` with `anytime`, `someday`, `logbook`, and `deadlines`.

Implement:

```ts
const isDeleted = (task: Task) => Boolean(task.deletedAt);
const isOpenActive = (task: Task) => task.status === "open" && !isDeleted(task);
const isInboxTask = (task: Task) =>
  isOpenActive(task) &&
  !task.scheduledDate &&
  !task.someday &&
  !task.projectId &&
  task.tagIds.length === 0 &&
  task.priority === "none" &&
  !task.repeatRule;
```

- [ ] **Step 4: Run tests and verify pass**

Run: `npm run test -- src/domain/domain.test.ts`

Expected: selector tests pass.

## Task 2: Store Soft Delete And Restore

**Files:**
- Modify: `src/store/useTaskStore.tsx`
- Test: `src/store/useTaskStore.test.ts`

- [ ] **Step 1: Write failing store tests**

Add tests for:

```ts
await store.getState().deleteTask("task-design");
expect(store.getState().tasks.find((task) => task.id === "task-design")?.deletedAt).toBeDefined();
expect((await repository.listTasks()).find((task) => task.id === "task-design")?.deletedAt).toBeDefined();
```

And:

```ts
await store.getState().toggleTask("task-design");
expect(store.getState().tasks.find((task) => task.id === "task-design")?.status).toBe("completed");
expect(store.getState().tasks.find((task) => task.id === "task-design")?.deletedAt).toBeUndefined();
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm run test -- src/store/useTaskStore.test.ts`

Expected: deleted tasks are removed from repository instead of soft deleted.

- [ ] **Step 3: Implement soft delete**

Change `deleteTask` to set `deletedAt` and `updatedAt`, save the task, and keep it in state. Add a `restoreDeletedTask(taskId)` store method only if the UI needs it; otherwise reuse `updateTask(taskId, { deletedAt: undefined })`.

- [ ] **Step 4: Run tests and verify pass**

Run: `npm run test -- src/store/useTaskStore.test.ts`

Expected: soft delete and completion behavior pass.

## Task 3: Upcoming Week And Month Helpers

**Files:**
- Modify: `src/domain/date.ts`
- Modify: `src/domain/taskSelectors.ts`
- Test: `src/domain/domain.test.ts`

- [ ] **Step 1: Write failing calendar tests**

Add tests for:

```ts
const month = buildMonthPlan(tasks, "2026-05-27");
expect(month).toHaveLength(35);
expect(month.find((day) => day.date === "2026-05-29")?.openCount).toBe(1);
expect(month[0].date).toBe("2026-04-27");
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm run test -- src/domain/domain.test.ts`

Expected: `buildMonthPlan` does not exist.

- [ ] **Step 3: Implement helpers**

Add:

```ts
export const startOfMonthGrid = (key: DateKey): DateKey => {
  const date = parseDateKey(key);
  const day = date.getDay() === 0 ? 7 : date.getDay();
  date.setDate(1 - (day - 1));
  return toDateKey(date);
};
```

Add `buildMonthPlan(tasks, anchorDate)` using 35 or 42 days. Use 35 when enough for the month, 42 when needed.

- [ ] **Step 4: Run tests and verify pass**

Run: `npm run test -- src/domain/domain.test.ts`

Expected: calendar tests pass.

## Task 4: Sidebar And View UI

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write failing component tests**

Add tests that:

```ts
expect(await screen.findByRole("button", { name: /Anytime/ })).toBeInTheDocument();
expect(screen.getByRole("button", { name: /Someday/ })).toBeInTheDocument();
expect(screen.getByRole("button", { name: /Logbook/ })).toBeInTheDocument();
expect(screen.getByRole("button", { name: /Deadlines/ })).toBeInTheDocument();
```

Add an Upcoming mode test:

```ts
await user.click(screen.getByRole("button", { name: /未来计划/ }));
await user.click(screen.getByRole("button", { name: "周" }));
expect(screen.getByTestId("upcoming-week-view")).toBeInTheDocument();
await user.click(screen.getByRole("button", { name: "月" }));
expect(screen.getByTestId("upcoming-month-view")).toBeInTheDocument();
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm run test -- src/App.test.tsx`

Expected: new nav buttons and mode test IDs do not exist.

- [ ] **Step 3: Implement nav and Upcoming mode state**

Extend `ActiveView`, `viewLabel`, `viewTips`, nav list, counts, and visible task handling.

In `MainPanel`, add local state:

```ts
const [upcomingMode, setUpcomingMode] = useState<"list" | "week" | "month">("list");
```

Render segmented controls only for Upcoming.

- [ ] **Step 4: Implement Week/Month UI shell**

Add `UpcomingWeekView` and `UpcomingMonthView` inside `App.tsx` for this slice. Use existing task rows or compact day cells. Do not build drag scheduling in this first pass unless tests require it.

- [ ] **Step 5: Run tests and verify pass**

Run: `npm run test -- src/App.test.tsx`

Expected: sidebar and Upcoming modes pass.

## Task 5: Quick Add Defaults

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write failing tests**

Add tests:

```ts
await user.click(screen.getByRole("button", { name: /Someday/ }));
await user.type(screen.getByPlaceholderText("添加今天要做的任务..."), "以后再研究{Enter}");
expect(await screen.findByText("以后再研究")).toBeInTheDocument();
```

And:

```ts
await user.click(screen.getByRole("button", { name: /Anytime/ }));
await user.type(screen.getByPlaceholderText("添加今天要做的任务..."), "随时可做{Enter}");
expect(await screen.findByText("随时可做")).toBeInTheDocument();
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm run test -- src/App.test.tsx`

Expected: quick add sends tasks to Today or Inbox instead of the selected V2 list.

- [ ] **Step 3: Implement defaults**

For `QuickAdd`, set:

```ts
scheduledDate: activeView === "today" ? today : undefined,
someday: activeView === "someday",
projectId: activeView === "project" ? activeProjectId : undefined,
```

For Anytime, ensure a newly added task is classified as actionable by setting a project when in project view or a small `list` marker if added later. In this first slice, add `someday: false` and rely on filter logic after adding an optional `list?: "anytime"` only if needed.

- [ ] **Step 4: Run tests and verify pass**

Run: `npm run test -- src/App.test.tsx`

Expected: quick add appears in selected V2 list.

## Task 6: Full Verification

**Files:**
- All changed files

- [ ] **Step 1: Run full test suite**

Run: `npm run test`

Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: TypeScript and Vite build pass.

- [ ] **Step 3: Browser verification**

Open `http://127.0.0.1:5173/` and verify:

- new nav items render
- Logbook and Trash are separate
- Upcoming list/week/month switch works
- no obvious layout overlap
