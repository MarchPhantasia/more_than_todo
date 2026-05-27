import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { createMemoryRepository } from "./data/memoryRepository";

describe("More Than Todo app", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("explains how the main work views differ", async () => {
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    expect(await screen.findByText("今天要推进的任务；设置为今天或已过期都会出现在这里。")).toBeInTheDocument();
  });

  it("uses quiet Things-style emoji affordances for lists and task metadata", async () => {
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    expect((await screen.findAllByText("⭐")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("🍅").length).toBeGreaterThan(0);
    expect(screen.getAllByText("🗓️").length).toBeGreaterThan(0);
    expect(screen.getAllByText("🚩").length).toBeGreaterThan(0);
  });

  it("uses a full main panel transition when switching task views", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    expect(await screen.findByTestId("main-panel-transition")).toHaveClass("animate-main-panel-switch");
    expect(screen.getByTestId("main-panel-transition")).toHaveAttribute("data-transition-key", "today");

    await user.click(screen.getByRole("button", { name: "随时 1" }));

    expect(await screen.findByRole("heading", { name: "随时" })).toBeInTheDocument();
    expect(screen.getByTestId("main-panel-transition")).toHaveClass("animate-main-panel-switch");
    expect(screen.getByTestId("main-panel-transition")).toHaveAttribute("data-transition-key", "anytime");
  });

  it("shows future tasks in Upcoming and opens read-only task previews by date", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    await user.click(await screen.findByRole("button", { name: "未来计划 1" }));

    expect(await screen.findByRole("heading", { name: "未来计划" })).toBeInTheDocument();
    expect(within(await screen.findByTestId("upcoming-date-detail")).getByText("5月27日的任务")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "查看全部未来计划" }));

    expect(screen.getByRole("button", { name: "规划 Vercel 部署清单 5月28日 工作 中" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "周" }));
    await user.click(await screen.findByRole("button", { name: "查看 5月28日任务" }));

    const detail = await screen.findByTestId("upcoming-date-detail");
    expect(within(detail).getByText("5月28日的任务")).toBeInTheDocument();
    expect(within(detail).getByText("规划 Vercel 部署清单")).toBeInTheDocument();
    expect(within(detail).queryByRole("button", { name: /完成/ })).not.toBeInTheDocument();
    expect(within(detail).queryByRole("button", { name: /打开任务详情/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "查看 5月29日任务" }));

    expect(within(await screen.findByTestId("upcoming-date-detail")).getByText("这一天没有任务")).toBeInTheDocument();
  });

  it("opens today's read-only task preview when entering Upcoming", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository("2026-05-28")}
        todayOverride="2026-05-28"
      />
    );

    await user.click(await screen.findByRole("button", { name: "未来计划 1" }));

    const detail = await screen.findByTestId("upcoming-date-detail");
    expect(within(detail).getByText("5月28日的任务")).toBeInTheDocument();
    expect(within(detail).getByText("设计今日工作台")).toBeInTheDocument();
    expect(within(detail).getByText("检查重复任务默认值")).toBeInTheDocument();
  });

  it("keeps the week date strip only in Upcoming", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    expect(await screen.findByRole("heading", { name: "今日" })).toBeInTheDocument();
    expect(screen.queryByText("2 个任务")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "未来计划 1" }));

    expect(await screen.findByRole("button", { name: "查看 5月27日任务" })).toBeInTheDocument();
  });

  it("shows open due-date tasks in the deadline view", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    await user.click(await screen.findByRole("button", { name: "截止 2" }));

    expect(await screen.findByRole("heading", { name: "截止" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "设计今日工作台 5月27日 设计 高" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "规划 Vercel 部署清单 5月28日 工作 中" })).toBeInTheDocument();
    expect(screen.queryByText("记录移动端优化想法")).not.toBeInTheDocument();
  });

  it("adds a task from quick add and shows it in Today", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    await user.click(await screen.findByRole("button", { name: "打开快速添加" }));
    await user.type(
      await screen.findByPlaceholderText("写下任务标题，也可以用 #项目 @标签 p1 今天 每周"),
      "Review product plan{Enter}"
    );

    expect(await screen.findByText("Review product plan")).toBeInTheDocument();
    expect(screen.getByText("3 个计划中")).toBeInTheDocument();
  });

  it("opens a centered command panel and keeps shortcut choices out of the title", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    await user.click(await screen.findByRole("button", { name: "打开快速添加" }));

    const commandPanel = await screen.findByTestId("quick-add-command-panel");
    const input = within(commandPanel).getByPlaceholderText("写下任务标题，也可以用 #项目 @标签 p1 今天 每周");

    expect(commandPanel).toHaveAttribute("role", "dialog");
    expect(screen.getByTestId("quick-add-command-backdrop")).toHaveClass("animate-modal-backdrop");
    expect(commandPanel).toHaveClass("animate-modal-panel");
    expect(within(commandPanel).getByText("#项目")).toBeInTheDocument();

    await user.type(input, "整理会议纪要");
    await user.click(within(commandPanel).getByRole("button", { name: "选择今天" }));
    await user.click(within(commandPanel).getByRole("button", { name: "选择高优先级" }));

    expect(input).toHaveValue("整理会议纪要");
    const preview = within(commandPanel).getByTestId("quick-add-preview");
    expect(within(preview).getByText("计划 5月27日")).toBeInTheDocument();
    expect(within(preview).getByText("高优先级")).toBeInTheDocument();

    await user.click(within(commandPanel).getByRole("button", { name: "创建任务" }));

    expect(await screen.findByRole("button", { name: "整理会议纪要 5月27日 高" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId("quick-add-command-panel")).not.toBeInTheDocument();
    });
  });

  it("keeps task details hidden until the row chevron is clicked", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    expect(await screen.findByTestId("today-rhythm-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("task-details-drawer")).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "设计今日工作台 5月27日 设计 高" }));
    expect(screen.queryByTestId("task-details-drawer")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "打开任务详情 设计今日工作台" }));
    expect(await screen.findByTestId("task-details-drawer")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "关闭任务详情" }));
    await waitFor(() => {
      expect(screen.queryByTestId("task-details-drawer")).not.toBeInTheDocument();
    });
  });

  it("opens a beginner-friendly usage manual from the right panel", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    await user.click(await screen.findByRole("button", { name: "打开使用手册" }));

    expect(await screen.findByTestId("usage-manual-drawer")).toBeInTheDocument();
    expect(screen.getByText("先收集，再安排，再回顾")).toBeInTheDocument();
    expect(screen.getByText("领域和阶段是进阶能力，不是开始使用 Todo 的前提。")).toBeInTheDocument();
    expect(screen.getByText(/默认只要求你写标题/)).toBeInTheDocument();
    expect(screen.getByText(/今日不是所有重要任务的仓库/)).toBeInTheDocument();
    expect(screen.getByText(/组织是为了减少选择，而不是制造表单/)).toBeInTheDocument();
  });

  it("keeps data tools in a corner drawer and removes the V1 scope footer", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    expect(await screen.findByRole("button", { name: "打开数据工具" })).toBeInTheDocument();
    expect(screen.queryByTestId("data-tools-drawer")).not.toBeInTheDocument();
    expect(screen.queryByText("V1 范围")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "打开数据工具" }));

    expect(await screen.findByTestId("data-tools-drawer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出数据" })).toBeInTheDocument();
    expect(screen.getByLabelText("选择导入文件")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "清空所有数据" })).toBeInTheDocument();
  });

  it("collapses area and project groups in the sidebar", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    expect(await screen.findByRole("button", { name: /^领域 工作/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "设计 2" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "折叠领域" }));

    expect(screen.queryByRole("button", { name: /^领域 工作/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建领域" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开领域" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "展开领域" }));
    expect(await screen.findByRole("button", { name: /^领域 工作/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "折叠项目" }));

    expect(screen.queryByRole("button", { name: "设计 2" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建项目" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开项目" })).toBeInTheDocument();
  });

  it("vertically centers controls in a plain newly added task row", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    await user.click(await screen.findByRole("button", { name: "收集箱 0" }));
    await user.click(screen.getByRole("button", { name: "打开快速添加" }));
    await user.type(
      await screen.findByPlaceholderText("写下任务标题，也可以用 #项目 @标签 p1 今天 每周"),
      "只写标题的任务{Enter}"
    );

    const article = (await screen.findByRole("button", { name: "完成 只写标题的任务" })).closest("article");
    const taskButton = screen.getByRole("button", { name: "只写标题的任务" });

    expect(article).toHaveClass("items-center");
    expect(article).not.toHaveClass("items-start");
    expect(taskButton.children).toHaveLength(1);
  });

  it("edits selected task details and displays project and tag metadata", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    await user.click(await screen.findByRole("button", { name: "打开任务详情 设计今日工作台" }));
    await user.selectOptions(screen.getByLabelText("项目"), "project-design");
    await user.click(screen.getByLabelText("深度工作 标签"));
    await user.click(screen.getByRole("button", { name: "显示更多设置" }));
    await user.clear(screen.getByLabelText("任务备注"));
    await user.type(screen.getByLabelText("任务备注"), "Tighten spacing and colors");

    await waitFor(() => {
      expect(screen.getAllByText("设计").length).toBeGreaterThan(0);
      expect(screen.getAllByText("深度工作").length).toBeGreaterThan(0);
    });
  });

  it("moves a task into Things-style lists from task details", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    await user.click(await screen.findByRole("button", { name: "打开任务详情 设计今日工作台" }));
    await user.click(screen.getByRole("button", { name: "放到随时" }));

    expect(await screen.findByRole("button", { name: "随时 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "今日 1" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "放到将来" }));

    expect(await screen.findByRole("button", { name: "将来 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "随时 1" })).toBeInTheDocument();
  });

  it("creates a tag from task details and assigns it to the selected task", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    await user.click(await screen.findByRole("button", { name: "打开任务详情 设计今日工作台" }));
    await user.type(screen.getByPlaceholderText("新建标签"), "灵感{Enter}");

    expect(await screen.findByLabelText("灵感 标签")).toBeChecked();
    expect(screen.getByRole("button", { name: "设计今日工作台 5月27日 设计 灵感 高" })).toBeInTheDocument();
  });

  it("creates task detail organization and checklist items inline", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    await user.click(await screen.findByRole("button", { name: "打开任务详情 设计今日工作台" }));
    await user.click(screen.getByRole("button", { name: "显示更多设置" }));
    await user.type(screen.getByPlaceholderText("新建领域"), "个人{Enter}");
    await user.type(screen.getByPlaceholderText("新建项目"), "App 重构{Enter}");
    await user.type(screen.getByPlaceholderText("新建阶段"), "准备{Enter}");
    await user.type(screen.getByPlaceholderText("添加清单项"), "拆出组件{Enter}");

    expect((await screen.findByLabelText("领域") as HTMLSelectElement).value).toMatch(/^area-/);
    expect((screen.getByLabelText("项目") as HTMLSelectElement).value).toMatch(/^project-/);
    expect((screen.getByLabelText("阶段") as HTMLSelectElement).value).toMatch(/^section-/);
    expect(screen.getByLabelText("清单项 拆出组件")).toBeInTheDocument();
  });

  it("starts and pauses a pomodoro for the selected task", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    expect(await screen.findByText("独立专注")).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "打开任务详情 设计今日工作台" }));
    await user.click(screen.getByRole("button", { name: "开始专注" }));
    expect(screen.getByText("进行中")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "暂停专注" }));
    expect(screen.getByText("已暂停")).toBeInTheDocument();
  });

  it("moves completed tasks into logbook and restores them", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    await user.click(await screen.findByRole("button", { name: "完成 设计今日工作台" }));
    await user.click(screen.getByRole("button", { name: "记录簿 2" }));

    expect(await screen.findByText("设计今日工作台")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "恢复 设计今日工作台" }));

    expect(await screen.findByRole("button", { name: "今日 2" })).toBeInTheDocument();
  });

  it("sets the pomodoro duration before starting focus", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    await user.clear(await screen.findByLabelText("番茄钟时长"));
    await user.type(screen.getByLabelText("番茄钟时长"), "15");

    expect(screen.getByText("15:00")).toBeInTheDocument();
  });

  it("adjusts the pomodoro duration by dragging the ring anchor up to two rounds", async () => {
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    const ring = await screen.findByTestId("pomodoro-duration-ring");
    const anchor = screen.getByRole("slider", { name: "拖动调整番茄钟时长" });
    vi.spyOn(ring, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 160,
      height: 160,
      top: 0,
      right: 160,
      bottom: 160,
      left: 0,
      toJSON: () => ({})
    } as DOMRect);

    fireEvent.mouseDown(anchor, { clientX: 113, clientY: 137 });
    fireEvent.mouseMove(window, { clientX: 11, clientY: 120 });
    fireEvent.mouseUp(window);

    expect(anchor).toHaveAttribute("aria-valuenow", "40");
    expect(screen.getByText("40:00")).toBeInTheDocument();

    fireEvent.keyDown(anchor, { key: "End" });

    expect(anchor).toHaveAttribute("aria-valuenow", "120");
    expect(screen.getByText("120:00")).toBeInTheDocument();
  });

  it("uses compact typography when pomodoro minutes reach three digits", async () => {
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    const anchor = await screen.findByRole("slider", { name: "拖动调整番茄钟时长" });
    fireEvent.keyDown(anchor, { key: "End" });

    const timerText = screen.getByText("120:00");
    expect(timerText).toHaveClass("inline-flex", "max-w-[4.75rem]", "text-2xl", "tabular-nums");
    expect(timerText).not.toHaveClass("text-[2rem]");
    expect(timerText).not.toHaveClass("text-4xl");
  });

  it("centers the pomodoro duration anchor on the green ring stroke", async () => {
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    const anchor = await screen.findByRole("slider", { name: "拖动调整番茄钟时长" });
    const left = Number.parseFloat(anchor.style.left);
    const top = Number.parseFloat(anchor.style.top);

    expect(Math.hypot(left - 50, top - 50)).toBeCloseTo((58 / 160) * 100, 2);
    expect(anchor).toHaveClass("h-4", "w-4");
  });

  it("updates the pomodoro ring immediately while the anchor is being dragged", async () => {
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    const ring = await screen.findByTestId("pomodoro-duration-ring");
    const anchor = screen.getByRole("slider", { name: "拖动调整番茄钟时长" });
    vi.spyOn(ring, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 160,
      height: 160,
      top: 0,
      right: 160,
      bottom: 160,
      left: 0,
      toJSON: () => ({})
    } as DOMRect);

    fireEvent.mouseDown(anchor, { clientX: 113, clientY: 137 });

    const animatedProgressCircles = Array.from(ring.querySelectorAll("circle")).filter((circle) =>
      circle.getAttribute("class")?.includes("transition-[stroke-dashoffset]")
    );

    expect(animatedProgressCircles).toHaveLength(0);

    fireEvent.mouseUp(window);
  });

  it("lets users explicitly enable system notifications for completed focus sessions", async () => {
    const user = userEvent.setup();
    const notificationConstructor = vi.fn() as unknown as {
      new (title: string, options?: NotificationOptions): Notification;
      permission: NotificationPermission;
      requestPermission: ReturnType<typeof vi.fn>;
    };
    notificationConstructor.permission = "default";
    notificationConstructor.requestPermission = vi.fn(async () => {
      notificationConstructor.permission = "granted";
      return "granted";
    });
    vi.stubGlobal("Notification", notificationConstructor);

    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    await user.click(await screen.findByRole("button", { name: "启用系统通知" }));

    expect(notificationConstructor.requestPermission).toHaveBeenCalled();
    expect(await screen.findByText("系统通知已开启")).toBeInTheDocument();
  });

  it("counts completed focus sessions by the user's local day", async () => {
    const repository = createMemoryRepository("2026-05-28");
    const localEarlyMorning = new Date(2026, 4, 28, 0, 30);
    await repository.saveFocusSession({
      id: "focus-local-midnight",
      plannedMinutes: 1,
      startedAt: localEarlyMorning.toISOString(),
      endedAt: localEarlyMorning.toISOString(),
      status: "completed"
    });

    render(
      <App
        repository={repository}
        todayOverride="2026-05-28"
      />
    );

    const rhythmPanel = await screen.findByTestId("today-rhythm-panel");
    const focusMetric = within(rhythmPanel).getByText("专注分钟").closest("div");

    expect(focusMetric).not.toBeNull();
    expect(within(focusMetric as HTMLElement).getByText("1")).toBeInTheDocument();
  });

  it("adds a project from the sidebar and uses it for quick add", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    await user.click(await screen.findByRole("button", { name: "新建项目" }));
    await user.type(screen.getByPlaceholderText("项目名称"), "学习");
    await user.click(screen.getByRole("button", { name: "确认新建项目" }));

    expect(await screen.findByRole("button", { name: "学习 0" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "打开快速添加" }));
    await user.type(
      await screen.findByPlaceholderText("写下任务标题，也可以用 #项目 @标签 p1 今天 每周"),
      "背单词{Enter}"
    );

    expect(await screen.findByRole("button", { name: "学习 1" })).toBeInTheDocument();
    expect(screen.getByText("背单词")).toBeInTheDocument();
  });

  it("adds a project with Enter from the sidebar", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    await user.click(await screen.findByRole("button", { name: "新建项目" }));
    await user.type(screen.getByPlaceholderText("项目名称"), "阅读{Enter}");

    expect(await screen.findByRole("button", { name: "阅读 0" })).toBeInTheDocument();
  });

  it("parses quick add shortcuts and auto-creates project and tag without leaving the current view", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    await user.click(await screen.findByRole("button", { name: "打开快速添加" }));
    const commandPanel = await screen.findByTestId("quick-add-command-panel");
    const input = within(commandPanel).getByPlaceholderText("写下任务标题，也可以用 #项目 @标签 p1 今天 每周");
    await user.type(input, "写周报 #学习 @灵感 p1 今天 每周");

    const preview = within(commandPanel).getByTestId("quick-add-preview");
    expect(within(preview).getByText("项目 学习")).toBeInTheDocument();
    expect(within(preview).getByText("标签 灵感")).toBeInTheDocument();
    expect(within(preview).getByText("高优先级")).toBeInTheDocument();

    await user.keyboard("{Enter}");

    expect(await screen.findByRole("heading", { name: "今日" })).toBeInTheDocument();
    expect(await screen.findByText("写周报")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "学习 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "写周报 5月27日 学习 灵感 高" })).toBeInTheDocument();
  });

  it("creates an area from the sidebar and drags a task into it", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    await user.click(await screen.findByRole("button", { name: "新建领域" }));
    await user.type(screen.getByPlaceholderText("领域名称"), "健康{Enter}");

    expect(await screen.findByRole("button", { name: "领域 健康 0" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "随时 1" }));

    const data = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: (key: string, value: string) => data.set(key, value),
      getData: (key: string) => data.get(key) ?? ""
    };

    fireEvent.dragStart(await screen.findByTestId("task-row-task-mobile-polish"), { dataTransfer });
    fireEvent.drop(screen.getByRole("button", { name: "领域 健康 0" }), { dataTransfer });

    expect(await screen.findByRole("button", { name: "领域 健康 1" })).toBeInTheDocument();
  });

  it("switches a project between sectioned list and board views", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    await user.click(await screen.findByRole("button", { name: "设计 2" }));

    expect(await screen.findByTestId("project-list-view")).toBeInTheDocument();
    expect(screen.getAllByText("探索").length).toBeGreaterThan(0);
    expect(screen.getAllByText("打磨").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "看板" }));

    expect(await screen.findByTestId("project-board-view")).toBeInTheDocument();
  });

  it("edits and deletes project sections without deleting their tasks", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    await user.click(await screen.findByRole("button", { name: "设计 2" }));
    await user.click(await screen.findByRole("button", { name: "编辑阶段 探索" }));
    await user.clear(screen.getByLabelText("阶段名称 探索"));
    await user.type(screen.getByLabelText("阶段名称 探索"), "调研{Enter}");

    expect(await screen.findByRole("button", { name: "编辑阶段 调研" })).toBeInTheDocument();
    expect(screen.queryByText("探索")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "删除阶段 调研" }));
    expect(screen.getByText("确认删除阶段：调研")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认删除阶段" })).toBeDisabled();

    await user.type(screen.getByLabelText("输入阶段名确认删除"), "调研");
    await user.click(screen.getByRole("button", { name: "确认删除阶段" }));

    await waitFor(() => {
      expect(screen.queryByText("调研")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "设计今日工作台 5月27日 设计 高" })).toBeInTheDocument();
  });

  it("deletes a project only after name confirmation", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    await user.click(await screen.findByRole("button", { name: "删除项目 设计" }));
    expect(screen.getByText("确认删除项目：设计")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "永久删除项目" })).toBeDisabled();

    await user.type(screen.getByLabelText("输入项目名确认删除"), "设计");
    await user.click(screen.getByRole("button", { name: "永久删除项目" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "设计 2" })).not.toBeInTheDocument();
    });
    expect(screen.getByText("设计今日工作台")).toBeInTheDocument();
  });

  it("exports and clears all local data from the sidebar", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    await user.click(await screen.findByRole("button", { name: "打开数据工具" }));
    await user.click(await screen.findByRole("button", { name: "导出数据" }));
    expect(await screen.findByText("已导出 JSON 文件")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "清空所有数据" }));
    expect(screen.getByRole("button", { name: "确认清空所有数据" })).toBeDisabled();

    await user.type(screen.getByLabelText("输入“清空”确认"), "清空");
    await user.click(screen.getByRole("button", { name: "确认清空所有数据" }));

    expect(await screen.findByRole("button", { name: "今日 0" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收集箱 0" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "回收站 0" })).toBeInTheDocument();
    expect(screen.getByText("这里没有任务")).toBeInTheDocument();
  });

  it("imports a JSON data file from the sidebar after confirmation", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    await user.click(await screen.findByRole("button", { name: "打开数据工具" }));
    const importedTask = {
      id: "task-imported",
      title: "从另一台设备导入",
      notes: "",
      status: "open",
      priority: "none",
      scheduledDate: "2026-05-27",
      tagIds: [],
      pomodoroEstimate: 1,
      createdAt: "2026-05-27T11:00:00.000Z",
      updatedAt: "2026-05-27T11:00:00.000Z"
    };
    const file = new File(
      [
        JSON.stringify({
          version: 1,
          exportedAt: "2026-05-27T11:05:00.000Z",
          tasks: [importedTask],
          projects: [],
          tags: [],
          sessions: []
        })
      ],
      "more-than-todo.json",
      { type: "application/json" }
    );

    await user.upload(await screen.findByLabelText("选择导入文件"), file);

    expect(await screen.findByText("导入文件已读取")).toBeInTheDocument();
    expect(screen.getByText("1 个任务 / 0 个项目 / 0 条专注记录")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "确认导入数据" }));

    expect(await screen.findByRole("button", { name: "今日 1" })).toBeInTheDocument();
    expect(screen.getByText("从另一台设备导入")).toBeInTheDocument();
    expect(screen.queryByText("设计今日工作台")).not.toBeInTheDocument();
  });

  it("keeps advanced task settings collapsed until requested", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    await user.click(await screen.findByRole("button", { name: "打开任务详情 设计今日工作台" }));

    expect(screen.getByLabelText("任务标题")).toBeInTheDocument();
    expect(screen.getByLabelText("项目")).toBeInTheDocument();
    expect(screen.getByLabelText("重复")).toBeInTheDocument();
    expect(screen.queryByLabelText("任务备注")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "显示更多设置" }));

    expect(screen.getByLabelText("任务备注")).toBeInTheDocument();
  });

  it("uses softer motion and polished controls in task details", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    await user.click(await screen.findByRole("button", { name: "打开任务详情 设计今日工作台" }));

    expect(screen.getByTestId("task-details-panel")).toHaveClass("animate-panel-soft");
    expect(screen.getByTestId("task-date-fields")).toHaveClass("grid-cols-1");
    expect(screen.getByLabelText("计划日期")).toHaveClass("form-control", "date-control");
    expect(screen.getByLabelText("项目")).toHaveClass("form-control", "select-control");
    expect(screen.getByLabelText("重复")).toHaveClass("form-control", "select-control");

    await user.click(screen.getByRole("button", { name: "显示更多设置" }));

    expect(screen.getByTestId("advanced-task-settings")).toHaveClass("animate-settings-reveal");
  });

  it("drags an anytime task to a project without scheduling it", async () => {
    const user = userEvent.setup();
    render(
      <App
        repository={createMemoryRepository()}
        todayOverride="2026-05-27"
      />
    );

    await user.click(await screen.findByRole("button", { name: "随时 1" }));

    const data = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: (key: string, value: string) => data.set(key, value),
      getData: (key: string) => data.get(key) ?? ""
    };

    fireEvent.dragStart(await screen.findByTestId("task-row-task-mobile-polish"), { dataTransfer });
    fireEvent.drop(screen.getByRole("button", { name: "生活 0" }), { dataTransfer });

    expect(await screen.findByRole("button", { name: "生活 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "随时 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "记录移动端优化想法 生活 快速处理 低" })).toBeInTheDocument();
  });
});
