type AudioContextConstructor = new () => AudioContext;
type FocusNotificationOptions = NotificationOptions & {
  renotify?: boolean;
};

const focusNotificationServiceWorkerUrl = "/focus-notification-sw.js";
const focusNotificationTitle = "番茄钟已结束";
const focusNotificationTag = "more-than-todo-focus-complete";

const getAudioContextConstructor = (): AudioContextConstructor | undefined => {
  const scope = globalThis as typeof globalThis & {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return scope.AudioContext ?? scope.webkitAudioContext;
};

export const playCompletionTone = (): void => {
  const AudioContextCtor = getAudioContextConstructor();
  if (!AudioContextCtor) return;

  try {
    const audio = new AudioContextCtor();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const start = audio.currentTime;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(740, start);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.08, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);

    oscillator.connect(gain);
    gain.connect(audio.destination);
    void audio.resume?.();
    oscillator.start(start);
    oscillator.stop(start + 0.16);
  } catch {
    // Audio feedback is best-effort; browsers may block it before user interaction.
  }
};

const getServiceWorkerContainer = (): ServiceWorkerContainer | undefined => {
  const scope = globalThis as typeof globalThis & {
    navigator?: Navigator & { serviceWorker?: ServiceWorkerContainer };
  };
  return scope.navigator?.serviceWorker;
};

const buildFocusNotificationOptions = (body: string): FocusNotificationOptions => ({
  body,
  renotify: true,
  requireInteraction: false,
  silent: false,
  tag: focusNotificationTag
});

export const ensureFocusNotificationRegistration = async (): Promise<ServiceWorkerRegistration | undefined> => {
  const serviceWorker = getServiceWorkerContainer();
  if (!serviceWorker) return undefined;

  try {
    const existingRegistration = await serviceWorker.getRegistration();
    const registration = existingRegistration ?? (await serviceWorker.register(focusNotificationServiceWorkerUrl));

    if ("ready" in serviceWorker) {
      try {
        return await serviceWorker.ready;
      } catch {
        return registration;
      }
    }

    return registration;
  } catch {
    return undefined;
  }
};

export const notifyFocusComplete = async (taskTitle?: string): Promise<boolean> => {
  if (!("Notification" in globalThis)) return false;

  const NotificationCtor = globalThis.Notification;
  if (NotificationCtor.permission !== "granted") return false;

  const body = taskTitle ? `${taskTitle} 的专注时间完成了。` : "当前专注时间完成了。";
  const options = buildFocusNotificationOptions(body);

  try {
    const registration = await ensureFocusNotificationRegistration();
    if (registration?.showNotification) {
      await registration.showNotification(focusNotificationTitle, options);
      return true;
    }
  } catch {
    // Fall back to the page Notification API below.
  }

  try {
    new NotificationCtor(focusNotificationTitle, options);
    return true;
  } catch {
    return false;
  }
};

export const requestNotificationPermission = async (): Promise<NotificationPermission | "unsupported"> => {
  if (!("Notification" in globalThis)) return "unsupported";
  if (globalThis.Notification.permission !== "default") {
    if (globalThis.Notification.permission === "granted") {
      void ensureFocusNotificationRegistration();
    }
    return globalThis.Notification.permission;
  }

  const permission = await globalThis.Notification.requestPermission();
  if (permission === "granted") {
    await ensureFocusNotificationRegistration();
  }
  return permission;
};
