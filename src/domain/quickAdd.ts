import { addDays, parseDateKey, toDateKey } from "./date";
import type { DateKey, Priority, RepeatRule } from "./types";

export interface QuickAddParseResult {
  title: string;
  projectName?: string;
  tagNames: string[];
  priority: Priority;
  scheduledDate?: DateKey;
  repeatRule?: RepeatRule;
  someday: boolean;
  clearDate: boolean;
}

const priorityTokens: Record<string, Priority> = {
  p1: "high",
  p2: "medium",
  p3: "low",
  p4: "none"
};

const repeatTokens: Record<string, RepeatRule> = {
  每天: { type: "daily", interval: 1 },
  每日: { type: "daily", interval: 1 },
  每周: { type: "weekly", interval: 1 },
  每月: { type: "monthly", interval: 1 }
};

const weekdayIndex: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 0,
  天: 0
};

const resolveNextWeekday = (today: DateKey, weekday: number): DateKey => {
  const date = parseDateKey(today);
  const current = date.getDay();
  const daysUntil = ((weekday - current + 7) % 7) || 7;
  date.setDate(date.getDate() + daysUntil);
  return toDateKey(date);
};

const parseDateToken = (token: string, today: DateKey): DateKey | undefined => {
  if (token === "今天") return today;
  if (token === "明天") return addDays(today, 1);
  if (token === "后天") return addDays(today, 2);

  const nextWeekdayMatch = token.match(/^下周([一二三四五六日天])$/);
  if (nextWeekdayMatch) {
    const weekday = weekdayIndex[nextWeekdayMatch[1]];
    return resolveNextWeekday(today, weekday);
  }

  const weekdayMatch = token.match(/^周([一二三四五六日天])$/);
  if (weekdayMatch) return resolveNextWeekday(today, weekdayIndex[weekdayMatch[1]]);

  return undefined;
};

export const parseQuickAdd = (input: string, today: DateKey): QuickAddParseResult => {
  const tagNames: string[] = [];
  const titleTokens: string[] = [];
  let projectName: string | undefined;
  let priority: Priority = "none";
  let scheduledDate: DateKey | undefined;
  let repeatRule: RepeatRule | undefined;
  let someday = false;
  let clearDate = false;

  input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .forEach((token) => {
      if (token.startsWith("#") && token.length > 1) {
        projectName = token.slice(1);
        return;
      }

      if (token.startsWith("@") && token.length > 1) {
        tagNames.push(token.slice(1));
        return;
      }

      const priorityToken = priorityTokens[token.toLowerCase()];
      if (priorityToken) {
        priority = priorityToken;
        return;
      }

      const repeatToken = repeatTokens[token];
      if (repeatToken) {
        repeatRule = repeatToken;
        return;
      }

      if (token === "无日期") {
        scheduledDate = undefined;
        clearDate = true;
        return;
      }

      if (token === "将来") {
        scheduledDate = undefined;
        someday = true;
        clearDate = true;
        return;
      }

      const parsedDate = parseDateToken(token, today);
      if (parsedDate) {
        scheduledDate = parsedDate;
        clearDate = false;
        someday = false;
        return;
      }

      titleTokens.push(token);
    });

  return {
    title: titleTokens.join(" ").trim(),
    projectName,
    tagNames,
    priority,
    scheduledDate,
    repeatRule,
    someday,
    clearDate
  };
};
