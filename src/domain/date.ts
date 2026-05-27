import type { DateKey } from "./types";

const pad = (value: number) => String(value).padStart(2, "0");

export const toDateKey = (date: Date): DateKey =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const parseDateKey = (key: DateKey): Date => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const addDays = (key: DateKey, days: number): DateKey => {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};

export const addMonthsClamped = (key: DateKey, months: number): DateKey => {
  const [year, month, day] = key.split("-").map(Number);
  const target = new Date(year, month - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return toDateKey(target);
};

export const compareDateKey = (left?: DateKey, right?: DateKey): number => {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right);
};

export const getWeekDates = (start: DateKey): DateKey[] =>
  Array.from({ length: 7 }, (_, index) => addDays(start, index));

export const formatShortWeekday = (key: DateKey): string =>
  new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(parseDateKey(key));

export const formatMonthDay = (key: DateKey): string =>
  new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(parseDateKey(key));
