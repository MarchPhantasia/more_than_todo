import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notifyFocusComplete, playCompletionTone, requestNotificationPermission } from "./feedback";

describe("feedback helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it("requests browser notification permission from an explicit user action", async () => {
    const notificationConstructor = vi.fn() as unknown as {
      new (title: string, options?: NotificationOptions): Notification;
      permission: NotificationPermission;
      requestPermission: ReturnType<typeof vi.fn>;
    };
    notificationConstructor.permission = "default";
    notificationConstructor.requestPermission = vi.fn(async () => "granted");
    vi.stubGlobal("Notification", notificationConstructor);

    await expect(requestNotificationPermission()).resolves.toBe("granted");

    expect(notificationConstructor.requestPermission).toHaveBeenCalled();
  });

  it("creates a browser notification when focus completes after permission is granted", async () => {
    const notificationConstructor = vi.fn() as unknown as {
      new (title: string, options?: NotificationOptions): Notification;
      permission: NotificationPermission;
      requestPermission: ReturnType<typeof vi.fn>;
    };
    notificationConstructor.permission = "granted";
    notificationConstructor.requestPermission = vi.fn(async () => "granted");
    vi.stubGlobal("Notification", notificationConstructor);

    await notifyFocusComplete("设计今日工作台");

    expect(notificationConstructor.requestPermission).not.toHaveBeenCalled();
    expect(notificationConstructor).toHaveBeenCalledWith("番茄钟已结束", {
      body: "设计今日工作台 的专注时间完成了。",
      silent: false
    });
  });

  it("does not request permission at completion time when system notifications were not enabled", async () => {
    const notificationConstructor = vi.fn() as unknown as {
      new (title: string, options?: NotificationOptions): Notification;
      permission: NotificationPermission;
      requestPermission: ReturnType<typeof vi.fn>;
    };
    notificationConstructor.permission = "default";
    notificationConstructor.requestPermission = vi.fn(async () => "granted");
    vi.stubGlobal("Notification", notificationConstructor);

    await expect(notifyFocusComplete()).resolves.toBe(false);

    expect(notificationConstructor.requestPermission).not.toHaveBeenCalled();
    expect(notificationConstructor).not.toHaveBeenCalled();
  });
});
