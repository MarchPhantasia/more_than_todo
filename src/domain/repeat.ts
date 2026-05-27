import { addDays, addMonthsClamped } from "./date";
import type { DateKey, RepeatRule } from "./types";

const interval = (value: number) => Math.max(1, Math.floor(value || 1));

export const getNextScheduledDate = (
  scheduledDate: DateKey | undefined,
  repeatRule: RepeatRule | undefined
): DateKey | null => {
  if (!scheduledDate || !repeatRule) return null;

  if (repeatRule.type === "daily") {
    return addDays(scheduledDate, interval(repeatRule.interval));
  }

  if (repeatRule.type === "weekly") {
    return addDays(scheduledDate, interval(repeatRule.interval) * 7);
  }

  if (repeatRule.type === "monthly") {
    return addMonthsClamped(scheduledDate, interval(repeatRule.interval));
  }

  if (repeatRule.unit === "day") return addDays(scheduledDate, interval(repeatRule.interval));
  if (repeatRule.unit === "week") return addDays(scheduledDate, interval(repeatRule.interval) * 7);
  return addMonthsClamped(scheduledDate, interval(repeatRule.interval));
};

export const repeatLabel = (repeatRule?: RepeatRule): string => {
  if (!repeatRule) return "不重复";
  if (repeatRule.type === "daily") return repeatRule.interval === 1 ? "每天" : `每 ${repeatRule.interval} 天`;
  if (repeatRule.type === "weekly") return repeatRule.interval === 1 ? "每周" : `每 ${repeatRule.interval} 周`;
  if (repeatRule.type === "monthly") return repeatRule.interval === 1 ? "每月" : `每 ${repeatRule.interval} 月`;
  const unit = repeatRule.unit === "day" ? "天" : repeatRule.unit === "week" ? "周" : "月";
  return `每 ${repeatRule.interval} ${unit}`;
};
