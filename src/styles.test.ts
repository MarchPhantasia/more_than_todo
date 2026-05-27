import { describe, expect, it } from "vitest";
import css from "./styles.css?raw";
import tailwindConfig from "../tailwind.config";

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
});
