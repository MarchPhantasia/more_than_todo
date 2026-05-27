type AudioContextConstructor = new () => AudioContext;

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

export const notifyFocusComplete = async (taskTitle?: string): Promise<boolean> => {
  if (!("Notification" in globalThis)) return false;

  const NotificationCtor = globalThis.Notification;
  if (NotificationCtor.permission !== "granted") return false;

  const body = taskTitle ? `${taskTitle} 的专注时间完成了。` : "当前专注时间完成了。";
  try {
    new NotificationCtor("番茄钟已结束", {
      body,
      silent: false
    });
    return true;
  } catch {
    return false;
  }
};

export const requestNotificationPermission = async (): Promise<NotificationPermission | "unsupported"> => {
  if (!("Notification" in globalThis)) return "unsupported";
  if (globalThis.Notification.permission !== "default") return globalThis.Notification.permission;
  return globalThis.Notification.requestPermission();
};
