import { beforeEach, describe, expect, it, vi } from "vitest";
import { notifyFocusComplete, playCompletionTone } from "./feedback";

describe("feedback helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("plays a short completion tone when audio is available", () => {
    const oscillator = {
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    };
    const gain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
      },
      connect: vi.fn()
    };
    const audioContext = {
      currentTime: 1,
      destination: {},
      createOscillator: vi.fn(() => oscillator),
      createGain: vi.fn(() => gain),
      resume: vi.fn()
    };

    vi.stubGlobal("AudioContext", vi.fn(() => audioContext));

    playCompletionTone();

    expect(audioContext.createOscillator).toHaveBeenCalled();
    expect(oscillator.start).toHaveBeenCalledWith(1);
    expect(oscillator.stop).toHaveBeenCalledWith(1.16);
  });

  it("requests permission and creates a browser notification when focus completes", async () => {
    const notificationConstructor = vi.fn() as unknown as {
      new (title: string, options?: NotificationOptions): Notification;
      permission: NotificationPermission;
      requestPermission: ReturnType<typeof vi.fn>;
    };
    notificationConstructor.permission = "default";
    notificationConstructor.requestPermission = vi.fn(async () => "granted");
    vi.stubGlobal("Notification", notificationConstructor);

    await notifyFocusComplete("设计今日工作台");

    expect(notificationConstructor.requestPermission).toHaveBeenCalled();
    expect(notificationConstructor).toHaveBeenCalledWith("番茄钟已结束", {
      body: "设计今日工作台 的专注时间完成了。",
      silent: false
    });
  });
});
