import clsx from "clsx";
import {
  BookOpen,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock3,
  Database,
  Download,
  Eraser,
  Flag,
  FolderKanban,
  Inbox,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Tag,
  Timer,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { type DragEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { addDays, formatMonthDay, formatShortWeekday, toDateKey } from "./domain/date";
import { requestNotificationPermission } from "./domain/feedback";
import { formatTimer } from "./domain/focusTimer";
import { parseQuickAdd, type QuickAddParseResult } from "./domain/quickAdd";
import { repeatLabel } from "./domain/repeat";
import {
  buildMonthPlan,
  buildWeekPlan,
  countTodayCompleted,
  filterTasksForView
} from "./domain/taskSelectors";
import type { Area, ChecklistItem, ColorToken, Priority, Project, ProjectSection, RepeatRule, Task } from "./domain/types";
import { createTaskRepository, type TaskRepository } from "./data/repository";
import {
  isTaskDataExport,
  TaskStoreProvider,
  useTaskStore,
  type ActiveView,
  type TaskDataExport
} from "./store/useTaskStore";

interface AppProps {
  repository?: TaskRepository;
  todayOverride?: string;
}

interface PendingImport {
  fileName: string;
  snapshot: TaskDataExport;
}

type UpcomingMode = "list" | "week" | "month";
type ProjectMode = "list" | "board";
type SidebarFixedView = Exclude<ActiveView, "project" | "area">;
type PlacementKey = "inbox" | "today" | "tomorrow" | "anytime" | "someday";

const colorClass: Record<ColorToken, string> = {
  teal: "border-teal/20 bg-teal/10 text-teal",
  blue: "border-blue/20 bg-blue/10 text-blue",
  coral: "border-coral/20 bg-coral/10 text-coral",
  amber: "border-amber/25 bg-amber/10 text-amber",
  focus: "border-focus/20 bg-focus/10 text-focus",
  violet: "border-violet/20 bg-violet/10 text-violet"
};

const dotClass: Record<ColorToken, string> = {
  teal: "bg-teal",
  blue: "bg-blue",
  coral: "bg-coral",
  amber: "bg-amber",
  focus: "bg-focus",
  violet: "bg-violet"
};

const priorityClass: Record<Priority, string> = {
  high: "border-coral/25 bg-coral/10 text-coral",
  medium: "border-amber/25 bg-amber/10 text-amber",
  low: "border-blue/20 bg-blue/10 text-blue",
  none: "border-line bg-paper text-muted"
};

const priorityLabel: Record<Priority, string> = {
  high: "高",
  medium: "中",
  low: "低",
  none: "无"
};

const viewLabel: Record<ActiveView, string> = {
  inbox: "收集箱",
  today: "今日",
  upcoming: "未来计划",
  anytime: "随时",
  someday: "将来",
  logbook: "记录簿",
  deadlines: "截止",
  focus: "专注",
  trash: "回收站",
  area: "领域",
  project: "项目"
};

const viewTips: Record<ActiveView, string> = {
  inbox: "先把想法放进来，稍后再决定项目和日期。",
  today: "今天要推进的任务；设置为今天或已过期都会出现在这里。",
  upcoming: "明天及以后已安排日期的任务，用列表、周视图或月视图提前做计划。",
  anytime: "没有计划日期、但已经明确归属或优先级的任务；有空时就可以处理。",
  someday: "暂时不推进但值得保留的想法；它不会挤进今日和未来计划。",
  logbook: "已经完成的任务记录，适合回顾，不等同于回收站。",
  deadlines: "有截止日期的任务集合，用来避免错过硬期限。",
  focus: "近期可做的任务视图；右侧番茄钟独立记录专注时间。",
  trash: "已删除的任务在这里，恢复后才会回到原列表。",
  area: "领域是长期责任区，例如工作、生活和学习；任务可以直接归属领域，也可以通过项目归属。",
  project: "项目表示任务归属；拖任务到左侧项目即可快速归类。"
};

const viewEmoji: Record<ActiveView, string> = {
  inbox: "📥",
  today: "⭐",
  upcoming: "🗓️",
  anytime: "⚡",
  someday: "🌙",
  logbook: "✅",
  deadlines: "🚩",
  focus: "🍅",
  trash: "🗑️",
  area: "🧭",
  project: "📁"
};

const placementOptions: Array<{ key: PlacementKey; label: string; emoji: string }> = [
  { key: "inbox", label: "收集箱", emoji: "📥" },
  { key: "today", label: "今日", emoji: "⭐" },
  { key: "tomorrow", label: "明天", emoji: "🗓️" },
  { key: "anytime", label: "随时", emoji: "⚡" },
  { key: "someday", label: "将来", emoji: "🌙" }
];

const getPlacementPatch = (placement: PlacementKey, today: string): Partial<Task> => {
  if (placement === "inbox") {
    return {
      scheduledDate: undefined,
      dueDate: undefined,
      projectId: undefined,
      areaId: undefined,
      sectionId: undefined,
      tagIds: [],
      priority: "none",
      repeatRule: undefined,
      list: "inbox",
      someday: false
    };
  }

  if (placement === "today") {
    return { scheduledDate: today, list: undefined, someday: false };
  }

  if (placement === "tomorrow") {
    return { scheduledDate: addDays(today, 1), list: undefined, someday: false };
  }

  if (placement === "anytime") {
    return { scheduledDate: undefined, dueDate: undefined, list: "anytime", someday: false };
  }

  return { scheduledDate: undefined, list: undefined, someday: true };
};

const isPlacementActive = (task: Task, placement: PlacementKey, today: string): boolean => {
  if (placement === "inbox") return task.list === "inbox";
  if (placement === "today") return task.scheduledDate === today && !task.someday;
  if (placement === "tomorrow") return task.scheduledDate === addDays(today, 1) && !task.someday;
  if (placement === "anytime") return task.list === "anytime" && !task.scheduledDate && !task.someday;
  return Boolean(task.someday);
};

const TASK_DRAG_TYPE = "application/x-more-than-todo-task";

const getDraggedTaskId = (event: DragEvent<HTMLElement>) =>
  event.dataTransfer.getData(TASK_DRAG_TYPE) || event.dataTransfer.getData("text/plain");

const downloadJsonFile = (filename: string, value: unknown) => {
  if (typeof document === "undefined") return;

  const json = JSON.stringify(value, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url =
    typeof URL !== "undefined" && "createObjectURL" in URL
      ? URL.createObjectURL(blob)
      : `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);

  if (typeof navigator === "undefined" || !navigator.userAgent.includes("jsdom")) {
    link.click();
  }

  link.remove();
  if (typeof URL !== "undefined" && "revokeObjectURL" in URL && url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
};

const readFileText = (file: File): Promise<string> => {
  if (typeof file.text === "function") {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
};

const readJsonFile = async (file: File): Promise<unknown> => JSON.parse(await readFileText(file));

type NotificationUiState = NotificationPermission | "unsupported";

const getNotificationPermissionState = (): NotificationUiState => {
  if (!("Notification" in globalThis)) return "unsupported";
  return globalThis.Notification.permission;
};

export default function App({ repository, todayOverride }: AppProps) {
  const resolvedRepository = useMemo(() => repository ?? createTaskRepository(), [repository]);
  const today = todayOverride ?? toDateKey(new Date());

  return (
    <TaskStoreProvider repository={resolvedRepository} today={today}>
      <Workbench />
    </TaskStoreProvider>
  );
}

function Workbench() {
  const loading = useTaskStore((state) => state.loading);
  const initialize = useTaskStore((state) => state.initialize);
  const focusStatus = useTaskStore((state) => state.focus.status);
  const tickFocus = useTaskStore((state) => state.tickFocus);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (focusStatus !== "running") return undefined;
    const interval = window.setInterval(() => {
      void tickFocus(1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [focusStatus, tickFocus]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper text-sm text-muted">
        正在加载工作台...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <MobileNav />
      <div className="mx-auto grid min-h-screen max-w-[1500px] grid-cols-1 gap-3 p-3 lg:grid-cols-[240px_minmax(0,1fr)_360px] lg:p-4">
        <Sidebar />
        <section className="panel min-w-0 overflow-hidden">
          <MainPanel />
        </section>
        <aside className="panel min-h-[520px] overflow-hidden">
          <RightPanel />
        </aside>
      </div>
      <Toast />
      <TaskDetailsDrawer />
      <UsageManualDrawer />
    </main>
  );
}

function MobileNav() {
  const activeView = useTaskStore((state) => state.activeView);
  const setActiveView = useTaskStore((state) => state.setActiveView);
  const items: Array<{ view: ActiveView; label: string }> = [
    { view: "today", label: "今日" },
    { view: "inbox", label: "收集箱" },
    { view: "upcoming", label: "未来" },
    { view: "anytime", label: "随时" },
    { view: "someday", label: "将来" },
    { view: "logbook", label: "记录簿" },
    { view: "focus", label: "专注" },
    { view: "trash", label: "回收站" }
  ];

  return (
    <nav className="sticky top-0 z-20 flex gap-2 overflow-x-auto border-b border-line bg-white/95 px-3 py-2 backdrop-blur lg:hidden">
      {items.map((item) => (
        <button
          key={item.view}
          aria-label={item.label}
          className={clsx(
            "focus-ring inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200",
            activeView === item.view ? "bg-blue text-white" : "bg-paper text-muted"
          )}
          onClick={() => setActiveView(item.view)}
        >
          <span aria-hidden="true">{viewEmoji[item.view]}</span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function Sidebar() {
  const activeView = useTaskStore((state) => state.activeView);
  const activeProjectId = useTaskStore((state) => state.activeProjectId);
  const activeAreaId = useTaskStore((state) => state.activeAreaId);
  const projects = useTaskStore((state) => state.projects);
  const areas = useTaskStore((state) => state.areas);
  const tasks = useTaskStore((state) => state.tasks);
  const today = useTaskStore((state) => state.today);
  const setActiveView = useTaskStore((state) => state.setActiveView);
  const addProject = useTaskStore((state) => state.addProject);
  const deleteProject = useTaskStore((state) => state.deleteProject);
  const addArea = useTaskStore((state) => state.addArea);
  const deleteArea = useTaskStore((state) => state.deleteArea);
  const updateTask = useTaskStore((state) => state.updateTask);
  const exportData = useTaskStore((state) => state.exportData);
  const importData = useTaskStore((state) => state.importData);
  const clearAllData = useTaskStore((state) => state.clearAllData);
  const [projectDraft, setProjectDraft] = useState("");
  const [areaDraft, setAreaDraft] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [creatingArea, setCreatingArea] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string>();
  const [deletingAreaId, setDeletingAreaId] = useState<string>();
  const [deleteProjectDraft, setDeleteProjectDraft] = useState("");
  const [deleteAreaDraft, setDeleteAreaDraft] = useState("");
  const [dragTarget, setDragTarget] = useState<string>();
  const [dataToolMessage, setDataToolMessage] = useState("");
  const [pendingImport, setPendingImport] = useState<PendingImport>();
  const [fileInputKey, setFileInputKey] = useState(0);
  const [confirmingClearData, setConfirmingClearData] = useState(false);
  const [clearDataDraft, setClearDataDraft] = useState("");

  const taskNav: Array<{ view: SidebarFixedView; label: string; icon: typeof Inbox }> = [
    { view: "inbox", label: "收集箱", icon: Inbox },
    { view: "today", label: "今日", icon: CalendarCheck },
    { view: "upcoming", label: "未来计划", icon: CalendarDays },
    { view: "anytime", label: "随时", icon: Circle },
    { view: "someday", label: "将来", icon: Clock3 },
    { view: "deadlines", label: "截止", icon: Flag }
  ];
  const autoNav: Array<{ view: SidebarFixedView; label: string; icon: typeof Inbox }> = [
    { view: "logbook", label: "记录簿", icon: CheckCircle2 },
    { view: "focus", label: "专注", icon: Timer },
    { view: "trash", label: "回收站", icon: Trash2 }
  ];

  const counts: Record<SidebarFixedView, number> = {
    inbox: filterTasksForView(tasks, { type: "inbox", today }).length,
    today: filterTasksForView(tasks, { type: "today", today }).length,
    upcoming: filterTasksForView(tasks, { type: "upcoming", today }).length,
    anytime: filterTasksForView(tasks, { type: "anytime", today }).length,
    someday: filterTasksForView(tasks, { type: "someday", today }).length,
    deadlines: filterTasksForView(tasks, { type: "deadlines", today }).length,
    logbook: filterTasksForView(tasks, { type: "logbook", today }).length,
    focus: filterTasksForView(tasks, { type: "focus", today }).length,
    trash: filterTasksForView(tasks, { type: "trash", today }).length
  };

  const submitProject = async () => {
    const trimmed = projectDraft.trim();
    if (!trimmed) return;
    await addProject(trimmed);
    setProjectDraft("");
    setCreatingProject(false);
  };

  const submitArea = async () => {
    const trimmed = areaDraft.trim();
    if (!trimmed) return;
    await addArea(trimmed);
    setAreaDraft("");
    setCreatingArea(false);
  };

  const handleExportData = async () => {
    const snapshot = await exportData();
    downloadJsonFile(`more-than-todo-${snapshot.exportedAt.slice(0, 10)}.json`, snapshot);
    setDataToolMessage("已导出 JSON 文件");
  };

  const handleImportFile = async (file?: File) => {
    if (!file) return;

    setPendingImport(undefined);
    setConfirmingClearData(false);
    setDataToolMessage("");

    try {
      const snapshot = await readJsonFile(file);
      if (!isTaskDataExport(snapshot)) {
        setDataToolMessage("导入文件格式不正确");
        return;
      }

      setPendingImport({ fileName: file.name, snapshot });
      setDataToolMessage("导入文件已读取");
    } catch {
      setDataToolMessage("导入文件格式不正确");
    } finally {
      setFileInputKey((value) => value + 1);
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingImport) return;
    await importData(pendingImport.snapshot);
    setPendingImport(undefined);
    setDataToolMessage("数据已导入");
  };

  const handleClearAllData = async () => {
    await clearAllData();
    setConfirmingClearData(false);
    setClearDataDraft("");
    setDeletingProjectId(undefined);
    setDeletingAreaId(undefined);
    setPendingImport(undefined);
    setDataToolMessage("所有本地数据已清空");
  };

  const getViewDropPatch = (view: SidebarFixedView): Partial<Task> | undefined => {
    if (view === "inbox") {
      return {
        scheduledDate: undefined,
        dueDate: undefined,
        projectId: undefined,
        areaId: undefined,
        sectionId: undefined,
        tagIds: [],
        priority: "none",
        repeatRule: undefined,
        list: "inbox",
        someday: false
      };
    }
    if (view === "today") return { scheduledDate: today, list: undefined, someday: false };
    if (view === "upcoming") return { scheduledDate: addDays(today, 1), list: undefined, someday: false };
    if (view === "anytime") return { scheduledDate: undefined, dueDate: undefined, list: "anytime", someday: false };
    if (view === "someday") return { scheduledDate: undefined, list: undefined, someday: true };
    if (view === "deadlines") return { dueDate: addDays(today, 1), someday: false };
    return undefined;
  };

  const handleDragOver = (event: DragEvent<HTMLElement>, target: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragTarget(target);
  };

  const handleDropOnView = (event: DragEvent<HTMLElement>, view: SidebarFixedView) => {
    const patch = getViewDropPatch(view);
    if (!patch) return;
    event.preventDefault();
    setDragTarget(undefined);
    const taskId = getDraggedTaskId(event);
    if (!taskId) return;
    void updateTask(taskId, patch);
  };

  const handleDropOnProject = (event: DragEvent<HTMLElement>, projectId: string) => {
    event.preventDefault();
    setDragTarget(undefined);
    const taskId = getDraggedTaskId(event);
    if (!taskId) return;
    const project = projects.find((item) => item.id === projectId);
    void updateTask(taskId, { projectId, areaId: project?.areaId, sectionId: undefined });
  };

  const handleDropOnArea = (event: DragEvent<HTMLElement>, areaId: string) => {
    event.preventDefault();
    setDragTarget(undefined);
    const taskId = getDraggedTaskId(event);
    if (!taskId) return;
    void updateTask(taskId, { areaId, list: "anytime", someday: false });
  };

  const renderNavItem = (item: { view: SidebarFixedView; label: string; icon: typeof Inbox }) => {
    const Icon = item.icon;
    const selected = activeView === item.view;
    const dropPatch = getViewDropPatch(item.view);
    const dropTarget = `view-${item.view}`;
    return (
      <button
        key={item.view}
        aria-label={`${item.label} ${counts[item.view]}`}
        className={clsx(
          "focus-ring flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200",
          selected ? "bg-blue/10 text-blue shadow-sm" : "text-muted hover:bg-paper hover:text-ink",
          dragTarget === dropTarget && "ring-2 ring-blue/30"
        )}
        onDragLeave={() => setDragTarget(undefined)}
        onDragOver={(event) => {
          if (!dropPatch) return;
          handleDragOver(event, dropTarget);
        }}
        onDrop={(event) => handleDropOnView(event, item.view)}
        onClick={() => setActiveView(item.view)}
        title={viewTips[item.view]}
      >
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={clsx("view-emoji-badge", selected && "view-emoji-badge-active")}
          >
            {viewEmoji[item.view]}
          </span>
          <Icon aria-hidden="true" className="text-muted/80" size={14} />
          <span>{item.label}</span>
        </span>
        <span className="text-xs">{counts[item.view]}</span>
      </button>
    );
  };

  return (
    <aside className="panel hidden min-h-[calc(100vh-2rem)] flex-col p-3 lg:flex">
      <div className="mb-5 flex items-center gap-3 px-2 py-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue text-white">
          <CheckCircle2 size={20} />
        </div>
        <div>
          <h1 className="text-base font-semibold tracking-normal">More Than Todo</h1>
          <p className="text-xs text-muted">本地优先工作台</p>
        </div>
      </div>

      <div>
        <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted">任务列表</div>
        <div className="space-y-1">{taskNav.map(renderNavItem)}</div>
      </div>

      <div className="mt-5">
        <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted">自动视图</div>
        <div className="space-y-1">{autoNav.map(renderNavItem)}</div>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-muted">
          <span>领域</span>
          <button
            aria-label="新建领域"
            className="focus-ring rounded-md p-1 transition-colors hover:bg-paper hover:text-ink"
            onClick={() => setCreatingArea(true)}
            title="新建领域"
          >
            <Plus size={14} />
          </button>
        </div>
        {creatingArea && (
          <form
            className="mb-2 flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              void submitArea();
            }}
          >
            <span className="shrink-0 text-sm" aria-hidden="true">
              🧭
            </span>
            <input
              aria-label="领域名称"
              autoFocus
              className="focus-ring min-w-0 flex-1 rounded-md border-0 bg-transparent px-1 py-1 text-sm outline-none"
              name="area-name"
              placeholder="领域名称"
              value={areaDraft}
              onChange={(event) => setAreaDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                event.preventDefault();
                void submitArea();
              }}
            />
            <button
              aria-label="确认新建领域"
              className="focus-ring rounded-md p-1 text-blue hover:bg-blue/10 disabled:text-muted"
              disabled={!areaDraft.trim()}
              type="submit"
            >
              <CheckCircle2 size={14} />
            </button>
            <button
              aria-label="取消新建领域"
              className="focus-ring rounded-md p-1 text-muted hover:bg-paper hover:text-ink"
              type="button"
              onClick={() => {
                setAreaDraft("");
                setCreatingArea(false);
              }}
            >
              <X size={14} />
            </button>
          </form>
        )}
        <div className="space-y-1">
          {areas.map((area) => {
            const selected = activeView === "area" && activeAreaId === area.id;
            const count = tasks.filter((task) => task.areaId === area.id && task.status === "open" && !task.deletedAt).length;
            const areaDropTarget = `area-${area.id}`;
            return (
              <div key={area.id}>
                <div
                  className={clsx(
                    "group flex items-center rounded-md transition-colors duration-200",
                    selected ? "bg-paper text-ink" : "text-muted hover:bg-paper hover:text-ink",
                    dragTarget === areaDropTarget && "bg-blue/10 text-blue ring-2 ring-blue/30"
                  )}
                >
                  <button
                    aria-label={`领域 ${area.name} ${count}`}
                    className="focus-ring flex min-w-0 flex-1 items-center justify-between rounded-md px-3 py-2 text-sm"
                    onDragLeave={() => setDragTarget(undefined)}
                    onDragOver={(event) => handleDragOver(event, areaDropTarget)}
                    onDrop={(event) => handleDropOnArea(event, area.id)}
                    onClick={() => setActiveView("area", area.id)}
                    title="拖任务到这里可归入领域"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", dotClass[area.color])} />
                      <span className="truncate">{area.name}</span>
                    </span>
                    <span className="text-xs">{count}</span>
                  </button>
                  <button
                    aria-label={`删除领域 ${area.name}`}
                    className="focus-ring mr-1 rounded-md p-1.5 text-muted opacity-70 transition hover:bg-coral/10 hover:text-coral group-hover:opacity-100"
                    onClick={() => {
                      setDeletingAreaId(area.id);
                      setDeleteAreaDraft("");
                    }}
                    title={`删除领域 ${area.name}`}
                    type="button"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {deletingAreaId === area.id && (
                  <div className="animate-enter mt-1 rounded-md border border-coral/20 bg-coral/5 p-2">
                    <p className="text-xs font-semibold text-coral">确认删除领域：{area.name}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">任务和项目会保留，并自动移出这个领域。</p>
                    <input
                      aria-label="输入领域名确认删除"
                      className="focus-ring mt-2 w-full rounded-md border border-line bg-white px-2 py-1.5 text-xs text-ink"
                      name="delete-area-confirmation"
                      placeholder={area.name}
                      value={deleteAreaDraft}
                      onChange={(event) => setDeleteAreaDraft(event.target.value)}
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        aria-label="取消删除领域"
                        className="focus-ring flex-1 rounded-md border border-line bg-white px-2 py-1.5 text-xs font-semibold text-muted hover:text-ink"
                        type="button"
                        onClick={() => {
                          setDeletingAreaId(undefined);
                          setDeleteAreaDraft("");
                        }}
                      >
                        取消
                      </button>
                      <button
                        aria-label="永久删除领域"
                        className="focus-ring flex-1 rounded-md bg-coral px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                        disabled={deleteAreaDraft !== area.name}
                        type="button"
                        onClick={() => {
                          void deleteArea(area.id).then(() => {
                            setDeletingAreaId(undefined);
                            setDeleteAreaDraft("");
                          });
                        }}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-muted">
          <span>项目</span>
          <button
            aria-label="新建项目"
            className="focus-ring rounded-md p-1 transition-colors hover:bg-paper hover:text-ink"
            onClick={() => setCreatingProject(true)}
            title="新建项目"
          >
            <Plus size={14} />
          </button>
        </div>
        {creatingProject && (
          <form
            className="mb-2 flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              void submitProject();
            }}
          >
            <FolderKanban size={14} className="shrink-0 text-blue" />
            <input
              aria-label="项目名称"
              autoFocus
              className="focus-ring min-w-0 flex-1 rounded-md border-0 bg-transparent px-1 py-1 text-sm outline-none"
              name="project-name"
              placeholder="项目名称"
              value={projectDraft}
              onChange={(event) => setProjectDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                event.preventDefault();
                void submitProject();
              }}
            />
            <button
              aria-label="确认新建项目"
              className="focus-ring rounded-md p-1 text-blue hover:bg-blue/10 disabled:text-muted"
              disabled={!projectDraft.trim()}
              type="submit"
            >
              <CheckCircle2 size={14} />
            </button>
            <button
              aria-label="取消新建项目"
              className="focus-ring rounded-md p-1 text-muted hover:bg-paper hover:text-ink"
              type="button"
              onClick={() => {
                setProjectDraft("");
                setCreatingProject(false);
              }}
            >
              <X size={14} />
            </button>
          </form>
        )}
        <div className="space-y-1">
          {projects.map((project) => {
            const selected = activeView === "project" && activeProjectId === project.id;
            const count = tasks.filter((task) => task.projectId === project.id && task.status === "open" && !task.deletedAt).length;
            const projectDropTarget = `project-${project.id}`;
            return (
              <div key={project.id}>
                <div
                  className={clsx(
                    "group flex items-center rounded-md transition-colors duration-200",
                    selected ? "bg-paper text-ink" : "text-muted hover:bg-paper hover:text-ink",
                    dragTarget === projectDropTarget && "bg-blue/10 text-blue ring-2 ring-blue/30"
                  )}
                >
                  <button
                    className="focus-ring flex min-w-0 flex-1 items-center justify-between rounded-md px-3 py-2 text-sm"
                    onDragLeave={() => setDragTarget(undefined)}
                    onDragOver={(event) => handleDragOver(event, projectDropTarget)}
                    onDrop={(event) => handleDropOnProject(event, project.id)}
                    onClick={() => setActiveView("project", project.id)}
                    title="拖任务到这里可快速加入项目"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", dotClass[project.color])} />
                      <span className="truncate">{project.name}</span>
                    </span>
                    <span className="text-xs">{count}</span>
                  </button>
                  <button
                    aria-label={`删除项目 ${project.name}`}
                    className="focus-ring mr-1 rounded-md p-1.5 text-muted opacity-70 transition hover:bg-coral/10 hover:text-coral group-hover:opacity-100"
                    onClick={() => {
                      setDeletingProjectId(project.id);
                      setDeleteProjectDraft("");
                    }}
                    title={`删除项目 ${project.name}`}
                    type="button"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {deletingProjectId === project.id && (
                  <div className="animate-enter mt-1 rounded-md border border-coral/20 bg-coral/5 p-2">
                    <p className="text-xs font-semibold text-coral">确认删除项目：{project.name}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">任务会保留，并自动移出这个项目。</p>
                    <input
                      aria-label="输入项目名确认删除"
                      className="focus-ring mt-2 w-full rounded-md border border-line bg-white px-2 py-1.5 text-xs text-ink"
                      name="delete-project-confirmation"
                      placeholder={project.name}
                      value={deleteProjectDraft}
                      onChange={(event) => setDeleteProjectDraft(event.target.value)}
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        aria-label="取消删除项目"
                        className="focus-ring flex-1 rounded-md border border-line bg-white px-2 py-1.5 text-xs font-semibold text-muted hover:text-ink"
                        type="button"
                        onClick={() => {
                          setDeletingProjectId(undefined);
                          setDeleteProjectDraft("");
                        }}
                      >
                        取消
                      </button>
                      <button
                        aria-label="永久删除项目"
                        className="focus-ring flex-1 rounded-md bg-coral px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                        disabled={deleteProjectDraft !== project.name}
                        type="button"
                        onClick={() => {
                          void deleteProject(project.id).then(() => {
                            setDeletingProjectId(undefined);
                            setDeleteProjectDraft("");
                          });
                        }}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-auto rounded-md border border-line bg-paper p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <Database size={14} />
          <span>数据工具</span>
        </div>
        <div className="space-y-2">
          <button
            aria-label="导出数据"
            className="focus-ring flex w-full items-center justify-center gap-2 rounded-md border border-blue/20 bg-white px-3 py-2 text-sm font-semibold text-blue transition-colors duration-200 hover:bg-blue/10"
            type="button"
            onClick={() => void handleExportData()}
          >
            <Download size={15} />
            导出数据
          </button>
          <input
            key={fileInputKey}
            aria-label="选择导入文件"
            className="sr-only"
            id="task-data-import-file"
            type="file"
            accept="application/json,.json"
            onChange={(event) => void handleImportFile(event.target.files?.[0])}
          />
          <label
            className="focus-ring flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink transition-colors duration-200 hover:bg-paper"
            htmlFor="task-data-import-file"
          >
            <Upload size={15} />
            导入数据
          </label>
          <button
            aria-label="清空所有数据"
            className="focus-ring flex w-full items-center justify-center gap-2 rounded-md border border-coral/20 bg-white px-3 py-2 text-sm font-semibold text-coral transition-colors duration-200 hover:bg-coral/10"
            type="button"
            onClick={() => {
              setConfirmingClearData(true);
              setClearDataDraft("");
              setDataToolMessage("");
              setPendingImport(undefined);
            }}
          >
            <Eraser size={15} />
            清空所有数据
          </button>
        </div>
        {pendingImport && (
          <div className="animate-enter mt-3 rounded-md border border-blue/20 bg-white p-2">
            <p className="truncate text-xs font-semibold text-ink">准备导入：{pendingImport.fileName}</p>
            <p className="mt-1 text-xs leading-5 text-muted">
              {pendingImport.snapshot.tasks.length} 个任务 / {pendingImport.snapshot.projects.length} 个项目 /{" "}
              {pendingImport.snapshot.sessions.length} 条专注记录
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">确认后会覆盖当前本地数据。</p>
            <div className="mt-2 flex gap-2">
              <button
                aria-label="取消导入数据"
                className="focus-ring flex-1 rounded-md border border-line bg-white px-2 py-1.5 text-xs font-semibold text-muted hover:text-ink"
                type="button"
                onClick={() => setPendingImport(undefined)}
              >
                取消
              </button>
              <button
                aria-label="确认导入数据"
                className="focus-ring flex-1 rounded-md bg-ink px-2 py-1.5 text-xs font-semibold text-white"
                type="button"
                onClick={() => void handleConfirmImport()}
              >
                导入
              </button>
            </div>
          </div>
        )}
        {confirmingClearData && (
          <div className="animate-enter mt-3 rounded-md border border-coral/20 bg-coral/5 p-2">
            <p className="text-xs font-semibold text-coral">确认清空所有本地数据</p>
            <p className="mt-1 text-xs leading-5 text-muted">任务、项目、标签和专注记录都会被删除。</p>
            <input
              aria-label="输入“清空”确认"
              className="focus-ring mt-2 w-full rounded-md border border-line bg-white px-2 py-1.5 text-xs text-ink"
              name="clear-data-confirmation"
              placeholder="清空"
              value={clearDataDraft}
              onChange={(event) => setClearDataDraft(event.target.value)}
            />
            <div className="mt-2 flex gap-2">
              <button
                aria-label="取消清空数据"
                className="focus-ring flex-1 rounded-md border border-line bg-white px-2 py-1.5 text-xs font-semibold text-muted hover:text-ink"
                type="button"
                onClick={() => {
                  setConfirmingClearData(false);
                  setClearDataDraft("");
                }}
              >
                取消
              </button>
              <button
                aria-label="确认清空所有数据"
                className="focus-ring flex-1 rounded-md bg-coral px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                disabled={clearDataDraft !== "清空"}
                type="button"
                onClick={() => void handleClearAllData()}
              >
                确认
              </button>
            </div>
          </div>
        )}
        {dataToolMessage && <p className="mt-2 text-xs font-medium text-muted">{dataToolMessage}</p>}
      </div>

      <div className="mt-3 rounded-md border border-line bg-paper p-3">
        <p className="text-xs font-semibold text-ink">V1 范围</p>
        <p className="mt-1 text-xs leading-5 text-muted">
          任务、计划、重复事项和番茄钟专注。无需账号，也不依赖云同步。
        </p>
      </div>
    </aside>
  );
}

function MainPanel() {
  const activeView = useTaskStore((state) => state.activeView);
  const activeProjectId = useTaskStore((state) => state.activeProjectId);
  const activeAreaId = useTaskStore((state) => state.activeAreaId);
  const projects = useTaskStore((state) => state.projects);
  const areas = useTaskStore((state) => state.areas);
  const tasks = useTaskStore((state) => state.tasks);
  const today = useTaskStore((state) => state.today);
  const [upcomingMode, setUpcomingMode] = useState<UpcomingMode>("list");
  const [projectMode, setProjectMode] = useState<ProjectMode>("list");

  const activeProject = projects.find((project) => project.id === activeProjectId);
  const activeArea = areas.find((area) => area.id === activeAreaId);
  const title =
    activeView === "project"
      ? activeProject?.name ?? "项目"
      : activeView === "area"
        ? activeArea?.name ?? "领域"
        : viewLabel[activeView];
  const tip =
    activeView === "project" && activeProject
      ? `项目“${activeProject.name}”里的任务。拖任务到左侧项目即可快速归类；项目不会改变计划日期。`
      : activeView === "area" && activeArea
        ? `领域“${activeArea.name}”是长期责任区。可以把任务或项目放进来，不必立即安排日期。`
      : viewTips[activeView];
  const visibleTasks =
    activeView === "project"
      ? activeProjectId
        ? filterTasksForView(tasks, { type: "project", today, projectId: activeProjectId })
        : []
      : activeView === "area"
        ? activeAreaId
          ? filterTasksForView(tasks, { type: "area", today, areaId: activeAreaId })
          : []
      : filterTasksForView(tasks, { type: activeView, today });
  const transitionKey =
    activeView === "project"
      ? `project-${activeProjectId ?? "none"}`
      : activeView === "area"
        ? `area-${activeAreaId ?? "none"}`
        : activeView;

  return (
    <div
      key={transitionKey}
      className="animate-main-panel-switch flex h-full min-h-[calc(100vh-2rem)] flex-col"
      data-testid="main-panel-transition"
      data-transition-key={transitionKey}
    >
      <header className="border-b border-line px-5 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue">今日工作台</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-normal">{title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{tip}</p>
          </div>
          <QuickAdd />
        </div>
        {activeView === "upcoming" && <UpcomingModeSwitch mode={upcomingMode} onChange={setUpcomingMode} />}
        {activeView === "project" && (
          <ProjectModeSwitch mode={projectMode} onChange={setProjectMode} />
        )}
        <StatsBar visibleTasks={visibleTasks} />
      </header>

      <div className="space-y-4 overflow-y-auto px-5 py-4">
        {activeView === "upcoming" && upcomingMode === "week" ? (
          <WeekPlanner />
        ) : activeView === "upcoming" && upcomingMode === "month" ? (
          <MonthPlanner />
        ) : activeView === "project" && activeProjectId ? (
          <ProjectTasksView projectId={activeProjectId} tasks={visibleTasks} mode={projectMode} />
        ) : (
          <>
            <WeekStrip />
            <TaskList tasks={visibleTasks} />
          </>
        )}
      </div>
    </div>
  );
}

function QuickAdd() {
  const [title, setTitle] = useState("");
  const activeView = useTaskStore((state) => state.activeView);
  const activeProjectId = useTaskStore((state) => state.activeProjectId);
  const activeAreaId = useTaskStore((state) => state.activeAreaId);
  const projects = useTaskStore((state) => state.projects);
  const tags = useTaskStore((state) => state.tags);
  const today = useTaskStore((state) => state.today);
  const addTask = useTaskStore((state) => state.addTask);
  const addProject = useTaskStore((state) => state.addProject);
  const addTag = useTaskStore((state) => state.addTag);
  const tomorrow = addDays(today, 1);
  const parsed = useMemo(() => parseQuickAdd(title, today), [title, today]);

  const getQuickAddOptions = (quick: QuickAddParseResult): Partial<Task> => {
    if (activeView === "inbox") return { list: "inbox", pomodoroEstimate: 1 };
    if (activeView === "anytime") return { list: "anytime", pomodoroEstimate: 1 };
    if (activeView === "someday") return { someday: true, pomodoroEstimate: 1 };
    if (activeView === "deadlines") return { dueDate: tomorrow, list: "anytime", pomodoroEstimate: 1 };
    if (activeView === "project") return { projectId: activeProjectId, list: "anytime", pomodoroEstimate: 1 };
    if (activeView === "area") return { areaId: activeAreaId, list: "anytime", pomodoroEstimate: 1 };
    if (activeView === "upcoming") return { scheduledDate: tomorrow, pomodoroEstimate: 1 };
    return { scheduledDate: quick.scheduledDate ?? today, pomodoroEstimate: 1 };
  };

  const handleSubmit = async () => {
    const quick = parseQuickAdd(title, today);
    if (!quick.title) return;

    const project =
      quick.projectName
        ? projects.find((item) => item.name.toLowerCase() === quick.projectName?.toLowerCase()) ??
          (await addProject(quick.projectName, { activate: false }))
        : undefined;
    const createdTags = await Promise.all(
      quick.tagNames.map(async (tagName) => {
        const existing = tags.find((tag) => tag.name.toLowerCase() === tagName.toLowerCase());
        return existing ?? (await addTag(tagName));
      })
    );
    const defaultOptions = getQuickAddOptions(quick);
    const explicitOptions: Partial<Task> = {
      ...(quick.clearDate ? { scheduledDate: undefined } : {}),
      ...(quick.scheduledDate ? { scheduledDate: quick.scheduledDate } : {}),
      ...(quick.someday ? { someday: true, list: undefined } : {}),
      ...(quick.repeatRule ? { repeatRule: quick.repeatRule } : {}),
      ...(quick.priority !== "none" ? { priority: quick.priority } : {}),
      ...(project ? { projectId: project.id, areaId: project.areaId } : {}),
      ...(createdTags.length > 0 ? { tagIds: createdTags.flatMap((tag) => (tag ? [tag.id] : [])) } : {})
    };

    await addTask(quick.title, { ...defaultOptions, ...explicitOptions });
    setTitle("");
  };

  const placeholder =
    activeView === "inbox"
      ? "先收集一个想法..."
      : activeView === "anytime"
        ? "添加随时可做的任务..."
        : activeView === "someday"
          ? "添加将来也许会做的事..."
          : activeView === "upcoming"
            ? "添加明天或未来的计划..."
            : "添加今天要做的任务...";

  return (
    <form
      className="w-full max-w-md rounded-md border border-line bg-white p-2 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <div className="flex items-center gap-2">
        <Plus size={17} className="text-blue" />
        <input
          className="focus-ring min-w-0 flex-1 rounded-md border-0 bg-transparent px-1 py-1 text-sm outline-none"
          name="quick-add-title"
          placeholder={placeholder}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button className="rounded-md bg-blue px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-blue/90" type="submit">
          添加
        </button>
      </div>
      <QuickAddPreview parsed={parsed} />
    </form>
  );
}

function QuickAddPreview({ parsed }: { parsed: QuickAddParseResult }) {
  const chips: string[] = [];
  if (parsed.projectName) chips.push(`项目 ${parsed.projectName}`);
  parsed.tagNames.forEach((tagName) => chips.push(`标签 ${tagName}`));
  if (parsed.priority === "high") chips.push("高优先级");
  if (parsed.priority === "medium") chips.push("中优先级");
  if (parsed.priority === "low") chips.push("低优先级");
  if (parsed.scheduledDate) chips.push(`计划 ${formatMonthDay(parsed.scheduledDate)}`);
  if (parsed.someday) chips.push("放到将来");
  if (parsed.clearDate && !parsed.someday) chips.push("无日期");
  if (parsed.repeatRule) chips.push(repeatLabel(parsed.repeatRule));

  if (chips.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <span key={chip} className="rounded-md border border-blue/15 bg-blue/5 px-2 py-1 text-[11px] font-semibold text-blue">
          {chip}
        </span>
      ))}
    </div>
  );
}

function StatsBar({ visibleTasks }: { visibleTasks: Task[] }) {
  const tasks = useTaskStore((state) => state.tasks);
  const sessions = useTaskStore((state) => state.sessions);
  const today = useTaskStore((state) => state.today);
  const completedToday = countTodayCompleted(tasks, today);
  const focusMinutes = sessions
    .filter((session) => session.status === "completed" && session.startedAt.startsWith(today))
    .reduce((total, session) => total + session.plannedMinutes, 0);

  const stats = [
    { label: "个计划中", value: visibleTasks.length, color: "blue" as ColorToken },
    { label: "个今日完成", value: completedToday, color: "teal" as ColorToken },
    { label: "分钟专注", value: focusMinutes, color: "focus" as ColorToken }
  ];

  return (
    <div className="mt-4 grid grid-cols-3 gap-2">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={clsx(
            "rounded-md border px-3 py-2 transition-colors duration-200",
            colorClass[stat.color]
          )}
        >
          <div className="text-lg font-semibold">
            {stat.value} {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function UpcomingModeSwitch({
  mode,
  onChange
}: {
  mode: UpcomingMode;
  onChange(mode: UpcomingMode): void;
}) {
  const modes: Array<{ value: UpcomingMode; label: string }> = [
    { value: "list", label: "列表" },
    { value: "week", label: "周" },
    { value: "month", label: "月" }
  ];

  return (
    <div className="mt-4 inline-flex rounded-md border border-line bg-white p-1 shadow-sm" aria-label="未来计划视图">
      {modes.map((item) => (
        <button
          key={item.value}
          className={clsx(
            "focus-ring rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-200",
            mode === item.value ? "bg-ink text-white shadow-sm" : "text-muted hover:bg-paper hover:text-ink"
          )}
          type="button"
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function ProjectModeSwitch({
  mode,
  onChange
}: {
  mode: ProjectMode;
  onChange(mode: ProjectMode): void;
}) {
  const modes: Array<{ value: ProjectMode; label: string }> = [
    { value: "list", label: "列表" },
    { value: "board", label: "看板" }
  ];

  return (
    <div className="mt-4 inline-flex rounded-md border border-line bg-white p-1 shadow-sm" aria-label="项目视图">
      {modes.map((item) => (
        <button
          key={item.value}
          aria-label={item.label}
          className={clsx(
            "focus-ring rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-200",
            mode === item.value ? "bg-ink text-white shadow-sm" : "text-muted hover:bg-paper hover:text-ink"
          )}
          type="button"
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function ProjectTasksView({
  projectId,
  tasks,
  mode
}: {
  projectId: string;
  tasks: Task[];
  mode: ProjectMode;
}) {
  const sections = useTaskStore((state) => state.sections).filter((section) => section.projectId === projectId && !section.archived);
  const addSection = useTaskStore((state) => state.addSection);
  const updateSection = useTaskStore((state) => state.updateSection);
  const deleteSection = useTaskStore((state) => state.deleteSection);
  const updateTask = useTaskStore((state) => state.updateTask);
  const [sectionDraft, setSectionDraft] = useState("");
  const [editingSectionId, setEditingSectionId] = useState<string>();
  const [editingSectionName, setEditingSectionName] = useState("");
  const [deletingSection, setDeletingSection] = useState<ProjectSection>();
  const [deleteSectionDraft, setDeleteSectionDraft] = useState("");
  const [dragTarget, setDragTarget] = useState<string>();
  const orderedSections = [...sections].sort((left, right) => left.sortOrder - right.sortOrder);
  const columns: Array<ProjectSection | undefined> = [undefined, ...orderedSections];

  const submitSection = async () => {
    const trimmed = sectionDraft.trim();
    if (!trimmed) return;
    await addSection(projectId, trimmed);
    setSectionDraft("");
  };

  const startEditingSection = (section: ProjectSection) => {
    setEditingSectionId(section.id);
    setEditingSectionName(section.name);
  };

  const submitSectionRename = async (section: ProjectSection) => {
    const trimmed = editingSectionName.trim();
    if (!trimmed) return;
    await updateSection(section.id, { name: trimmed });
    setEditingSectionId(undefined);
    setEditingSectionName("");
  };

  const startDeletingSection = (section: ProjectSection) => {
    setDeletingSection(section);
    setDeleteSectionDraft("");
  };

  const confirmSectionDelete = async () => {
    if (!deletingSection || deleteSectionDraft.trim() !== deletingSection.name) return;
    await deleteSection(deletingSection.id);
    setDeletingSection(undefined);
    setDeleteSectionDraft("");
  };

  const handleDropOnSection = (event: DragEvent<HTMLElement>, sectionId?: string) => {
    event.preventDefault();
    setDragTarget(undefined);
    const taskId = getDraggedTaskId(event);
    if (!taskId) return;
    void updateTask(taskId, { sectionId });
  };

  const renderColumn = (section: ProjectSection | undefined, board = false) => {
    const sectionTasks = tasks.filter((task) => (section ? task.sectionId === section.id : !task.sectionId));
    const target = section?.id ?? "none";
    return (
      <section
        key={target}
        className={clsx(
          board ? "soft-panel min-w-[220px] flex-1 p-3" : "rounded-md border border-line/70 bg-white p-3",
          dragTarget === target && "ring-2 ring-blue/25"
        )}
        onDragLeave={() => setDragTarget(undefined)}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setDragTarget(target);
        }}
        onDrop={(event) => handleDropOnSection(event, section?.id)}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          {section && editingSectionId === section.id ? (
            <form
              className="flex min-w-0 flex-1 items-center gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                void submitSectionRename(section);
              }}
            >
              <input
                aria-label={`阶段名称 ${section.name}`}
                className="focus-ring min-w-0 flex-1 rounded-md border border-line bg-white px-2 py-1 text-sm font-semibold"
                value={editingSectionName}
                onChange={(event) => setEditingSectionName(event.target.value)}
              />
              <button
                aria-label={`保存阶段 ${section.name}`}
                className="focus-ring inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-200 hover:bg-teal/10 hover:text-teal disabled:opacity-45"
                disabled={!editingSectionName.trim()}
                type="submit"
              >
                <Check size={15} />
              </button>
              <button
                aria-label={`取消编辑阶段 ${section.name}`}
                className="focus-ring inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-200 hover:bg-paper hover:text-ink"
                type="button"
                onClick={() => {
                  setEditingSectionId(undefined);
                  setEditingSectionName("");
                }}
              >
                <X size={14} />
              </button>
            </form>
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-sm font-semibold">{section?.name ?? "未分组"}</h3>
              {section && (
                <div className="flex items-center gap-1 opacity-80">
                  <button
                    aria-label={`编辑阶段 ${section.name}`}
                    className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors duration-200 hover:bg-blue/10 hover:text-blue"
                    type="button"
                    onClick={() => startEditingSection(section)}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    aria-label={`删除阶段 ${section.name}`}
                    className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors duration-200 hover:bg-coral/10 hover:text-coral"
                    type="button"
                    onClick={() => startDeletingSection(section)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
          <span className="shrink-0 rounded-md bg-paper px-2 py-1 text-xs font-semibold text-muted">{sectionTasks.length}</span>
        </div>
        {sectionTasks.length > 0 ? (
          <div className="space-y-2">
            {sectionTasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-line bg-paper/70 px-3 py-6 text-center text-xs text-muted">
            拖任务到这里
          </p>
        )}
      </section>
    );
  };

  return (
    <div className="space-y-4">
      <form
        className="soft-panel flex max-w-sm items-center gap-2 p-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submitSection();
        }}
      >
        <FolderKanban size={15} className="text-blue" />
        <input
          aria-label="新建项目阶段"
          className="focus-ring min-w-0 flex-1 rounded-md border-0 bg-transparent px-1 py-1 text-sm outline-none"
          name="project-section"
          placeholder="新建阶段"
          value={sectionDraft}
          onChange={(event) => setSectionDraft(event.target.value)}
        />
        <button
          aria-label="添加项目阶段"
          className="rounded-md bg-blue px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-45"
          disabled={!sectionDraft.trim()}
          type="submit"
        >
          添加
        </button>
      </form>
      {deletingSection && (
        <div className="animate-settings-reveal max-w-sm rounded-md border border-coral/20 bg-coral/5 p-3 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-coral">确认删除阶段：{deletingSection.name}</p>
              <p className="mt-1 text-xs leading-5 text-muted">阶段会被删除，里面的任务会移动到未分组。</p>
            </div>
            <button
              aria-label="取消删除阶段"
              className="focus-ring rounded-md p-1 text-muted hover:bg-white hover:text-ink"
              type="button"
              onClick={() => {
                setDeletingSection(undefined);
                setDeleteSectionDraft("");
              }}
            >
              <X size={15} />
            </button>
          </div>
          <label className="mt-3 block text-xs font-semibold text-muted">
            输入阶段名确认删除
            <input
              aria-label="输入阶段名确认删除"
              className="form-control mt-1"
              value={deleteSectionDraft}
              onChange={(event) => setDeleteSectionDraft(event.target.value)}
            />
          </label>
          <button
            aria-label="确认删除阶段"
            className="focus-ring mt-3 rounded-md bg-coral px-3 py-2 text-xs font-semibold text-white transition-opacity duration-200 disabled:opacity-45"
            disabled={deleteSectionDraft.trim() !== deletingSection.name}
            type="button"
            onClick={() => void confirmSectionDelete()}
          >
            删除阶段
          </button>
        </div>
      )}
      {mode === "board" ? (
        <div className="flex gap-3 overflow-x-auto pb-2" data-testid="project-board-view">
          {columns.map((section) => renderColumn(section, true))}
        </div>
      ) : (
        <div className="space-y-3" data-testid="project-list-view">
          {columns.map((section) => renderColumn(section))}
        </div>
      )}
    </div>
  );
}

function WeekStrip() {
  const tasks = useTaskStore((state) => state.tasks);
  const today = useTaskStore((state) => state.today);
  const week = buildWeekPlan(tasks, today);

  return (
    <section className="soft-panel grid grid-cols-7 gap-1 p-2">
      {week.map((day, index) => (
        <div
          key={day.date}
          className={clsx(
            "rounded-md px-2 py-3 text-center",
            index === 0 ? "bg-blue text-white" : "bg-white text-ink"
          )}
        >
          <p className={clsx("text-xs", index === 0 ? "text-white/75" : "text-muted")}>
            {formatShortWeekday(day.date)}
          </p>
          <p className="mt-1 text-sm font-semibold">{formatMonthDay(day.date)}</p>
          <p className={clsx("mt-2 text-xs", index === 0 ? "text-white/80" : "text-muted")}>
            {day.openCount} 个任务
          </p>
        </div>
      ))}
    </section>
  );
}

function WeekPlanner() {
  const tasks = useTaskStore((state) => state.tasks);
  const today = useTaskStore((state) => state.today);
  const updateTask = useTaskStore((state) => state.updateTask);
  const [dragTarget, setDragTarget] = useState<string>();
  const week = buildWeekPlan(tasks, today);

  return (
    <section className="grid gap-3 md:grid-cols-7" data-testid="upcoming-week-view">
      {week.map((day, index) => (
        <div
          key={day.date}
          className={clsx(
            "soft-panel min-h-40 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue/25",
            index === 0 && "border-blue/30 bg-blue/5",
            dragTarget === day.date && "ring-2 ring-blue/25"
          )}
          onDragLeave={() => setDragTarget(undefined)}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setDragTarget(day.date);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragTarget(undefined);
            const taskId = getDraggedTaskId(event);
            if (!taskId) return;
            void updateTask(taskId, { scheduledDate: day.date, someday: false, list: undefined });
          }}
        >
          <p className="text-xs font-semibold text-muted">{formatShortWeekday(day.date)}</p>
          <h3 className="mt-1 text-sm font-semibold">{formatMonthDay(day.date)}</h3>
          <div className="mt-4 space-y-2 text-xs">
            <p className="flex items-center justify-between rounded-md bg-white px-2 py-1.5">
              <span className="text-muted">计划</span>
              <span className="font-semibold text-blue">{day.openCount}</span>
            </p>
            <p className="flex items-center justify-between rounded-md bg-white px-2 py-1.5">
              <span className="text-muted">截止</span>
              <span className="font-semibold text-coral">{day.deadlineCount}</span>
            </p>
            <p className="flex items-center justify-between rounded-md bg-white px-2 py-1.5">
              <span className="text-muted">完成</span>
              <span className="font-semibold text-teal">{day.completedCount}</span>
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}

function MonthPlanner() {
  const tasks = useTaskStore((state) => state.tasks);
  const today = useTaskStore((state) => state.today);
  const updateTask = useTaskStore((state) => state.updateTask);
  const [dragTarget, setDragTarget] = useState<string>();
  const month = buildMonthPlan(tasks, today);
  const weekdays = ["一", "二", "三", "四", "五", "六", "日"];

  return (
    <section className="soft-panel p-3" data-testid="upcoming-month-view">
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted">
        {weekdays.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {month.map((day) => {
          const active = day.date === today;
          const hasWork = day.openCount > 0 || day.deadlineCount > 0;
          return (
            <div
              key={day.date}
              className={clsx(
                "min-h-20 rounded-md border p-2 transition-all duration-200",
                day.inCurrentMonth ? "border-line bg-white" : "border-transparent bg-paper/70 text-muted",
                active && "border-blue/40 bg-blue/5",
                hasWork && "hover:-translate-y-0.5 hover:border-blue/25",
                dragTarget === day.date && "ring-2 ring-blue/25"
              )}
              onDragLeave={() => setDragTarget(undefined)}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDragTarget(day.date);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragTarget(undefined);
                const taskId = getDraggedTaskId(event);
                if (!taskId) return;
                void updateTask(taskId, { scheduledDate: day.date, someday: false, list: undefined });
              }}
            >
              <div className="flex items-center justify-between">
                <span className={clsx("text-xs font-semibold", active ? "text-blue" : "text-muted")}>
                  {day.date.slice(8)}
                </span>
                {hasWork && <span className="h-1.5 w-1.5 rounded-full bg-blue" />}
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {day.openCount > 0 && (
                  <span className="rounded-sm bg-blue/10 px-1.5 py-0.5 text-[11px] font-semibold text-blue">
                    {day.openCount}
                  </span>
                )}
                {day.deadlineCount > 0 && (
                  <span className="rounded-sm bg-coral/10 px-1.5 py-0.5 text-[11px] font-semibold text-coral">
                    截 {day.deadlineCount}
                  </span>
                )}
                {day.completedCount > 0 && (
                  <span className="rounded-sm bg-teal/10 px-1.5 py-0.5 text-[11px] font-semibold text-teal">
                    完 {day.completedCount}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TaskList({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return (
      <div className="soft-panel flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
        <CheckCircle2 className="text-teal" size={34} />
        <h3 className="mt-3 text-base font-semibold">这里没有任务</h3>
        <p className="mt-1 max-w-sm text-sm leading-6 text-muted">
          添加一个任务，或切换视图继续安排计划。
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-2">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} />
      ))}
    </section>
  );
}

function TaskRow({ task }: { task: Task }) {
  const selectedTaskId = useTaskStore((state) => state.selectedTaskId);
  const projects = useTaskStore((state) => state.projects);
  const areas = useTaskStore((state) => state.areas);
  const sections = useTaskStore((state) => state.sections);
  const tags = useTaskStore((state) => state.tags);
  const selectTask = useTaskStore((state) => state.selectTask);
  const toggleTask = useTaskStore((state) => state.toggleTask);
  const updateTask = useTaskStore((state) => state.updateTask);
  const project = projects.find((item) => item.id === task.projectId);
  const area = areas.find((item) => item.id === task.areaId);
  const section = sections.find((item) => item.id === task.sectionId);
  const selectedTags = tags.filter((tag) => task.tagIds.includes(tag.id));
  const selected = selectedTaskId === task.id;
  const completed = task.status === "completed";
  const deleted = Boolean(task.deletedAt);
  const openTaskDetails = useTaskStore((state) => state.openTaskDetails);
  const actionLabel = deleted || completed ? "恢复" : "完成";
  const rowLabel = [
    task.title,
    task.scheduledDate ? formatMonthDay(task.scheduledDate) : undefined,
    project?.name,
    ...selectedTags.map((tag) => tag.name),
    task.priority !== "none" ? priorityLabel[task.priority] : undefined
  ]
    .filter(Boolean)
    .join(" ");
  const hasMetadata =
    Boolean(task.scheduledDate) ||
    Boolean(task.dueDate && task.dueDate !== task.scheduledDate) ||
    Boolean(area) ||
    Boolean(project) ||
    Boolean(section) ||
    selectedTags.length > 0 ||
    task.priority !== "none" ||
    task.checklistItems.length > 0;
  const handlePrimaryAction = () => {
    if (deleted) {
      void updateTask(task.id, { deletedAt: undefined });
      return;
    }
    void toggleTask(task.id);
  };

  return (
    <article
      data-testid={`task-row-${task.id}`}
      draggable={!completed && !deleted}
      className={clsx(
        "soft-panel animate-enter flex items-center gap-3 p-3 transition-colors duration-200 hover:border-blue/25 hover:bg-white",
        !completed && !deleted && "cursor-grab active:cursor-grabbing",
        selected && "border-blue/35 bg-blue/5"
      )}
      onDragStart={(event) => {
        if (completed || deleted) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(TASK_DRAG_TYPE, task.id);
        event.dataTransfer.setData("text/plain", task.id);
      }}
    >
      <button
        aria-label={`${actionLabel} ${task.title}`}
        className="focus-ring flex h-5 w-5 shrink-0 items-center justify-center text-muted transition-transform duration-200 hover:scale-110 hover:text-teal"
        onClick={handlePrimaryAction}
      >
        {completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
      </button>
      <button aria-label={rowLabel} className="min-w-0 flex-1 text-left" onClick={() => selectTask(task.id)}>
        <div className="flex min-h-5 flex-wrap items-center gap-2">
          <h3 className={clsx("truncate text-sm font-semibold", completed && "text-muted line-through")}>
            {task.title}
          </h3>
          {task.repeatRule && (
            <span className="inline-flex items-center gap-1 rounded-md border border-violet/20 bg-violet/10 px-2 py-0.5 text-[11px] font-medium text-violet">
              <span aria-hidden="true">🔁</span>
              {repeatLabel(task.repeatRule)}
            </span>
          )}
        </div>
        {hasMetadata && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            {task.scheduledDate && (
              <span className="inline-flex items-center gap-1 rounded-md border border-line bg-paper px-2 py-1">
                <span aria-hidden="true">🗓️</span>
                {formatMonthDay(task.scheduledDate)}
              </span>
            )}
            {task.dueDate && task.dueDate !== task.scheduledDate && (
              <span className="inline-flex items-center gap-1 rounded-md border border-coral/20 bg-coral/10 px-2 py-1 text-coral">
                <span aria-hidden="true">🚩</span>
                {formatMonthDay(task.dueDate)}
              </span>
            )}
            {project && (
              <span className={clsx("inline-flex items-center gap-1 rounded-md border px-2 py-1", colorClass[project.color])}>
                <span className={clsx("h-1.5 w-1.5 rounded-full", dotClass[project.color])} />
                {project.name}
              </span>
            )}
            {area && !project && (
              <span className={clsx("inline-flex items-center gap-1 rounded-md border px-2 py-1", colorClass[area.color])}>
                <span aria-hidden="true">🧭</span>
                {area.name}
              </span>
            )}
            {section && (
              <span className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1">
                {section.name}
              </span>
            )}
            {selectedTags.map((tag) => (
              <span key={tag.id} className={clsx("rounded-md border px-2 py-1", colorClass[tag.color])}>
                {tag.name}
              </span>
            ))}
            {task.checklistItems.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md border border-teal/20 bg-teal/10 px-2 py-1 text-teal">
                {task.checklistItems.filter((item) => item.completed).length}/{task.checklistItems.length}
              </span>
            )}
            {task.priority !== "none" && (
              <span className={clsx("inline-flex items-center gap-1 rounded-md border px-2 py-1", priorityClass[task.priority])}>
                <span aria-hidden="true">🚩</span>
                {priorityLabel[task.priority]}
              </span>
            )}
          </div>
        )}
      </button>
      <button
        aria-label={`打开任务详情 ${task.title}`}
        className="focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-all duration-200 hover:bg-blue/10 hover:text-blue"
        type="button"
        onClick={() => openTaskDetails(task.id)}
      >
        <ChevronRight size={17} />
      </button>
    </article>
  );
}

function RightPanel() {
  return (
    <div className="flex h-full min-h-[calc(100vh-2rem)] flex-col overflow-y-auto">
      <TodayRhythmPanel />
      <PomodoroPanel />
    </div>
  );
}

function TodayRhythmPanel() {
  const tasks = useTaskStore((state) => state.tasks);
  const sessions = useTaskStore((state) => state.sessions);
  const today = useTaskStore((state) => state.today);
  const openUsageManual = useTaskStore((state) => state.openUsageManual);
  const todayTasks = filterTasksForView(tasks, { type: "today", today });
  const completedToday = countTodayCompleted(tasks, today);
  const overdueCount = todayTasks.filter((task) => task.scheduledDate && task.scheduledDate < today).length;
  const focusMinutes = sessions
    .filter((session) => session.status === "completed" && session.endedAt?.startsWith(today))
    .reduce((sum, session) => sum + session.plannedMinutes, 0);
  const nextTask = todayTasks.find((task) => task.status === "open");

  return (
    <section className="animate-panel-soft border-b border-line p-5" data-testid="today-rhythm-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue">今日节奏</p>
          <h2 className="mt-1 text-lg font-semibold">先做清楚的一件事</h2>
        </div>
        <button
          aria-label="打开使用手册"
          className="focus-ring inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-white text-muted shadow-sm transition-all duration-200 hover:border-blue/30 hover:text-blue"
          type="button"
          onClick={openUsageManual}
        >
          <BookOpen size={17} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-md border border-blue/15 bg-blue/5 px-3 py-2.5">
          <p className="text-[11px] font-semibold text-blue">今日任务</p>
          <p className="mt-1 text-xl font-semibold">{todayTasks.length}</p>
        </div>
        <div className="rounded-md border border-teal/15 bg-teal/5 px-3 py-2.5">
          <p className="text-[11px] font-semibold text-teal">已完成</p>
          <p className="mt-1 text-xl font-semibold">{completedToday}</p>
        </div>
        <div className="rounded-md border border-coral/15 bg-coral/5 px-3 py-2.5">
          <p className="text-[11px] font-semibold text-coral">延期</p>
          <p className="mt-1 text-xl font-semibold">{overdueCount}</p>
        </div>
        <div className="rounded-md border border-focus/15 bg-focus/5 px-3 py-2.5">
          <p className="text-[11px] font-semibold text-focus">专注分钟</p>
          <p className="mt-1 text-xl font-semibold">{focusMinutes}</p>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-line bg-paper/75 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted">
          <Clock3 size={14} />
          下一步
        </div>
        <p className="mt-2 truncate text-sm font-semibold text-ink">
          {nextTask ? `下一步：${nextTask.title}` : "今天暂时没有待办"}
        </p>
        <p className="mt-1 text-xs leading-5 text-muted">
          任务详情只在点击任务右侧箭头时打开；普通使用时，写下标题就可以开始。
        </p>
      </div>
    </section>
  );
}

function InlineCreateForm({
  icon,
  label,
  placeholder,
  value,
  disabled = false,
  onChange,
  onSubmit
}: {
  icon: ReactNode;
  label: string;
  placeholder: string;
  value: string;
  disabled?: boolean;
  onChange(value: string): void;
  onSubmit(): void;
}) {
  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="min-w-0 flex-1">
        <span className="sr-only">{label}</span>
        <div className="relative">
          <span className="form-icon flex h-4 w-4 items-center justify-center text-muted" aria-hidden="true">
            {icon}
          </span>
          <input
            aria-label={label}
            className="form-control with-left-icon"
            disabled={disabled}
            name={label}
            placeholder={placeholder}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      </label>
      <button
        aria-label={`创建${label.replace("新建", "")}`}
        className="focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-white text-muted transition-all duration-200 hover:border-blue/30 hover:text-blue disabled:cursor-not-allowed disabled:opacity-45"
        disabled={disabled || !value.trim()}
        type="submit"
      >
        <Plus size={16} />
      </button>
    </form>
  );
}

function MarkdownPreview({ value }: { value: string }) {
  const lines = value.split(/\r?\n/).filter((line) => line.trim().length > 0);

  return (
    <div className="space-y-1.5">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("### ")) {
          return <h4 key={`${trimmed}-${index}`} className="text-sm font-semibold">{trimmed.slice(4)}</h4>;
        }
        if (trimmed.startsWith("## ")) {
          return <h3 key={`${trimmed}-${index}`} className="text-base font-semibold">{trimmed.slice(3)}</h3>;
        }
        if (trimmed.startsWith("# ")) {
          return <h2 key={`${trimmed}-${index}`} className="text-lg font-semibold">{trimmed.slice(2)}</h2>;
        }
        if (trimmed.startsWith("- ")) {
          return <p key={`${trimmed}-${index}`} className="pl-2 text-muted">• {trimmed.slice(2)}</p>;
        }
        return <p key={`${trimmed}-${index}`}>{trimmed}</p>;
      })}
    </div>
  );
}

function TaskDetailsDrawer() {
  const tasks = useTaskStore((state) => state.tasks);
  const detailsTaskId = useTaskStore((state) => state.detailsTaskId);
  const taskDetailsOpen = useTaskStore((state) => state.taskDetailsOpen);
  const closeTaskDetails = useTaskStore((state) => state.closeTaskDetails);
  const task = tasks.find((item) => item.id === detailsTaskId);

  useEffect(() => {
    if (!taskDetailsOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeTaskDetails();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeTaskDetails, taskDetailsOpen]);

  if (!taskDetailsOpen || !task) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-ink/20 backdrop-blur-[2px]"
      onClick={closeTaskDetails}
    >
      <aside
        className="animate-drawer-in h-full w-full max-w-[460px] overflow-y-auto border-l border-line bg-white shadow-[0_20px_60px_rgba(25,32,42,0.18)]"
        data-testid="task-details-drawer"
        onClick={(event) => event.stopPropagation()}
      >
        <TaskDetails key={task.id} task={task} onClose={closeTaskDetails} />
      </aside>
    </div>
  );
}

function UsageManualDrawer() {
  const usageManualOpen = useTaskStore((state) => state.usageManualOpen);
  const closeUsageManual = useTaskStore((state) => state.closeUsageManual);

  useEffect(() => {
    if (!usageManualOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeUsageManual();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeUsageManual, usageManualOpen]);

  if (!usageManualOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-ink/20 backdrop-blur-[2px]"
      onClick={closeUsageManual}
    >
      <aside
        className="animate-drawer-in h-full w-full max-w-[460px] overflow-y-auto border-l border-line bg-white p-5 shadow-[0_20px_60px_rgba(25,32,42,0.18)]"
        data-testid="usage-manual-drawer"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue">使用手册</p>
            <h2 className="mt-1 text-xl font-semibold">先收集，再安排，再回顾</h2>
          </div>
          <button
            aria-label="关闭使用手册"
            className="focus-ring rounded-md p-2 text-muted transition-colors duration-200 hover:bg-paper hover:text-ink"
            type="button"
            onClick={closeUsageManual}
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 space-y-3 text-sm leading-6 text-muted">
          <section className="rounded-md border border-line bg-paper/70 p-3">
            <h3 className="text-sm font-semibold text-ink">1. 只写标题也完全可以</h3>
            <p className="mt-1">收集箱用于暂存想法；今日用于执行；未来计划用于安排日期；随时和将来用于降低今日压力。</p>
          </section>
          <section className="rounded-md border border-line bg-white p-3">
            <h3 className="text-sm font-semibold text-ink">2. 需要组织时再打开详情</h3>
            <p className="mt-1">点击任务右侧箭头，才进入项目、标签、日期、重复和更多设置。任务行主体只是选中，不会打断你继续看列表。</p>
          </section>
          <section className="rounded-md border border-line bg-white p-3">
            <h3 className="text-sm font-semibold text-ink">3. 项目先够用，领域和阶段以后再用</h3>
            <p className="mt-1">领域和阶段是进阶能力，不是开始使用 Todo 的前提。</p>
          </section>
          <section className="rounded-md border border-line bg-white p-3">
            <h3 className="text-sm font-semibold text-ink">4. 专注独立记录</h3>
            <p className="mt-1">番茄钟不强制绑定任务。你可以先开一个专注时段，再决定是否补充任务信息。</p>
          </section>
        </div>
      </aside>
    </div>
  );
}

function TaskDetails({ task, onClose }: { task?: Task; onClose?: () => void }) {
  const projects = useTaskStore((state) => state.projects);
  const areas = useTaskStore((state) => state.areas);
  const sections = useTaskStore((state) => state.sections);
  const tags = useTaskStore((state) => state.tags);
  const today = useTaskStore((state) => state.today);
  const updateTask = useTaskStore((state) => state.updateTask);
  const deleteTask = useTaskStore((state) => state.deleteTask);
  const addProject = useTaskStore((state) => state.addProject);
  const addArea = useTaskStore((state) => state.addArea);
  const addSection = useTaskStore((state) => state.addSection);
  const addTag = useTaskStore((state) => state.addTag);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [areaDraft, setAreaDraft] = useState("");
  const [projectDraft, setProjectDraft] = useState("");
  const [sectionDraft, setSectionDraft] = useState("");
  const [checklistDraft, setChecklistDraft] = useState("");
  const selectedTaskId = task?.id;

  useEffect(() => {
    setShowAdvanced(false);
    setTagDraft("");
    setAreaDraft("");
    setProjectDraft("");
    setSectionDraft("");
    setChecklistDraft("");
  }, [selectedTaskId]);

  if (!task) {
    return (
      <section className="animate-panel-soft border-b border-line p-5" data-testid="task-details-panel">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">任务详情</p>
        <h2 className="mt-2 text-lg font-semibold">选择一个任务</h2>
        <p className="mt-2 text-sm leading-6 text-muted">选择任意任务后，可以编辑标题、安排和备注。</p>
      </section>
    );
  }

  const handleTagCreate = () => {
    const name = tagDraft.trim();
    if (!name) return;

    void addTag(name).then((tag) => {
      setTagDraft("");
      if (!tag || task.tagIds.includes(tag.id)) return;
      void updateTask(task.id, { tagIds: [...task.tagIds, tag.id] });
    });
  };

  const handleAreaCreate = () => {
    const name = areaDraft.trim();
    if (!name) return;

    void addArea(name).then((area) => {
      setAreaDraft("");
      if (!area) return;
      void updateTask(task.id, { areaId: area.id, list: "anytime", someday: false });
    });
  };

  const handleProjectCreate = () => {
    const name = projectDraft.trim();
    if (!name) return;

    void addProject(name, { activate: false, areaId: task.areaId }).then((project) => {
      setProjectDraft("");
      if (!project) return;
      void updateTask(task.id, { projectId: project.id, areaId: project.areaId ?? task.areaId, list: "anytime", someday: false });
    });
  };

  const handleSectionCreate = () => {
    const name = sectionDraft.trim();
    if (!name || !task.projectId) return;

    void addSection(task.projectId, name).then((section) => {
      setSectionDraft("");
      if (!section) return;
      void updateTask(task.id, { sectionId: section.id });
    });
  };

  const addChecklistItem = () => {
    const title = checklistDraft.trim();
    if (!title) return;
    const nextItem: ChecklistItem = {
      id: `check-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      title,
      completed: false,
      sortOrder:
        task.checklistItems.reduce((max, item) => Math.max(max, Number.isFinite(item.sortOrder) ? item.sortOrder : 0), -1) + 1
    };
    setChecklistDraft("");
    void updateTask(task.id, { checklistItems: [...task.checklistItems, nextItem] });
  };

  const updateChecklistItem = (itemId: string, patch: Partial<ChecklistItem>) => {
    void updateTask(task.id, {
      checklistItems: task.checklistItems.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
    });
  };

  const deleteChecklistItem = (itemId: string) => {
    void updateTask(task.id, {
      checklistItems: task.checklistItems.filter((item) => item.id !== itemId)
    });
  };

  const projectSections = sections.filter((section) => section.projectId === task.projectId && !section.archived);

  return (
    <section className="animate-panel-soft border-b border-line p-5" data-testid="task-details-panel">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue">任务详情</p>
          <p className="mt-1 text-xs leading-5 text-muted">只改需要的字段；标题之外都可以以后再补。</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="focus-ring rounded-md p-2 text-muted transition-colors duration-200 hover:bg-coral/10 hover:text-coral"
            aria-label="删除任务"
            onClick={() => void deleteTask(task.id)}
          >
            <Trash2 size={17} />
          </button>
          {onClose && (
            <button
              aria-label="关闭任务详情"
              className="focus-ring rounded-md p-2 text-muted transition-colors duration-200 hover:bg-paper hover:text-ink"
              type="button"
              onClick={onClose}
            >
              <X size={17} />
            </button>
          )}
        </div>
      </div>

      <label className="block">
        <span className="sr-only">任务标题</span>
        <input
          aria-label="任务标题"
          className="form-control text-lg font-semibold"
          name="task-title"
          value={task.title}
          onChange={(event) => void updateTask(task.id, { title: event.target.value })}
        />
      </label>

      <div className="mt-4 rounded-md border border-line/80 bg-paper/80 p-2 shadow-inner">
        <p className="px-1 text-xs font-semibold text-muted">放到哪里</p>
        <div className="mt-2 grid grid-cols-2 gap-1 rounded-md bg-white p-1 sm:grid-cols-5">
          {placementOptions.map((option) => {
            const selected = isPlacementActive(task, option.key, today);
            return (
              <button
                key={option.key}
                aria-label={`放到${option.label}`}
                className={clsx(
                  "focus-ring inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-semibold transition-all duration-200",
                  selected
                    ? "bg-blue text-white shadow-sm"
                    : "bg-transparent text-muted hover:bg-paper hover:text-ink"
                )}
                type="button"
                onClick={() => void updateTask(task.id, getPlacementPatch(option.key, today))}
              >
                <span aria-hidden="true">{option.emoji}</span>
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-3">
          <label className="text-xs font-semibold text-muted">
            项目
            <div className="relative mt-1">
              <FolderKanban className="form-icon" size={15} />
              <select
                aria-label="项目"
                className="form-control with-left-icon select-control"
                name="task-project"
                value={task.projectId ?? ""}
                onChange={(event) => {
                  const project = projects.find((item) => item.id === event.target.value);
                  void updateTask(task.id, {
                    projectId: event.target.value || undefined,
                    areaId: project?.areaId ?? task.areaId,
                    sectionId: undefined
                  });
                }}
              >
                <option value="">无项目</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="select-icon" size={15} />
            </div>
          </label>
          <InlineCreateForm
            icon={<FolderKanban size={15} />}
            label="新建项目"
            placeholder="新建项目"
            value={projectDraft}
            onChange={setProjectDraft}
            onSubmit={handleProjectCreate}
          />

          <label className="text-xs font-semibold text-muted">
            优先级
            <div className="relative mt-1">
              <Flag className="form-icon" size={15} />
              <select
                aria-label="优先级"
                className="form-control with-left-icon select-control"
                name="task-priority"
                value={task.priority}
                onChange={(event) => void updateTask(task.id, { priority: event.target.value as Priority })}
              >
                <option value="none">无</option>
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
              <ChevronDown className="select-icon" size={15} />
            </div>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3" data-testid="task-date-fields">
          <label className="text-xs font-semibold text-muted">
            计划日期
            <div className="relative mt-1">
              <CalendarDays className="form-icon" size={15} />
              <input
                aria-label="计划日期"
                className="form-control with-left-icon date-control"
                name="scheduled-date"
                type="date"
                value={task.scheduledDate ?? ""}
                onChange={(event) => void updateTask(task.id, { scheduledDate: event.target.value || undefined })}
              />
            </div>
          </label>
          <label className="text-xs font-semibold text-muted">
            截止日期
            <div className="relative mt-1">
              <CalendarCheck className="form-icon" size={15} />
              <input
                aria-label="截止日期"
                className="form-control with-left-icon date-control"
                name="due-date"
                type="date"
                value={task.dueDate ?? ""}
                onChange={(event) => void updateTask(task.id, { dueDate: event.target.value || undefined })}
              />
            </div>
          </label>
        </div>

        <label className="block text-xs font-semibold text-muted">
          重复
          <div className="relative mt-1">
            <RotateCcw className="form-icon" size={15} />
            <select
              aria-label="重复"
              className="form-control with-left-icon select-control"
              name="task-repeat"
              value={repeatValue(task.repeatRule)}
              onChange={(event) => void updateTask(task.id, { repeatRule: parseRepeatValue(event.target.value) })}
            >
              <option value="none">不重复</option>
              <option value="daily">每天</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月</option>
              <option value="interval-3-day">每 3 天</option>
            </select>
            <ChevronDown className="select-icon" size={15} />
          </div>
        </label>

        <div>
          <p className="mb-2 text-xs font-semibold text-muted">标签</p>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const checked = task.tagIds.includes(tag.id);
              const nextTagIds = checked
                ? task.tagIds.filter((tagId) => tagId !== tag.id)
                : [...task.tagIds, tag.id];
              return (
                <label
                  key={tag.id}
                  className={clsx(
                    "focus-ring inline-flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs font-semibold transition-all duration-200",
                    checked ? colorClass[tag.color] : "border-line bg-white text-muted hover:border-blue/25 hover:text-ink"
                  )}
                  title={tag.name}
                >
                  <input
                    aria-label={`${tag.name} 标签`}
                    className="sr-only"
                    name={`tag-${tag.id}`}
                    type="checkbox"
                    checked={checked}
                    onChange={() => void updateTask(task.id, { tagIds: nextTagIds })}
                  />
                  <span className={clsx("h-2 w-2 rounded-full", dotClass[tag.color])} />
                  <span>{tag.name}</span>
                </label>
              );
            })}
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              handleTagCreate();
            }}
          >
            <label className="min-w-0 flex-1">
              <span className="sr-only">新建标签</span>
              <div className="relative">
                <Tag className="form-icon" size={15} />
                <input
                  aria-label="新建标签"
                  className="form-control with-left-icon"
                  name="new-tag"
                  placeholder="新建标签"
                  value={tagDraft}
                  onChange={(event) => setTagDraft(event.target.value)}
                />
              </div>
            </label>
            <button
              aria-label="创建标签"
              className="focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-white text-muted transition-all duration-200 hover:border-blue/30 hover:text-blue disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!tagDraft.trim()}
              type="submit"
            >
              <Plus size={16} />
            </button>
          </form>
        </div>
      </div>

      <button
        aria-label={showAdvanced ? "收起更多设置" : "显示更多设置"}
        className="focus-ring mt-4 flex w-full items-center justify-between rounded-md border border-line/80 bg-white px-3 py-2.5 text-sm font-semibold text-muted shadow-sm transition-colors duration-200 hover:border-blue/30 hover:text-ink"
        type="button"
        onClick={() => setShowAdvanced((value) => !value)}
      >
        <span>更多设置</span>
        <ChevronRight className={clsx("transition-transform duration-200", showAdvanced && "rotate-90")} size={16} />
      </button>

      {showAdvanced && (
        <div
          className="animate-settings-reveal mt-4 rounded-md border border-line/80 bg-white/75 p-3 shadow-sm"
          data-testid="advanced-task-settings"
        >
          <div className="space-y-4">
            <div className="rounded-md border border-line bg-paper/60 p-3">
              <p className="mb-3 text-xs font-semibold text-muted">进阶组织</p>
              <div className="space-y-3">
                <label className="text-xs font-semibold text-muted">
                  领域
                  <div className="relative mt-1">
                    <span className="form-icon text-[13px]" aria-hidden="true">
                      🧭
                    </span>
                    <select
                      aria-label="领域"
                      className="form-control with-left-icon select-control"
                      name="task-area"
                      value={task.areaId ?? ""}
                      onChange={(event) => void updateTask(task.id, { areaId: event.target.value || undefined })}
                    >
                      <option value="">无领域</option>
                      {areas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="select-icon" size={15} />
                  </div>
                </label>
                <InlineCreateForm
                  icon="🧭"
                  label="新建领域"
                  placeholder="新建领域"
                  value={areaDraft}
                  onChange={setAreaDraft}
                  onSubmit={handleAreaCreate}
                />

                <label className="text-xs font-semibold text-muted">
                  阶段
                  <div className="relative mt-1">
                    <ChevronRight className="form-icon" size={15} />
                    <select
                      aria-label="阶段"
                      className="form-control with-left-icon select-control"
                      disabled={!task.projectId}
                      name="task-section"
                      value={task.sectionId ?? ""}
                      onChange={(event) => void updateTask(task.id, { sectionId: event.target.value || undefined })}
                    >
                      <option value="">未分组</option>
                      {projectSections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="select-icon" size={15} />
                  </div>
                </label>
                <InlineCreateForm
                  icon={<ChevronRight size={15} />}
                  label="新建阶段"
                  placeholder="新建阶段"
                  value={sectionDraft}
                  disabled={!task.projectId}
                  onChange={setSectionDraft}
                  onSubmit={handleSectionCreate}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted">
                任务备注
                <textarea
                  aria-label="任务备注"
                  className="form-control mt-1 min-h-28 resize-none leading-6"
                  name="task-notes"
                  value={task.notes}
                  onChange={(event) => void updateTask(task.id, { notes: event.target.value })}
                />
              </label>
              {task.notes.trim() && (
                <div className="mt-2 rounded-md border border-line bg-paper/70 p-3 text-sm leading-6 text-ink">
                  <p className="mb-2 text-xs font-semibold text-muted">Markdown 预览</p>
                  <MarkdownPreview value={task.notes} />
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-muted">清单项</p>
              <div className="space-y-2">
                {task.checklistItems.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm"
                  >
                    <input
                      aria-label={`清单项 ${item.title}`}
                      className="h-4 w-4 rounded border-line text-blue"
                      checked={item.completed}
                      type="checkbox"
                      onChange={(event) => updateChecklistItem(item.id, { completed: event.target.checked })}
                    />
                    <span className={clsx("min-w-0 flex-1", item.completed && "text-muted line-through")}>
                      {item.title}
                    </span>
                    <button
                      aria-label={`删除清单项 ${item.title}`}
                      className="focus-ring rounded-md p-1 text-muted hover:bg-coral/10 hover:text-coral"
                      type="button"
                      onClick={() => deleteChecklistItem(item.id)}
                    >
                      <X size={14} />
                    </button>
                  </label>
                ))}
              </div>
              <form
                className="mt-2 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  addChecklistItem();
                }}
              >
                <input
                  aria-label="添加清单项"
                  className="form-control"
                  name="new-checklist-item"
                  placeholder="添加清单项"
                  value={checklistDraft}
                  onChange={(event) => setChecklistDraft(event.target.value)}
                />
                <button
                  aria-label="创建清单项"
                  className="focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-white text-muted hover:border-blue/30 hover:text-blue disabled:opacity-45"
                  disabled={!checklistDraft.trim()}
                  type="submit"
                >
                  <Plus size={16} />
                </button>
              </form>
            </div>

            <label className="block text-xs font-semibold text-muted">
              番茄估算
              <input
                aria-label="番茄估算"
                className="form-control mt-1"
                min={0}
                name="task-pomodoro-estimate"
                type="number"
                value={task.pomodoroEstimate}
                onChange={(event) => void updateTask(task.id, { pomodoroEstimate: Math.max(0, Number(event.target.value) || 0) })}
              />
            </label>

            <div className="grid grid-cols-2 gap-2 text-xs text-muted">
              <p className="rounded-md bg-paper px-3 py-2">创建 {new Date(task.createdAt).toLocaleString("zh-CN")}</p>
              <p className="rounded-md bg-paper px-3 py-2">更新 {new Date(task.updatedAt).toLocaleString("zh-CN")}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function PomodoroPanel() {
  const focus = useTaskStore((state) => state.focus);
  const startFocus = useTaskStore((state) => state.startFocus);
  const pauseFocus = useTaskStore((state) => state.pauseFocus);
  const resetFocus = useTaskStore((state) => state.resetFocus);
  const setFocusDuration = useTaskStore((state) => state.setFocusDuration);
  const [durationInput, setDurationInput] = useState(String(focus.durationMinutes));
  const [notificationPermission, setNotificationPermission] = useState<NotificationUiState>(() =>
    getNotificationPermissionState()
  );
  const [requestingNotification, setRequestingNotification] = useState(false);
  const statusText =
    focus.status === "idle"
      ? "准备中"
      : focus.status === "running"
        ? "进行中"
        : focus.status === "paused"
          ? "已暂停"
          : "已完成";

  useEffect(() => {
    setDurationInput(String(focus.durationMinutes));
  }, [focus.durationMinutes]);

  const enableSystemNotifications = async () => {
    setRequestingNotification(true);
    try {
      setNotificationPermission(await requestNotificationPermission());
    } catch {
      setNotificationPermission(getNotificationPermissionState());
    } finally {
      setRequestingNotification(false);
    }
  };

  return (
    <section className="animate-panel-soft p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-focus">番茄钟</p>
          <h2 className="mt-1 text-lg font-semibold">专注时段</h2>
        </div>
        <span className={clsx("rounded-md border px-2 py-1 text-xs font-semibold", colorClass.focus)}>
          {statusText}
        </span>
      </div>

      <div className="rounded-md border border-line bg-paper p-4 text-center">
        <div
          className={clsx(
            "mx-auto flex h-36 w-36 items-center justify-center rounded-full border-[10px] border-focus/20 bg-white",
            focus.status === "running" && "timer-ring"
          )}
        >
          <span className="text-4xl font-semibold tracking-normal">{formatTimer(focus.remainingSeconds)}</span>
        </div>
        <p className="mt-4 text-sm font-semibold text-ink">独立专注</p>
        <p className="mt-1 text-xs leading-5 text-muted">不绑定具体任务，完成后只记录本次专注分钟。</p>
      </div>

      <label className="mt-4 block text-xs font-semibold text-muted">
        番茄钟时长
        <div className="mt-1 flex items-center gap-2">
          <input
            aria-label="番茄钟时长"
            className="form-control min-w-0 flex-1 disabled:bg-paper disabled:text-muted"
            name="focus-duration"
            type="number"
            min={1}
            max={120}
            disabled={focus.status === "running"}
            value={durationInput}
            onBlur={() => {
              if (!durationInput) setDurationInput(String(focus.durationMinutes));
            }}
            onChange={(event) => {
              const value = event.target.value;
              setDurationInput(value);
              if (!value) return;
              setFocusDuration(Number(value));
            }}
          />
          <span className="text-sm font-medium text-muted">分钟</span>
        </div>
      </label>

      <div className="mt-4 rounded-md border border-line bg-white/80 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">系统通知</p>
            <p className="mt-1 text-xs leading-5 text-muted">
              {notificationPermission === "granted"
                ? "系统通知已开启"
                : notificationPermission === "denied"
                  ? "系统通知已被浏览器关闭，请在站点权限里重新开启。"
                  : notificationPermission === "unsupported"
                    ? "当前浏览器不支持系统通知。"
                    : "开启后，番茄钟结束会弹出 Windows 系统通知。"}
            </p>
          </div>
          {notificationPermission === "default" ? (
            <button
              aria-label="启用系统通知"
              className="focus-ring shrink-0 rounded-md border border-focus/20 bg-focus/10 px-3 py-2 text-xs font-semibold text-focus transition-all duration-200 hover:border-focus/35 hover:bg-focus/15 disabled:cursor-wait disabled:opacity-60"
              disabled={requestingNotification}
              type="button"
              onClick={enableSystemNotifications}
            >
              {requestingNotification ? "请求中" : "启用系统通知"}
            </button>
          ) : (
            <span
              className={clsx(
                "shrink-0 rounded-md border px-2.5 py-1.5 text-xs font-semibold",
                notificationPermission === "granted"
                  ? colorClass.teal
                  : notificationPermission === "denied"
                    ? colorClass.coral
                    : priorityClass.none
              )}
            >
              {notificationPermission === "granted"
                ? "已开启"
                : notificationPermission === "denied"
                  ? "已关闭"
                  : "不可用"}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {focus.status === "running" ? (
          <button
            className="focus-ring flex flex-1 items-center justify-center gap-2 rounded-md bg-amber px-4 py-2.5 text-sm font-semibold text-white"
            aria-label="暂停专注"
            onClick={pauseFocus}
          >
            <Pause size={17} />
            暂停
          </button>
        ) : (
          <button
            className="focus-ring flex flex-1 items-center justify-center gap-2 rounded-md bg-focus px-4 py-2.5 text-sm font-semibold text-white"
            aria-label="开始专注"
            onClick={() => startFocus()}
          >
            <Play size={17} />
            开始
          </button>
        )}
        <button
          className="focus-ring rounded-md border border-line bg-white px-3 py-2.5 text-muted hover:text-ink"
          aria-label="重置专注"
          onClick={resetFocus}
        >
          <RotateCcw size={17} />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md border border-blue/20 bg-blue/10 p-3 text-blue">
          <Clock3 size={15} />
          <p className="mt-2 font-semibold">{focus.durationMinutes} 分钟</p>
          <p>当前时长</p>
        </div>
        <div className="rounded-md border border-coral/20 bg-coral/10 p-3 text-coral">
          <Tag size={15} />
          <p className="mt-2 font-semibold">本地</p>
          <p>无需账号</p>
        </div>
      </div>
    </section>
  );
}

function Toast() {
  const notice = useTaskStore((state) => state.notice);
  const clearNotice = useTaskStore((state) => state.clearNotice);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(clearNotice, 2600);
    return () => window.clearTimeout(timer);
  }, [clearNotice, notice]);

  if (!notice) return null;

  return (
    <div className="animate-toast fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-md border border-teal/20 bg-white px-4 py-3 text-sm font-semibold text-ink shadow-panel">
      <span className="mr-2 inline-flex h-2 w-2 rounded-full bg-teal" />
      {notice}
    </div>
  );
}

function repeatValue(repeatRule?: RepeatRule): string {
  if (!repeatRule) return "none";
  if (repeatRule.type === "daily" && repeatRule.interval === 1) return "daily";
  if (repeatRule.type === "weekly" && repeatRule.interval === 1) return "weekly";
  if (repeatRule.type === "monthly" && repeatRule.interval === 1) return "monthly";
  if (repeatRule.type === "interval" && repeatRule.unit === "day" && repeatRule.interval === 3) {
    return "interval-3-day";
  }
  return "none";
}

function parseRepeatValue(value: string): RepeatRule | undefined {
  if (value === "daily") return { type: "daily", interval: 1 };
  if (value === "weekly") return { type: "weekly", interval: 1 };
  if (value === "monthly") return { type: "monthly", interval: 1 };
  if (value === "interval-3-day") return { type: "interval", interval: 3, unit: "day" };
  return undefined;
}
