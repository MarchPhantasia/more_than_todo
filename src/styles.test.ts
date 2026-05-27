import { describe, expect, it } from "vitest";
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
