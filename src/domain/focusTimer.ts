export interface FocusTimerState {
  status: "idle" | "running" | "paused" | "completed";
  durationMinutes: number;
  remainingSeconds: number;
  taskId?: string;
  startedAt?: string;
}

export type FocusTimerAction =
  | { type: "start"; taskId?: string; startedAt: string }
  | { type: "pause" }
  | { type: "tick"; seconds: number }
  | { type: "reset"; durationMinutes?: number }
  | { type: "complete" };

export const createInitialFocusTimer = (durationMinutes = 25): FocusTimerState => ({
  status: "idle",
  durationMinutes,
  remainingSeconds: durationMinutes * 60
});

export const focusTimerReducer = (
  state: FocusTimerState,
  action: FocusTimerAction
): FocusTimerState => {
  if (action.type === "start") {
    const startsFreshRound = state.status === "completed" || state.remainingSeconds === 0;

    return {
      ...state,
      status: "running",
      remainingSeconds: startsFreshRound ? state.durationMinutes * 60 : state.remainingSeconds,
      taskId: startsFreshRound ? action.taskId : action.taskId ?? state.taskId,
      startedAt: startsFreshRound ? action.startedAt : state.startedAt ?? action.startedAt
    };
  }

  if (action.type === "pause") {
    return state.status === "running" ? { ...state, status: "paused" } : state;
  }

  if (action.type === "tick") {
    if (state.status !== "running") return state;
    const remainingSeconds = Math.max(0, state.remainingSeconds - action.seconds);
    return {
      ...state,
      remainingSeconds,
      status: remainingSeconds === 0 ? "completed" : "running"
    };
  }

  if (action.type === "complete") {
    return { ...state, remainingSeconds: 0, status: "completed" };
  }

  const durationMinutes = action.durationMinutes ?? state.durationMinutes;
  return createInitialFocusTimer(durationMinutes);
};

export const formatTimer = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};
