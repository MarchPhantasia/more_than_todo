import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import tailwindConfig from "../tailwind.config";

const css = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");

describe("global typography", () => {
  it("uses a refined Chinese-first font stack", () => {
    const sans = tailwindConfig.theme.extend.fontFamily.sans;

    for (const fontName of ["MiSans", "HarmonyOS Sans SC", "PingFang SC", "Microsoft YaHei UI"]) {
      expect(sans).toContain(fontName);
    }

    expect(sans.indexOf("MiSans")).toBeLessThan(sans.indexOf("system-ui"));
  });
});

describe("motion rendering", () => {
  it("avoids filter-based panel animations that make text look blurry", () => {
    expect(css).not.toContain("filter: blur");
    expect(css).not.toContain("will-change: opacity, transform, filter");
  });

  it("defines a graceful layered centered modal entrance animation", () => {
    expect(css).toContain("@keyframes modal-backdrop-in");
    expect(css).toContain("@keyframes modal-panel-in");
    expect(css).toContain("@keyframes modal-content-in");
    expect(css).toContain(".animate-modal-backdrop");
    expect(css).toContain(".animate-modal-panel");
    expect(css).toContain(".animate-modal-content");
    expect(css).toContain("animation: modal-panel-in 420ms cubic-bezier(0.16, 1, 0.3, 1) backwards");
    expect(css).toContain("transform: translateY(18px) scale(0.965)");
  });

  it("does not keep the command panel text on transform compositing layers after opening", () => {
    const panelAnimationBlock = css.match(/\.animate-modal-panel \{[\s\S]*?\}/)?.[0] ?? "";
    const contentAnimationBlock = css.match(/\.animate-modal-content \{[\s\S]*?\}/)?.[0] ?? "";

    expect(panelAnimationBlock).not.toContain("will-change");
    expect(panelAnimationBlock).not.toContain(" both");
    expect(contentAnimationBlock).not.toContain(" both");
  });
});
