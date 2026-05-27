import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "./quickAdd";

describe("quick add parser", () => {
  const today = "2026-05-27";

  it("parses Chinese project, tag, priority, date, and repeat shortcuts", () => {
    expect(parseQuickAdd("写周报 #工作 @写作 p1 明天 每周", today)).toEqual({
      title: "写周报",
      projectName: "工作",
      tagNames: ["写作"],
      priority: "high",
      scheduledDate: "2026-05-28",
      repeatRule: { type: "weekly", interval: 1 },
      someday: false,
      clearDate: false
    });
  });

  it("keeps a plain title plain", () => {
    expect(parseQuickAdd("只写标题", today)).toEqual({
      title: "只写标题",
      tagNames: [],
      priority: "none",
      someday: false,
      clearDate: false
    });
  });

  it("understands no-date and someday planning shortcuts", () => {
    expect(parseQuickAdd("整理资料 无日期", today)).toMatchObject({
      title: "整理资料",
      clearDate: true,
      someday: false
    });

    expect(parseQuickAdd("读书 将来 @生活", today)).toMatchObject({
      title: "读书",
      tagNames: ["生活"],
      someday: true,
      clearDate: true
    });
  });

  it("resolves common relative dates from today", () => {
    expect(parseQuickAdd("提交方案 今天", today).scheduledDate).toBe("2026-05-27");
    expect(parseQuickAdd("买咖啡 后天", today).scheduledDate).toBe("2026-05-29");
    expect(parseQuickAdd("周会 下周一", today).scheduledDate).toBe("2026-06-01");
  });
});
